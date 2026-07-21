# Session Management

> **Scope** — This document covers the complete session lifecycle: creation, tracking, refresh-token rotation, max-device enforcement, revocation, and access token denylist. It is intended for backend developers working on this service.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Redis Data Model](#2-redis-data-model)
3. [Login & Session Creation](#3-login--session-creation)
4. [Token Rotation](#4-token-rotation)
5. [Max Device Enforcement](#5-max-device-enforcement)
6. [Session Listing](#6-session-listing)
7. [Session Revocation & Access Token Denylist](#7-session-revocation--access-token-denylist)
8. [Auth Middleware — Denylist Check](#8-auth-middleware--denylist-check)
9. [Password Change & Account Deletion](#9-password-change--account-deletion)
10. [API Reference](#10-api-reference)
11. [Configuration](#11-configuration)
12. [Redis Key Reference](#12-redis-key-reference)

---

## 1. Overview

Every time a user authenticates — via email/password, Google, or Apple — a **session** is created. A session is represented by a **refresh token** (a JWT) and stored in Redis. Access tokens are short-lived JWTs that are never stored; refresh tokens are long-lived and tracked server-side.

```
Client                  Server                          Redis
  │                        │                               │
  ├─── POST /login ────────►│                               │
  │                        ├── SET refresh-token:<tid> ────►│
  │                        ├── HSET session-meta:<tid> ─────►│
  │                        ├── ZADD user-sessions:<uid> ───►│
  │◄── { accessToken,      │                               │
  │      refreshToken } ───┤                               │
```

Key properties of the system:

- **Access tokens** expire in `JWT_TOKEN_EXPIRY` (default: 1 day). Not stored in Redis.
- **Refresh tokens** expire in `JWT_REFRESH_EXPIRY` (default: 7 days). Stored in Redis.
- **Sessions are rotated** — using a refresh token invalidates it and issues a new one.
- **Max N sessions** per user (default: 5). Oldest is evicted automatically.
- **Instant revocation** — a revoked session's access token is blocklisted in Redis so it is rejected within milliseconds, before it naturally expires.
- **Full revocation** on password change or account deletion.

---

## 2. Redis Data Model

Four key types are used per session:

### 2.1 Refresh Token Lookup

```
Key:   refresh-token:<refreshTokenId>
Type:  STRING
Value: <userId>
TTL:   JWT_REFRESH_EXPIRY (seconds)
```

Used to validate a refresh token and look up which user it belongs to.

---

### 2.2 Session Metadata Hash

```
Key:   session-meta:<refreshTokenId>
Type:  HASH
Fields:
  loginTime    → Unix timestamp in ms (when session was created)
  loginMethod  → "email" | "google" | "apple"
  accessTid    → UUID of the access token issued for this session (used for denylist)
  userAgent    → (optional) HTTP User-Agent string from login request
TTL:   JWT_REFRESH_EXPIRY (seconds)
```

Used to display session info (`GET /user/sessions`) and to look up the `accessTid` when revoking a session so the access token can be immediately blocklisted.

---

### 2.3 Per-User Session Index (ZSET)

```
Key:    user-sessions:<userId>
Type:   Sorted Set (ZSET)
Member: <refreshTokenId>
Score:  Unix timestamp in ms (login time)
TTL:    JWT_REFRESH_EXPIRY (GT — only extended, never shrunk)
```

The sorted set is the backbone of the system. It:

- Enables **counting** sessions (`ZCARD`)
- Enables **listing** sessions in chronological order (`ZRANGE`)
- Enables **evicting** the oldest session (`ZPOPMIN`)
- Enables **bulk revocation** (read all members → delete all tokens)

### 2.4 Access Token Denylist

```
Key:   revoked-access:<accessTid>
Type:  STRING
Value: "1"
TTL:   JWT_TOKEN_EXPIRY (seconds)
```

Written at session revocation time. Checked by the auth middleware on every authenticated request. Expires automatically at the same time the access token itself would expire — no manual cleanup needed.

---

### 2.5 Redis Connection Pooling & Promise Management

All Redis operations are executed through the `RedisPool` wrapper (`src/redis/redis-client.ts`). The wrapper manages connection pool acquisition and release safely using Promise chaining and `.finally()` blocks:

```ts
zadd(key: KeyType, score: number, member: string): Promise<number> {
    return this._pool.acquire().then((connection) => {
        return connection.zadd(key, score, member).finally(() => {
            this._pool.release(connection)
        })
    })
}
```

This guarantees that connections are released back to the `generic-pool` even if an exception occurs during execution.

---

## 3. Login & Session Creation

Every successful authentication flows through `UserService.generateTokens(user, options)`.

```ts
options = {
  loginMethod: "email" | "google" | "apple"
  userAgent?:  string   // from req.headers['user-agent']
}
```

### Steps performed inside `generateTokens`

```
1. Generate  tid         (UUID — embedded in access token AND stored in session-meta)
2. Generate  refreshId   (UUID — the refresh token identifier / ZSET member)
3. Sign      accessToken  (HS256, expires: JWT_TOKEN_EXPIRY)
4. Sign      refreshToken (HS256, expires: JWT_REFRESH_EXPIRY)

5. Redis: SET  refresh-token:<refreshId>  →  userId
          EX   JWT_REFRESH_EXPIRY

6. Redis: HSET session-meta:<refreshId>   →  { loginTime, loginMethod, accessTid=tid, userAgent? }
7. Redis: EXPIRE session-meta:<refreshId> →  JWT_REFRESH_EXPIRY

8. Redis: ZADD user-sessions:<userId>     →  score=now, member=refreshId
9. Redis: EXPIRE user-sessions:<userId>   →  JWT_REFRESH_EXPIRY  (GT — only if longer)

10. Redis: ZCARD user-sessions:<userId>
    IF count > maxSessionsPerUser:
      ZPOPMIN user-sessions:<userId>   →  evict oldest session(s)
      DEL refresh-token:<evicted>
      DEL session-meta:<evicted>
```

### Which login methods pass `userAgent`

| Entry point | `loginMethod` | `userAgent` |
|-------------|---------------|-------------|
| `POST /user/login` | `email` | ✅ from `req.headers['user-agent']` |
| `POST /user/sign-up` | `email` | ✅ from `req.headers['user-agent']` |
| `POST /user/google-access-token-login` | `google` | ✅ from `req.headers['user-agent']` |
| `POST /user/apple-id-token` | `apple` | ✅ from `req.headers['user-agent']` |
| Token rotation (`POST /user/refresh-token`) | inherited | inherited from old session |

---

## 4. Token Rotation

When a client calls `POST /user/refresh-token` with a valid refresh token, the old token is **immediately consumed** before the new pair is issued.

```
Client                  Server                          Redis
  │                        │                               │
  ├─ POST /refresh-token ──►│                               │
  │   { token: <old> }     │                               │
  │                        ├── GET refresh-token:<old> ───►│ → userId
  │                        ├── HGETALL session-meta:<old> ►│ → { loginMethod, userAgent, accessTid }
  │                        ├── DEL refresh-token:<old> ────►│ ← consumed
  │                        ├── DEL session-meta:<old> ─────►│ ← consumed
  │                        ├── ZREM user-sessions:<uid> ───►│ ← removed from index
  │                        │                               │
  │                        ├── generateTokens(user,        │
  │                        │    { loginMethod, userAgent }) │
  │                        │    (new tid + refreshId)       │
  │                        ├── SET refresh-token:<new> ────►│
  │                        ├── HSET session-meta:<new> ─────►│  (accessTid = new tid)
  │                        ├── ZADD user-sessions:<uid> ───►│
  │◄── { accessToken,      │                               │
  │      refreshToken } ───┤                               │
```

> **Security note**: If the same refresh token is used twice (replay attack), the second call returns `401 Invalid Token` because the token was already deleted on the first use.

The new session **inherits** the original `loginMethod` and `userAgent`. A **new** `accessTid` is generated and stored in the new session-meta. The login timestamp updates to the rotation time.

---

## 5. Max Device Enforcement

Configured via `MAX_SESSIONS_PER_USER` (default: `5`).

When `generateTokens` runs and session count exceeds the limit:

```
sessionCount = ZCARD user-sessions:<userId>
overflow     = sessionCount - maxSessionsPerUser

evicted[] = ZPOPMIN user-sessions:<userId>  count=overflow
            // returns [member0, score0, member1, score1, ...]

for each evicted member (refreshId):
  DEL refresh-token:<refreshId>
  DEL session-meta:<refreshId>
```

The **oldest** sessions (lowest ZSET score = earliest login time) are evicted. The user's oldest device is logged out silently; the new device session proceeds.

### Example (maxSessions = 3)

```
State before login 4:
  user-sessions:<uid> = {
    tid-A (score: T+0),   ← oldest, will be evicted
    tid-B (score: T+1),
    tid-C (score: T+2)
  }

After login 4:
  ZADD → tid-D (score: T+3)   → count = 4, overflow = 1
  ZPOPMIN → evicts tid-A
  DEL refresh-token:tid-A, session-meta:tid-A

  user-sessions:<uid> = {
    tid-B (score: T+1),
    tid-C (score: T+2),
    tid-D (score: T+3)    ← new session
  }
```

Any future request using `tid-A`'s refresh token will get `401 Invalid Token`.

---

## 6. Session Listing

`GET /user/sessions` returns all active sessions for a user, newest first.

### Access control

| Caller | `?userId` absent | `?userId` = own ID | `?userId` = other user's ID |
|--------|------------------|--------------------|------------------------------|
| Regular user | ✅ own sessions | ✅ own sessions | ❌ 401 |
| Admin / Ops | ✅ own sessions | ✅ own sessions | ✅ target user's sessions |

Admins and ops pass `?userId=<targetId>` to view another user's sessions on the same endpoint.

### Internal flow

```
ZRANGE user-sessions:<userId> 0 -1 WITHSCORES
→ flat array: [refreshId0, score0, refreshId1, score1, ...]

for each refreshId:
  HGETALL session-meta:<refreshId>
  → { loginTime, loginMethod, accessTid, userAgent? }

sort by loginTime DESC
```

### Response shape

```json
{
  "status": { "error": false, "code": 200 },
  "message": "Success",
  "result": [
    {
      "tid": "3f8c2b1a-0000-0000-0000-000000000001",
      "loginTime": 1753012345678,
      "loginMethod": "apple",
      "userAgent": "MyApp/2.1 (iPhone; iOS 18.0; Scale/3.00)"
    },
    {
      "tid": "9d4e7f2c-0000-0000-0000-000000000002",
      "loginTime": 1752998765432,
      "loginMethod": "email",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
  ]
}
```

> **Note**: `tid` in the response is the **refresh token ID** (ZSET member), not the access token's `tid`. Use it with `DELETE /user/sessions/:tid` to revoke a specific session.

`userAgent` is omitted if the client did not send the header at login time.

---

## 7. Session Revocation & Access Token Denylist

### The problem with stateless JWTs

Revoking a session (deleting the refresh token) does **not** immediately invalidate the access token the client already holds. Access tokens are stateless JWTs — they are valid until they expire (`JWT_TOKEN_EXPIRY`), even if the session is gone.

### Solution: access token denylist

When a session is revoked, the `accessTid` stored in `session-meta` is immediately written to a Redis denylist key with TTL = `JWT_TOKEN_EXPIRY`. The auth middleware checks this key on every request. The denylist key auto-expires when the access token itself would have expired.

```
Revoke at time T:
  revoked-access:<accessTid>  =  "1"  EX JWT_TOKEN_EXPIRY

Any request before T + JWT_TOKEN_EXPIRY:
  authMiddleware → GET revoked-access:<accessTid> → "1" → 401 immediately

At T + JWT_TOKEN_EXPIRY:
  • jwt.verify() rejects token due to exp claim
  • Redis key also auto-expires
  → both gone, no manual cleanup needed
```

---

### 7.1 Revoke specific session — `DELETE /user/sessions/:tid`

Allows a user to log out of one device without affecting other sessions.

```
1. GET refresh-token:<tid>            →  storedUserId
2. IF storedUserId !== callerUserId   →  401  (ownership check)
3. HGETALL session-meta:<tid>         →  { accessTid, ... }
4. SET revoked-access:<accessTid>  "1"  EX JWT_TOKEN_EXPIRY   ← denylist
5. DEL refresh-token:<tid>
6. DEL session-meta:<tid>
7. ZREM user-sessions:<userId>  <tid>
```

The **ownership check** (step 2) ensures a user cannot revoke another user's session even if they obtain a `tid` value.

---

### 7.2 Logout (current session) — `POST /user/invalidate-token`

Takes the raw refresh JWT in the request body. Does **not** denylist the access token (the client calling logout controls the session, so it can simply discard the access token).

```
1. jwt.verify(refreshToken)  →  { tid }
2. GET refresh-token:<tid>   →  userId
3. DEL refresh-token:<tid>
4. DEL session-meta:<tid>
5. ZREM user-sessions:<userId>  <tid>
```

---

### 7.3 Revoke all sessions — internal only

Called by `revokeAllSessions(userId)`. Not a public endpoint. Used by password change and account deletion.

```
1. ZRANGE user-sessions:<userId> 0 -1 WITHSCORES
   → refreshIds: [id0, id1, id2, ...]

2. For each id:
     HGETALL session-meta:<id>  →  { accessTid, ... }
     SET revoked-access:<accessTid>  "1"  EX JWT_TOKEN_EXPIRY   ← denylist each

3. DEL refresh-token:id0  session-meta:id0
   DEL refresh-token:id1  session-meta:id1
   ... (variadic DEL — single round trip)

4. DEL user-sessions:<userId>
```

---

## 8. Auth Middleware — Denylist Check

The check is embedded in `AuthMiddleware.generateAuthMiddleWare()` in `src/middleware/authMiddleware.ts`, immediately after `jwt.verify()`:

```
Every authenticated request:
  1. Extract Bearer token from Authorization header
  2. jwt.verify(token, jwtSecretKey)  →  { tid, userId, ... }
  3. GET revoked-access:<tid>          ← single Redis call (~0.1ms)
     IF found → 401 "Session has been revoked"
  4. DB lookup: userDao.read(userId)   (existing check)
  5. Proceed to handler
```

**Cost**: +1 Redis GET per authenticated request. The Redis connection pool is already in use for session operations, so the overhead is negligible.

**TTL correctness**:

| Key | TTL | Why |
|-----|-----|-----|
| `revoked-access:<accessTid>` | `JWT_TOKEN_EXPIRY` | Same lifetime as the access token — once the token expires naturally, `jwt.verify` rejects it anyway and the denylist entry is no longer needed |
| `session-meta:<refreshId>` | `JWT_REFRESH_EXPIRY` | Meta must live as long as the session can be renewed |

---

## 9. Password Change & Account Deletion

### Password change

Both password-change paths revoke all sessions (including denylist of all active access tokens) after updating the hash:

```
POST /user/reset-password                    (authenticated, requires old password)
POST /user/forgot-password-change-password   (OTP-based, unauthenticated)

  ↓ dao.update(userId, { password: newHash })
  ↓ revokeAllSessions(userId)
    → denylists all active access tokens
    → deletes all refresh tokens and session metadata
```

Every device is signed out immediately — both refresh tokens AND in-flight access tokens are invalidated.

### Account deletion

```
POST /user/delete-account   (authenticated)

  ↓ revokeAllSessions(userId)     ← sessions + access tokens wiped first
  ↓ dao.update(userId, { isSoftDeleted: true, ... })   OR
    dao.delete({ id: userId })
```

---

## 10. API Reference

All session management endpoints are under the `/user` prefix.

### Auth header (required for 🔒 routes)
```
Authorization: Bearer <accessToken>
```

---

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/user/login` | — | Email + password login |
| `POST` | `/user/sign-up` | — | Register new account |
| `POST` | `/user/google-access-token-login` | — | Login with Google access token |
| `POST` | `/user/apple-id-token` | — | Login with Apple ID token |
| `POST` | `/user/refresh-token` | — | Rotate refresh token (returns new pair) |
| `POST` | `/user/invalidate-token` | — | Logout (revoke current session) |
| `GET` | `/user/sessions` | 🔒 | List sessions. Admins may pass `?userId=` to view any user's sessions |
| `DELETE` | `/user/sessions/:tid` | 🔒 | Revoke a specific session (+ denylist its access token) |
| `POST` | `/user/reset-password` | 🔒 | Change password (revokes all sessions immediately) |
| `POST` | `/user/forgot-password-change-password` | — | OTP password reset (revokes all sessions immediately) |
| `POST` | `/user/delete-account` | 🔒 | Delete account (revokes all sessions immediately) |

Full Swagger documentation is available at `/docs` when the server is running.

---

## 11. Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `JWT_TOKEN_EXPIRY` | `1d` | Access token lifetime. Parsed by `parseTimespanToSeconds` — supports `s`, `m`, `h`, `d`, `w`, `y` suffixes. Stored as **seconds** (`number`). |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime. Same suffix support. Stored as **seconds** (`number`). |
| `JWT_SECRET` | `mysecretjwt` | Signing key for access tokens. **Must be changed in production.** |
| `REFRESH_SECRET` | `mysecretrefresh` | Signing key for refresh tokens. **Must be changed in production.** |
| `MAX_SESSIONS_PER_USER` | `5` | Max concurrent sessions per user. Oldest evicted when exceeded. |

---

## 12. Redis Key Reference

| Key Pattern | Type | TTL | Purpose |
|------------|------|-----|---------|
| `refresh-token:<refreshId>` | STRING | `JWT_REFRESH_EXPIRY` | Maps refresh token ID → userId |
| `session-meta:<refreshId>` | HASH | `JWT_REFRESH_EXPIRY` | Stores loginTime, loginMethod, accessTid, userAgent |
| `user-sessions:<userId>` | ZSET | `JWT_REFRESH_EXPIRY` (GT) | Session index, scored by login time |
| `revoked-access:<accessTid>` | STRING | `JWT_TOKEN_EXPIRY` | Access token denylist — instant revocation |
| `reset-password:<email>` | STRING | 15 min | OTP for forgot-password flow |

### Key lifecycle summary

```
LOGIN
  SET  refresh-token:<refreshId>   EX JWT_REFRESH_EXPIRY  ──┐
  HSET session-meta:<refreshId>    EX JWT_REFRESH_EXPIRY    ├── same TTL
  ZADD user-sessions:<userId>      GT JWT_REFRESH_EXPIRY  ──┘

REFRESH (token rotation)
  DEL  refresh-token:<old>         ← old session gone
  DEL  session-meta:<old>
  ZREM user-sessions:<userId> <old>
  SET  refresh-token:<new>         EX JWT_REFRESH_EXPIRY  ──┐
  HSET session-meta:<new>          EX JWT_REFRESH_EXPIRY    ├── fresh TTL
  ZADD user-sessions:<userId>      GT JWT_REFRESH_EXPIRY  ──┘

SINGLE SESSION REVOKE  (DELETE /user/sessions/:tid)
  SET  revoked-access:<accessTid>  EX JWT_TOKEN_EXPIRY     ← denylist
  DEL  refresh-token:<refreshId>
  DEL  session-meta:<refreshId>
  ZREM user-sessions:<userId> <refreshId>

REVOKE ALL  (password change / account delete)
  for each session:
    SET  revoked-access:<accessTid>  EX JWT_TOKEN_EXPIRY   ← denylist each
  DEL  refresh-token:*  session-meta:*  (all, single round trip)
  DEL  user-sessions:<userId>

AUTO-EXPIRY
  revoked-access:<accessTid>  →  expires after JWT_TOKEN_EXPIRY  (self-cleaning)
  session-meta / refresh-token → expires after JWT_REFRESH_EXPIRY (self-cleaning)
```