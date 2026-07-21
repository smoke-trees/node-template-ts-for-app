import { ErrorCode, Result, log } from '@smoke-trees/postgres-backend'
import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ContextProvider } from '@smoke-trees/smoke-context'
import { FindOptionsWhere, MoreThan, MoreThanOrEqual } from 'typeorm'
import { ParsedQs } from 'qs'
import { inject, injectable } from 'inversify'
import { UserType } from '../app/User/IUser'
import { UserDao } from '../app/User/User.dao'
import settings from '../settings'
import { RedisDatabaseObject } from '../redis/redis-connection'

@injectable()
export class AuthMiddleware {
	userDao: UserDao
	constructor(
		@inject(UserDao)
		userDao: UserDao
	) {
		this.userDao = userDao
	}

	generateAuthMiddleWare({
		adminOnly = false,
		opsOnly = false,
		contextOnly = false,
		userIdLoc,
		opsBypass = false,
		optionalToken = false
	}: {
		adminOnly?: boolean
		opsBypass?: boolean
		opsOnly?: boolean
		// eslint-disable-next-line @typescript-eslint/ban-types
		userIdLoc?: (req: Request) => string | ParsedQs | string[] | ParsedQs[] | undefined
		contextOnly?: boolean
		optionalToken?: boolean
	}) {
		return async (req: Request, res: Response, next: NextFunction) => {
			try {
				const token = req.get('Authorization')?.split(' ')[1]

				if (!token) {
					if (optionalToken) {
						next()
						return
					}
					const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
					res.status(result.getStatus()).json(result)
					return
				}
				const tokenDecode = jwt.verify(token, settings.jwtSecretKey, {
					algorithms: ['HS256']
				}) as { id?: string; userId?: string; tid?: string }

				// Check access token denylist — catches revoked sessions within the token's remaining lifetime
				if (tokenDecode.tid) {
					const { connection } = await RedisDatabaseObject
					const isRevoked = await connection.get(`revoked-access:${tokenDecode.tid}`)
					if (isRevoked) {
						const result = new Result(true, ErrorCode.NotAuthorized, 'Session has been revoked')
						res.status(result.getStatus()).json(result)
						return
					}
				}

				const tokenUserId = tokenDecode.userId ?? tokenDecode.id
				if (!tokenUserId) {
					const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
					res.status(result.getStatus()).json(result)
					return
				}
				const user = await this.userDao.read(tokenUserId)
				if (
					user.status.error ||
					!user.result ||
					!user.result.isActive ||
					user.result.isSoftDeleted
				) {
					const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
					res.status(result.getStatus()).json(result)
					return
				}
				ContextProvider.setContext({
					values: user?.result
				})
				if (contextOnly) {
					next()
					return
				}

				if (user.result.userType === UserType.admin) {
					next()
					return
				}
				if (opsBypass && user.result.userType === UserType.ops) {
					next()
					return
				}
				if (adminOnly) {
					const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
					res.status(result.getStatus()).json(result)
					return
				}
				// if (user.result.userType === UserType.ops) {
				//   next();
				// }
				if (opsOnly) {
					if (user.result.userType !== UserType.ops) {
						const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
						res.status(result.getStatus()).json(result)
						return
					}
				}

				if (userIdLoc) {
					const userId = userIdLoc(req)
					if (!userId) {
						const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
						res.status(result.getStatus()).json(result)
						return
					}
					if (userId !== tokenUserId) {
						const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
						res.status(result.getStatus()).json(result)
						return
					}
				}

				next()
				return
			} catch (error) {
				log.error('Error in middleware', 'AuthMiddleware.generateAuthMiddleware', error)
				const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
				res.status(result.getStatus()).json(result)
				return
			}
		}
	}
}
