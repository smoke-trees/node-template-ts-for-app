import { ErrorCode, Result, Service, log } from '@smoke-trees/postgres-backend'
import { User } from './User.entity'
import { UserDao } from './User.dao'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import settings from '../../settings'
import jwt from 'jsonwebtoken'
import { _QueryDeepPartialEntity, SelectedRead } from '@smoke-trees/postgres-backend/dist/core/Dao'
import { EntityManager, FindOneOptions, FindOptionsWhere, FindOptionsSelect } from 'typeorm'
import { ContextProvider } from '@smoke-trees/smoke-context'
import { IGCPTokenRes, IGCPUserInfo, SignupType, UserType } from './IUser'
import { DeviceInfoEntity } from '../Notifications/DeviceInfo'
import { inject, injectable } from 'inversify'
import RedisDatabaseObject from '../../redis/redis-connection'
import { verifyAppleIdToken } from '../../utils/appleAuth'

@injectable()
export class UserService extends Service<User> {
	dao: UserDao
	constructor(
		@inject(UserDao)
		dao: UserDao
	) {
		super(dao)
		this.dao = dao
	}

	hashPassword(password: string) {
		return bcrypt.hashSync(password, 12)
	}

	async exportUserData(userId: string) {
		try {
			const userResult = await this.dao.read({
				where: { id: userId },
				relations: ['device']
			})
			if (userResult.status.error || !userResult.result) {
				return new Result(true, ErrorCode.NotFound, 'User not found')
			}
			const user = userResult.result as User & { device?: DeviceInfoEntity[] }

			const toIso = (value?: Date | null) =>
				value ?
					value instanceof Date ?
						value.toISOString()
					:	new Date(value).toISOString()
				:	null

			const devices = (user.device ?? []).map((device) => ({
				deviceId: device.deviceId ?? null,
				operatingSystem: device.os ?? null,
				appVersion: device.currentUserVersion ?? null,
				buildNumber: device.currentUserBuildNumber ?? null,
				fcmToken: device.fcmToken ?? null,
				ipAddress: device.deviceIpAddress ?? null,
				installedOn: toIso(device.installedTime),
				lastLoginOn: toIso(device.lastLoginTime),
				registeredOn: toIso(device.createdAt),
				lastUpdated: toIso(device.updatedAt)
			}))

			const exportData = {
				dataFiduciary: settings.appName,
				exportedOn: new Date().toISOString(),
				personalInformation: {
					id: user.id,
					firstName: user.firstName ?? null,
					lastName: user.lastName ?? null,
					email: user.email,
					emailVerified: user.emailVerified,
					phoneNumber: user.phoneNumber ?? null,
					countryCode: user.countryCode ?? null,
					accountType: user.userType,
					isActive: user.isActive,
					registeredOn: toIso(user.createdAt),
					lastUpdated: toIso(user.updatedAt)
				},
				consent: {
					consentGiven: user.consentGiven ?? false,
					consentGivenOn: toIso(user.consentAt),
					consentVersion: user.consentVersion ?? null
				},
				devices
			}

			return new Result(false, ErrorCode.Success, 'User data exported successfully', exportData)
		} catch (error) {
			log.error('Error exporting user data', 'UserService.exportUserData', error, {
				userId
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error exporting user data')
		}
	}

	async deleteAccount(userId: string) {
		try {
			// Revoke all active sessions before removing the account
			await this.revokeAllSessions(userId)

			if (settings.userSoftDelete) {
				const userResult = await this.dao.read(userId)
				if (userResult.status.error || !userResult.result) {
					return new Result(true, ErrorCode.NotFound, 'User not found')
				}
				const originalEmail = userResult.result.email
				const deletedEmail = `deleted_${Date.now()}_${originalEmail}`
				const result = await this.dao.update(userId, {
					isActive: false,
					isSoftDeleted: true,
					softDeletedAt: new Date(),
					email: deletedEmail
				})
				if (result.status.error) {
					return result
				}
				return new Result(false, ErrorCode.Success, 'Account deleted successfully')
			} else {
				const result = await this.dao.delete({ id: userId })
				if (result.status.error) {
					return result
				}
				return new Result(false, ErrorCode.Success, 'Account deleted successfully')
			}
		} catch (error) {
			log.error('Error deleting account', 'UserService.deleteAccount', error, {
				userId
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error deleting account')
		}
	}

	async login(email: string, password: string, userAgent?: string) {
		try {
			const user = await this.dao.read({
				where: { email: email.toLowerCase(), isActive: true, isSoftDeleted: false }
			})
			if (user.status.error || !user.result) {
				return new Result(true, ErrorCode.NotAuthorized, 'User not found')
			}
			const hashedPassword = await bcrypt.compare(password, user.result.password)
			if (!hashedPassword) {
				return new Result(true, ErrorCode.NotAuthorized, 'Incorrect Password')
			}
			if (!user.result.emailVerified) {
				await this.createVerificationLink(user.result.id)
			}
			return this.generateTokens(user.result, { loginMethod: SignupType.email, userAgent })
		} catch (error) {
			log.error('Error in login', 'UserService.login', error, { email })
			return new Result(true, ErrorCode.InternalServerError, 'Error in login')
		}
	}

	async signUp(
		email: string,
		password: string,
		consentGiven?: boolean | null,
		consentAt?: Date | null,
		consentVersion?: string | null,
		userAgent?: string
	) {
		const user = await this.dao.read({
			where: { email: email.toLowerCase(), isActive: true, isSoftDeleted: false }
		})
		if (user.result) {
			return new Result(true, ErrorCode.NotAuthorized, 'User Already Exists')
		}
		const t0 = Date.now()
		const hashedPassword = this.hashPassword(password)
		const hashDuration = Date.now() - t0
		const createUser = await this.dao.create({
			email: email.toLowerCase(),
			password: hashedPassword,
			signupType: SignupType.email,
			userType: UserType.user,
			...(consentGiven ?
				{
					consentGiven: true,
					consentAt: consentAt ?? new Date(),
					consentVersion: consentVersion ?? '1.0.0'
				}
			:	{})
		})
		const createDuration = Date.now() - t0 - hashDuration
		if (createUser.status.error || !createUser.result) {
			return createUser
		}
		const t1 = Date.now()
		await this.createVerificationLink(createUser.result.toString())
		const linkDuration = Date.now() - t1
		log.debug('Signup timings', 'UserService/signUp', {
			hashDuration,
			createDuration,
			linkDuration
		})
		const userResult = await this.dao.read(createUser.result!)
		if (userResult.result && userResult.status.error === false) {
			return this.generateTokens(userResult.result, { loginMethod: SignupType.email, userAgent })
		} else {
			return new Result(true, ErrorCode.InternalServerError, 'Error in creating user')
		}
	}

	async resendVerifyEmail(userId: string) {
		if (!userId) {
			return new Result(true, ErrorCode.BadRequest, 'Invalid user id')
		}
		return this.createVerificationLink(userId)
	}

	async createVerificationLink(userId: string, redirectionLink?: string) {
		try {
			const user = await this.dao.read(userId)
			if (!user.result) return user
			const nonce = crypto.randomBytes(64).toString('base64')
			const signString = crypto.createHash('sha256')
			signString.update(user.result?.email + nonce)
			const signature = signString.digest('hex')
			const generatedAt = new Date()

			const { connection } = await RedisDatabaseObject

			const result = await connection.hset(`email-verify:${signature}`, {
				email: user.result.email,
				userId,
				redirectionLink,
				generatedAt: generatedAt.toISOString()
			})

			const expire = await connection.expire(`email-verify:${signature}`, 604800, 'NX')
			log.debug('Email verification creation result', 'createVerificationLink', {
				result,
				expire
			})
			// Send email verification email commented out as email services are removed
			/*
      this.emailService.sendTemplateEmail(
        {
          templateName: EjsTemplates.emailVerification,
          params: {
            firstname: user.result?.firstname || "User",
            lastname: user.result?.lastname || "User",
            verificationLink: `${settings.frontEndUrl}/verify-email/${signature}`,
            termsLink: `${settings.frontEndUrl}/terms-and-conditions`,
            privacyLink: `${settings.frontEndUrl}/privacy-policy`,
          },
        },
        { to: [user.result.email] }
      );
      */

			return new Result(false, ErrorCode.Success, 'Generated email verification string', signature)
		} catch (error) {
			log.error(
				'Error in generating verification string',
				'UserService.createVerificationLink',
				error,
				{
					userId
				}
			)
			return new Result(
				true,
				ErrorCode.InternalServerError,
				'Error in generating verification string'
			)
		}
	}

	async verifyEmail(signingString: string): Promise<Result<{ link: string }>> {
		try {
			const { connection } = await RedisDatabaseObject
			const data = await connection.hgetAll(`email-verify:${signingString}`)

			if (data) {
				const userId = data.userId
				log.debug('Data in redis', 'verifyEmail', { data, signingString })
				// if (!data.redirectionLink) {
				//   log.warn("Invalid data in redis ", "verifyEmail", { userId });
				//   return new Result(
				//     true,
				//     ErrorCode.BadRequest,
				//     "Error in verifying email"
				//   );
				// }
				if (!userId) {
					log.warn('Invalid data in redis ', 'verifyEmail', { userId })
					return new Result(true, ErrorCode.BadRequest, 'Error in verifying email')
				}
				const userResult = await this.dao.read(userId)
				if (!userResult.result || !userResult.result.isActive || userResult.result.isSoftDeleted) {
					return new Result(true, ErrorCode.BadRequest, 'User not found')
				}
				if (data.email !== userResult.result.email) {
					log.warn('Email mismatch during verification', 'UserService.verifyEmail', {
						userId,
						storedEmail: data.email
					})
					return new Result(true, ErrorCode.BadRequest, 'Error in verifying email')
				}
				await this.dao.update(userId, {
					emailVerified: true
				})
				// Send welcome email commented out as email services are removed
				/*
          this.emailService.sendTemplateEmail(
            {
              templateName: EjsTemplates.welcome,
              params: {
                firstname: userResult.result.firstname || "",
                lastname: userResult.result.lastname || "",
                termsLink: `${settings.frontEndUrl}/terms-and-conditions`,
                privacyLink: `${settings.frontEndUrl}/privacy-policy`,
                websiteLink: `${settings.frontEndUrl}`,
              },
            },
            { to: [userResult.result.email || data.email] }
          );
          */
				await connection.del(`email-verify:${signingString}`)

				return new Result(false, ErrorCode.Success, 'Verified email', {
					link: data.redirectionLink,
					userId
				})
			} else {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid email used')
			}
		} catch (error) {
			log.error('Error in verifying email', 'UserService.verifyEmail', error, {
				signingString
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error in verifying email')
		}
	}

	async generateTokens(
		user: User,
		options: { loginMethod: SignupType | 'email'; userAgent?: string } = { loginMethod: 'email' }
	) {
		const tid = crypto.randomUUID()
		const refreshTokenId = crypto.randomUUID()
		const tokenExpiry = settings.jwtTokenExpiry
		const refreshExpiry = settings.jwtRefreshExpiry
		const now = Date.now()

		const { password, ...safeUser } = user
		const token = jwt.sign(
			{
				...safeUser,
				type: user.userType,
				userId: user.id,
				tid
			},
			settings.jwtSecretKey,
			{ algorithm: 'HS256', expiresIn: tokenExpiry }
		)

		const refreshToken = jwt.sign({ tid: refreshTokenId }, settings.refreshSecretKey, {
			algorithm: 'HS256',
			expiresIn: refreshExpiry
		})

		const { connection } = await RedisDatabaseObject
		const sessionKey = `user-sessions:${user.id}`

		// Store the refresh token → userId mapping
		await connection.set(`refresh-token:${refreshTokenId}`, user.id, 'EX', refreshExpiry)

		// Store per-session metadata (loginMethod, userAgent, loginTime, accessTid for denylist)
		const metaKey = `session-meta:${refreshTokenId}`
		const metaFields: string[] = [
			'loginTime',
			String(now),
			'loginMethod',
			options.loginMethod,
			'accessTid',
			tid
		]
		if (options.userAgent) {
			metaFields.push('userAgent', options.userAgent)
		}
		await connection.hset(metaKey, metaFields)
		await connection.expire(metaKey, refreshExpiry)

		// Add to user ZSET (score = login timestamp) and evict oldest if over limit
		await connection.zadd(sessionKey, now, refreshTokenId)
		await connection.expire(sessionKey, refreshExpiry, 'GT')

		const sessionCount = await connection.zcard(sessionKey)
		if (sessionCount > settings.maxSessionsPerUser) {
			// ZPOPMIN returns [member, score, member, score, ...]
			const evicted = await connection.zpopmin(
				sessionKey,
				sessionCount - settings.maxSessionsPerUser
			)
			for (let i = 0; i < evicted.length; i += 2) {
				const evictedTid = evicted[i]
				await connection.del(`refresh-token:${evictedTid}`, `session-meta:${evictedTid}`)
				log.debug('Session evicted (max devices)', 'UserService.generateTokens', {
					userId: user.id,
					evictedTid
				})
			}
		}

		return new Result(false, ErrorCode.Success, 'Success', {
			accessToken: token,
			refreshToken,
			expiresIn: tokenExpiry,
			refreshExpiresIn: refreshExpiry,
			type: 'Bearer'
		})
	}

	async refreshToken(token: string) {
		try {
			const decodeToken = jwt.verify(token, settings.refreshSecretKey, {
				algorithms: ['HS256']
			}) as { tid: string }

			const { connection } = await RedisDatabaseObject

			const refreshData = await connection.get(`refresh-token:${decodeToken.tid}`)
			if (!refreshData) {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid Token')
			}

			// Preserve the old session's metadata before rotating
			const oldMeta = await connection.hgetAll(`session-meta:${decodeToken.tid}`)

			// Rotate: delete old token + ZSET entry + meta
			await connection.del(`refresh-token:${decodeToken.tid}`, `session-meta:${decodeToken.tid}`)
			await connection.zrem(`user-sessions:${refreshData}`, decodeToken.tid)

			const user = await this.dao.read(refreshData)
			if (user.status.error || !user.result || !user.result.isActive || user.result.isSoftDeleted) {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid Token')
			}

			const loginMethod = (oldMeta?.loginMethod as SignupType | 'email') ?? 'email'
			const userAgent = oldMeta?.userAgent as string | undefined
			return this.generateTokens(user.result, { loginMethod, userAgent })
		} catch (e) {
			log.error('Error Refreshing token', 'UserService.refreshToken', e)
			return new Result(true, ErrorCode.InternalServerError, 'Unknown Error Occured')
		}
	}

	async invalidateToken(token: string) {
		try {
			const decodeToken = jwt.verify(token, settings.refreshSecretKey, {
				algorithms: ['HS256']
			}) as { tid: string }

			const { connection } = await RedisDatabaseObject

			const userId = await connection.get(`refresh-token:${decodeToken.tid}`)
			await connection.del(`refresh-token:${decodeToken.tid}`, `session-meta:${decodeToken.tid}`)
			if (userId) {
				await connection.zrem(`user-sessions:${userId}`, decodeToken.tid)
			}
			return new Result(false, ErrorCode.Success, 'Success')
		} catch (e) {
			log.error('Error Invalidating token', 'UserService.invalidateToken', e)
			return new Result(true, ErrorCode.InternalServerError, 'Unknown Error Occured')
		}
	}

	/**
	 * Revokes all active refresh tokens for a user.
	 * Called on password change, forgot-password, and account deletion.
	 */
	private async revokeAllSessions(userId: string) {
		try {
			const { connection } = await RedisDatabaseObject
			const sessionKey = `user-sessions:${userId}`
			// ZRANGEWITHSCORES returns flat [member, score, member, score, ...] — we only need members
			const raw = await connection.zrangeWithScores(sessionKey, 0, -1)
			const tids: string[] = []
			for (let i = 0; i < raw.length; i += 2) tids.push(raw[i])
			if (tids.length > 0) {
				// Denylist all active access tokens immediately
				for (const tid of tids) {
					const meta = await connection.hgetAll(`session-meta:${tid}`)
					if (meta?.accessTid) {
						await connection.set(
							`revoked-access:${meta.accessTid}`,
							'1',
							'EX',
							settings.jwtTokenExpiry
						)
					}
				}
				const keysToDelete = tids.flatMap((tid: string) => [
					`refresh-token:${tid}`,
					`session-meta:${tid}`
				])
				await connection.del(...(keysToDelete as [string, ...string[]]))
			}
			await connection.del(sessionKey)
			log.debug('All sessions revoked', 'UserService.revokeAllSessions', {
				userId,
				count: tids.length
			})
		} catch (error) {
			log.error('Error revoking sessions', 'UserService.revokeAllSessions', error, { userId })
		}
	}

	/**
	 * Lists all active sessions for a user, including login time, method, and user agent.
	 */
	async listSessions(userId: string) {
		try {
			const { connection } = await RedisDatabaseObject
			const sessionKey = `user-sessions:${userId}`
			// flat array: [tid0, score0, tid1, score1, ...]
			const raw = await connection.zrangeWithScores(sessionKey, 0, -1)
			const sessions: {
				tid: string
				loginTime: number
				loginMethod: string
				userAgent?: string
			}[] = []
			for (let i = 0; i < raw.length; i += 2) {
				const tid = raw[i]
				const score = Number(raw[i + 1])
				const meta = await connection.hgetAll(`session-meta:${tid}`)
				sessions.push({
					tid,
					loginTime: meta?.loginTime ? Number(meta.loginTime) : score,
					loginMethod: meta?.loginMethod ?? 'email',
					...(meta?.userAgent ? { userAgent: meta.userAgent } : {})
				})
			}
			// Return newest first
			sessions.sort((a, b) => b.loginTime - a.loginTime)
			return new Result(false, ErrorCode.Success, 'Success', sessions)
		} catch (error) {
			log.error('Error listing sessions', 'UserService.listSessions', error, { userId })
			return new Result(true, ErrorCode.InternalServerError, 'Error listing sessions')
		}
	}

	/**
	 * Revokes a single session by tid, verifying it belongs to the target user or caller (admin/ops).
	 */
	async revokeSession(targetUserId: string, tid: string, callerId?: string) {
		try {
			const { connection } = await RedisDatabaseObject
			// Verify this session belongs to the user before revoking
			const storedUserId = await connection.get(`refresh-token:${tid}`)
			if (!storedUserId || (storedUserId !== targetUserId && storedUserId !== callerId)) {
				return new Result(true, ErrorCode.NotAuthorized, 'Session not found or not owned by user')
			}
			// Denylist the access token so it is immediately rejected even before it expires
			const meta = await connection.hgetAll(`session-meta:${tid}`)
			if (meta?.accessTid) {
				await connection.set(`revoked-access:${meta.accessTid}`, '1', 'EX', settings.jwtTokenExpiry)
			}
			await connection.del(`refresh-token:${tid}`, `session-meta:${tid}`)
			await connection.zrem(`user-sessions:${storedUserId}`, tid)
			log.debug('Session revoked', 'UserService.revokeSession', { userId: storedUserId, tid })
			return new Result(false, ErrorCode.Success, 'Session revoked')
		} catch (error) {
			log.error('Error revoking session', 'UserService.revokeSession', error, { targetUserId, tid })
			return new Result(true, ErrorCode.InternalServerError, 'Error revoking session')
		}
	}

	async forgotPasswordGetOTP(email: string) {
		const normalizedEmail = email.toLowerCase()
		const user = await this.dao.read({ where: { email: normalizedEmail } })
		if (user.status.error || !user.result || !user.result.isActive || user.result.isSoftDeleted) {
			return new Result(true, ErrorCode.NotFound, 'User not found')
		}

		if (user.result.emailVerified) {
			const otp = process.env.NODE_ENV === 'production' ? Date.now().toString().slice(-6) : '123456'
			const { connection } = await RedisDatabaseObject
			await connection.set(`reset-password:${normalizedEmail}`, otp, 'EX', 15 * 60)
			// Send OTP email commented out as email services are removed
			/*
      const sentResult = await this.emailService.sendTemplateEmail(
        {
          templateName: EjsTemplates.forgotPasswordOtp,
          params: {
            otp: otp,
            privacyLink: `${settings.frontEndUrl}/privacy-policy`,
            termsLink: `${settings.frontEndUrl}/terms-and-conditions`,
          },
        },
        { to: [user.result.email] }
      );

      if (sentResult.status.error) {
        return new Result(true, ErrorCode.InternalServerError, "Error in sending OTP");
      }
      */
			return new Result(false, ErrorCode.Success, 'Successfully sent OTP')
		} else {
			await this.createVerificationLink(user.result.id)
			return new Result(
				true,
				ErrorCode.NoUpdatesPerformed,
				'A Verification Email is sent, Please verify your email.'
			)
		}
	}

	async forgotPasswordChange(email: string, otp: string, newPassword: string) {
		try {
			const normalizedEmail = email.toLowerCase()
			const { connection } = await RedisDatabaseObject
			const otpRead = await connection.get(`reset-password:${normalizedEmail}`)
			if (!otpRead || otp !== otpRead) {
				return new Result(true, ErrorCode.BadRequest, 'Incorrect OTP')
			}
			const hashedPassword = this.hashPassword(newPassword)
			await connection.del(`reset-password:${normalizedEmail}`)
			const updateResult = await this.dao.update(
				{ email: normalizedEmail },
				{ password: hashedPassword }
			)
			if (updateResult.status.error) {
				return updateResult
			}
			// Look up userId to revoke sessions — email-based update doesn't return the id directly
			const userResult = await this.dao.read({ where: { email: normalizedEmail } })
			if (userResult.result) {
				await this.revokeAllSessions(userResult.result.id)
			}
			return updateResult
		} catch (error) {
			log.error('Error in forgotPasswordChange', 'UserService.forgotPasswordChange', error, {
				email
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error in changing password')
		}
	}

	async resetPassword(userId: string, oldPassword: string, newPassword: string) {
		try {
			const user = await this.dao.read(userId)
			if (user.status.error || !user.result) return user
			const oldHash = await bcrypt.compare(oldPassword, user.result.password)
			if (!oldHash) {
				return new Result(true, ErrorCode.NotAuthorized, 'Incorrect password')
			}
			const newHash = this.hashPassword(newPassword)
			const updateResult = await this.dao.update(user.result.id, { password: newHash })
			if (updateResult.status.error) {
				return updateResult
			}
			// Revoke all sessions — user must re-authenticate after a password change
			await this.revokeAllSessions(userId)
			return updateResult
		} catch (error) {
			log.error('Error resetting password', 'UserService.resetPassword', error, { userId })
			return new Result(true, ErrorCode.InternalServerError, 'Error resetting password')
		}
	}

	async create(
		value: _QueryDeepPartialEntity<User> | _QueryDeepPartialEntity<User>[],
		manager?: EntityManager
	): Promise<Result<number | string | null>> {
		if (Array.isArray(value)) {
			for (const v of value) {
				if (!v.password) return new Result(true, ErrorCode.BadRequest, 'Password is required')
				v.password = this.hashPassword(v.password as string)
			}
		} else {
			if (!value.password) return new Result(true, ErrorCode.BadRequest, 'Password is required')
			value.password = this.hashPassword(value.password as string)
		}
		return super.create(value, manager)
	}

	async readOne<S extends FindOptionsSelect<User> | undefined = undefined>(
		filter: string | number | (Omit<FindOneOptions<User>, 'select'> & { select?: S }),
		manager?: EntityManager
	): Promise<Result<SelectedRead<User, S> | null>> {
		const context = ContextProvider.getContext()
		const values = context?.values

		const result = await super.readOne(filter, manager)

		if (!result.result || !values) {
			return result
		}

		const userResult = result.result as unknown as User
		if (values.userType === UserType.user && userResult?.id !== values.id) {
			return new Result(
				true,
				ErrorCode.NotAuthorized,
				'Not Authorized'
			) as unknown as Result<SelectedRead<User, S> | null>
		}
		return result
	}

	async update(
		id: string | number | FindOptionsWhere<User>,
		values: {
			id?: string | (() => string) | undefined
			firstName?: (() => string) | (string | undefined)
			lastName?: (() => string) | (string | undefined)
			email?: string | (() => string) | undefined
			emailVerified?: (() => string) | boolean | undefined
			password?: string | (() => string) | undefined
			userType?: (() => string) | UserType | undefined
			isActive?: boolean | undefined
			phoneNumber?: (() => string) | (string | undefined)
			countryCode?: (() => string) | (string | undefined)
		},
		manager?: EntityManager
	): Promise<Result<number | null>> {
		const context = ContextProvider.getContext().values
		if (!context?.userType) {
			return new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
		}

		if (values.isActive === false) {
			const targetUserId =
				typeof id === 'string' ? id
				: typeof id === 'number' ? id.toString()
				: undefined
			if (targetUserId) {
				await this.revokeAllSessions(targetUserId)
			}
		}

		if (context.userType === UserType.admin) {
			if (values.password) {
				values.password = this.hashPassword(values.password as string)
			}
			return super.update(id, values, manager)
		}
		delete values.password
		delete values.userType
		delete values.emailVerified
		delete values.email
		return super.update(id, values, manager)
	}

	async googleAccessTokenCallback(
		accessToken: string,
		firstName?: string,
		lastName?: string,
		userAgent?: string
	) {
		try {
			const response = await fetch(settings.gcpLoginCreds.userInfoUrl, {
				headers: { Authorization: `Bearer ${accessToken}` }
			})

			if (!response.ok) {
				const errorPayload = await response.json().catch(() => ({}))
				log.warn('Google user info fetch failed', 'googleAccessTokenCallback', { errorPayload })
				return new Result(true, ErrorCode.NotAuthorized, 'Failed to fetch user info from Google')
			}

			const userInfo = (await response.json()) as IGCPUserInfo

			if (!userInfo || !userInfo.email) {
				return new Result(
					true,
					ErrorCode.BadRequest,
					'Invalid user information received from Google'
				)
			}

			const email = userInfo.email.toLowerCase()

			const userCheck = await this.dao.read({
				where: { email, isSoftDeleted: false }
			})

			if (userCheck.result) {
				let needsUpdate = false
				const updatePayload: Partial<User> = {}

				if (!userCheck.result.isActive) {
					updatePayload.isActive = true
					userCheck.result.isActive = true
					needsUpdate = true
				}
				if (!userCheck.result.emailVerified) {
					updatePayload.emailVerified = true
					userCheck.result.emailVerified = true
					needsUpdate = true
				}
				if (!userCheck.result.googleUserId) {
					updatePayload.googleUserId = userInfo.id
					userCheck.result.googleUserId = userInfo.id
					needsUpdate = true
				}
				if (
					!userCheck.result.firstName &&
					(firstName || userInfo.given_name || userInfo.name?.split(' ')[0])
				) {
					const fName = firstName || userInfo.given_name || userInfo.name?.split(' ')[0]
					updatePayload.firstName = fName
					userCheck.result.firstName = fName
					needsUpdate = true
				}
				if (
					!userCheck.result.lastName &&
					(lastName || userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' '))
				) {
					const lName =
						lastName || userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ')
					updatePayload.lastName = lName
					userCheck.result.lastName = lName
					needsUpdate = true
				}

				if (needsUpdate) {
					await this.dao.update(userCheck.result.id, updatePayload)
				}

				const tokens = await this.generateTokens(userCheck.result, {
					loginMethod: SignupType.google,
					userAgent
				})
				return new Result(false, ErrorCode.Success, 'Success', {
					userExists: true,
					skipReg: true,
					tokens: tokens.result
				})
			} else {
				const randomPassword = crypto.randomBytes(16).toString('hex')
				const hashedPassword = this.hashPassword(randomPassword)

				const userCreate = await this.dao.create({
					email,
					firstName: firstName || userInfo.given_name || userInfo.name?.split(' ')[0] || undefined,
					lastName:
						lastName ||
						userInfo.family_name ||
						userInfo.name?.split(' ').slice(1).join(' ') ||
						undefined,
					emailVerified: true,
					googleUserId: userInfo.id,
					userType: UserType.user,
					signupType: SignupType.google,
					password: hashedPassword,
					consentAt: new Date(),
					consentVersion: '1.0.0',
					consentGiven: true
				})

				if (userCreate.result && typeof userCreate.result === 'string') {
					const userData = await this.dao.read(userCreate.result)
					if (!userData.result) {
						return new Result(true, ErrorCode.InternalServerError, 'Error in creating user')
					}
					const tokens = await this.generateTokens(userData.result, {
						loginMethod: SignupType.google,
						userAgent
					})
					return new Result(false, ErrorCode.Success, 'Success', {
						userExists: false,
						email,
						name: userInfo.name,
						firstName: userData.result.firstName,
						lastName: userData.result.lastName,
						userId: userCreate.result,
						tokens: tokens.result
					})
				} else {
					return new Result(true, ErrorCode.InternalServerError, 'Error in creating user')
				}
			}
		} catch (error) {
			log.error('Error in google access token callback', 'googleAccessTokenCallback', error)
			return new Result(
				true,
				ErrorCode.InternalServerError,
				'Error in google access token callback'
			)
		}
	}

	async handleAppleIdToken(
		idToken: string,
		firstName?: string,
		lastName?: string,
		userAgent?: string
	) {
		try {
			const verifiedToken = await verifyAppleIdToken(idToken)
			if (!verifiedToken) {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid or expired Apple ID token')
			}
			const appleUserId = verifiedToken.sub
			const userEmail = verifiedToken.email?.toLowerCase()

			const filters: FindOptionsWhere<User>[] = []
			filters.push({ appleUserId })
			if (userEmail) {
				filters.push({ email: userEmail })
			}

			const userCheck = await this.dao.read({ where: filters })

			if (userCheck.result) {
				let needsUpdate = false
				const updatePayload: Partial<User> = {}

				if (!userCheck.result.isActive) {
					updatePayload.isActive = true
					userCheck.result.isActive = true
					needsUpdate = true
				}
				if (!userCheck.result.appleUserId) {
					updatePayload.appleUserId = appleUserId
					userCheck.result.appleUserId = appleUserId
					needsUpdate = true
				}
				if (!userCheck.result.firstName && firstName) {
					const fName = firstName
					updatePayload.firstName = fName
					userCheck.result.firstName = fName
					needsUpdate = true
				}
				if (!userCheck.result.lastName && lastName) {
					const lName = lastName
					updatePayload.lastName = lName
					userCheck.result.lastName = lName
					needsUpdate = true
				}

				if (needsUpdate) {
					await this.dao.update(userCheck.result.id, updatePayload)
				}

				const token = await this.generateTokens(userCheck.result, {
					loginMethod: SignupType.apple,
					userAgent
				})
				return new Result(false, ErrorCode.Success, 'Success', {
					userExists: true,
					tokens: token.result
				})
			} else {
				if (!userEmail) {
					return new Result(
						true,
						ErrorCode.BadRequest,
						'Email is required to register a new user via Apple'
					)
				}
				const randomPassword = crypto.randomBytes(16).toString('hex')
				const hashedPassword = this.hashPassword(randomPassword)
				const userCreate = await this.dao.create({
					email: userEmail,
					emailVerified: true,
					appleUserId,
					password: hashedPassword,
					firstName: firstName,
					lastName: lastName,
					userType: UserType.user,
					signupType: SignupType.apple,
					consentAt: new Date(),
					consentVersion: '1.0.0',
					consentGiven: true
				})

				if (userCreate.result && typeof userCreate.result === 'string') {
					const userData = await this.dao.read(userCreate.result)
					if (!userData.result) {
						return new Result(true, ErrorCode.InternalServerError, 'Error in creating user')
					}
					const tokens = await this.generateTokens(userData.result, {
						loginMethod: SignupType.apple,
						userAgent
					})
					return new Result(false, ErrorCode.Success, 'Success', {
						userExists: false,
						email: userEmail,
						firstName: userData.result.firstName,
						lastName: userData.result.lastName,
						userId: userCreate.result,
						tokens: tokens.result
					})
				} else {
					return new Result(true, ErrorCode.InternalServerError, 'Error in creating user')
				}
			}
		} catch (error) {
			log.error('Error in handleAppleIdToken', 'handleAppleIdToken', error)
			return new Result(true, ErrorCode.InternalServerError, 'Error in handleAppleIdToken')
		}
	}
}
