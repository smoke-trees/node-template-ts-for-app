import {
	Application,
	Controller,
	Documentation,
	ErrorCode,
	log,
	Methods,
	Result,
	ServiceController
} from '@smoke-trees/postgres-backend'
import { Response, Request, text } from 'express'
import { User } from './User.entity'
import { UserService } from './User.service'
import { passwordRegex } from './IUser'
import { FindOptionsWhere, In } from 'typeorm'
import { inject, injectable } from 'inversify'
import { AuthMiddleware } from '../../middleware/authMiddleware'
import { ContextProvider } from '@smoke-trees/smoke-context'
import { UserType } from './IUser'

@injectable()
export class UserController extends ServiceController<User> {
	path: string = '/user'
	protected controllers: Controller[] = []
	protected mw = []
	service: UserService
	constructor(
		@inject(Application)
		app: Application,
		@inject(UserService)
		service: UserService,
		@inject(AuthMiddleware)
		readonly authMiddleware: AuthMiddleware
	) {
		super(app, User, service, undefined, {
			create: [authMiddleware.generateAuthMiddleWare({ opsOnly: true })],
			update: [
				authMiddleware.generateAuthMiddleWare({
					userIdLoc: (req: Request) => req.params.id,
					opsBypass: true
				})
			],
			delete: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			read: [
				authMiddleware.generateAuthMiddleWare({
					userIdLoc: (req: Request) => req.params.id,
					opsBypass: true
				})
			],
			readMany: [authMiddleware.generateAuthMiddleWare({ opsOnly: true })],
			readManyWithoutPagination: [authMiddleware.generateAuthMiddleWare({ opsOnly: true })]
		})
		this.service = service
		this.addRoutes(
			{
				path: '/sign-up',
				method: Methods.POST,
				handler: this.signupHandler.bind(this),
				localMiddleware: []
			},
			{
				path: '/login',
				method: Methods.POST,
				handler: this.loginHandler.bind(this),
				localMiddleware: []
			},
			{
				path: '/refresh-token',
				method: Methods.POST,
				handler: this.refreshTokenHandler.bind(this),
				localMiddleware: []
			},
			{
				path: '/reset-password',
				method: Methods.POST,
				handler: this.resetPasswordHandler.bind(this),
				localMiddleware: [
					authMiddleware.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.body.userId
					})
				]
			},

			{
				path: '/forgot-password-get-otp',
				method: Methods.POST,
				handler: this.forgotPasswordGetOtp.bind(this),
				localMiddleware: []
			},
			{
				path: '/forgot-password-change-password',
				method: Methods.POST,
				handler: this.forgotPasswordChangePassword.bind(this),
				localMiddleware: []
			},
			{
				path: '/verify-email/:signature',
				method: Methods.GET,
				handler: this.verifyEmailHandler.bind(this),
				localMiddleware: []
			},
			{
				path: '/verify-email/resend/:userId',
				method: Methods.GET,
				handler: this.resendVerifyEmailHandler.bind(this),
				localMiddleware: []
			},
			{
				path: '/get-names',
				method: Methods.GET,
				handler: this.getNamesHandler.bind(this),
				localMiddleware: [
					authMiddleware.generateAuthMiddleWare({
						adminOnly: true,
						opsBypass: true
					})
				]
			},

			{
				path: '/invalidate-token',
				method: Methods.POST,
				handler: this.invalidTokenHandler.bind(this),
				localMiddleware: []
			},
			{
				path: '/login-with-apple',
				localMiddleware: [],
				method: Methods.GET,
				handler: this.loginWithAppleUrlGetter.bind(this)
			},
			{
				path: '/google-access-token-login',
				localMiddleware: [],
				method: Methods.POST,
				handler: this.googleAccessTokenHandler.bind(this)
			},
			{
				path: '/apple-hook',
				method: Methods.POST,
				localMiddleware: [text({ type: '*/*' })],
				handler: this.appleHookHandler.bind(this)
			},
			{
				path: '/apple-id-token',
				method: Methods.POST,
				localMiddleware: [],
				handler: this.appleIdTokenHandler.bind(this)
			},
			{
				path: '/delete-account',
				method: Methods.POST,
				handler: this.deleteAccountHandler.bind(this),
				localMiddleware: [
					authMiddleware.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.body.userId
					})
				]
			},
			{
				path: '/download-data',
				method: Methods.GET,
				handler: this.downloadDataHandler.bind(this),
				localMiddleware: [
					authMiddleware.generateAuthMiddleWare({
						contextOnly: true
					})
				]
			}
		)
		this.loadDocumentation()
	}

	@Documentation.addRoute({
		path: '/user/verify-email/{signature}',
		tags: ['User'],
		method: Methods.GET,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		parameters: [
			{
				name: 'signature',
				in: 'path',
				required: true
			}
		]
	})
	async verifyEmailHandler(req: Request, res: Response) {
		const { signature } = req.params
		if (!signature) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request Params Missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.verifyEmail(signature as string)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/verify-email/resend/{userId}',
		tags: ['User'],
		method: Methods.GET,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		parameters: [
			{
				name: 'userId',
				in: 'path',
				required: true
			}
		]
	})
	async resendVerifyEmailHandler(req: Request, res: Response) {
		const { userId } = req.params
		if (!userId) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request Params Missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.resendVerifyEmail(userId as string)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/refresh-token',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				token: {
					type: 'string'
				}
			},
			required: ['token']
		}
	})
	async refreshTokenHandler(req: Request, res: Response) {
		const { token } = req.body
		if (!token) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request Params Missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.refreshToken(token)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/forgot-password-get-otp',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				email: {
					type: 'string',
					format: 'email'
				}
			},
			required: ['email']
		}
	})
	async forgotPasswordGetOtp(req: Request, res: Response) {
		const { email } = req.body
		if (!email) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.forgotPasswordGetOTP(email)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/forgot-password-change-password',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				email: {
					type: 'string',
					format: 'email'
				},
				newPassword: {
					type: 'string',
					minLength: 8
				},
				otp: {
					type: 'string',
					minLength: 6,
					maxLength: 6
				}
			},
			required: ['email', 'newPassword', 'otp']
		}
	})
	async forgotPasswordChangePassword(req: Request, res: Response) {
		const { email, newPassword, otp } = req.body
		if (!email || !newPassword || !otp) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const checkLog = !passwordRegex.test(newPassword)
		if (checkLog) {
			const result = new Result(
				true,
				ErrorCode.BadRequest,
				'Password must contain atleast: 1 upper, 1 lower alphabet, 1 number and 1 special character and be atleast 8 character long'
			)
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.forgotPasswordChange(email, otp, newPassword)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/reset-password',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				userId: {
					type: 'string'
				},
				oldPassword: {
					type: 'string'
				},
				newPassword: {
					type: 'string',
					minLength: 8
				}
			},
			required: ['userId', 'oldPassword', 'newPassword']
		}
	})
	async resetPasswordHandler(req: Request, res: Response) {
		const { userId, oldPassword, newPassword } = req.body
		if (!userId || !oldPassword || !newPassword) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		if (!passwordRegex.test(newPassword)) {
			const result = new Result(
				true,
				ErrorCode.BadRequest,
				'Password must contain atleast: 1 upper, 1 lower alphabet, 1 number and 1 special character and be atleast 8 character long'
			)
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.resetPassword(userId, oldPassword, newPassword)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/sign-up',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				email: {
					type: 'string',
					format: 'email'
				},
				password: {
					type: 'string',
					minLength: 8,
					description:
						'Password must contain at least: 1 upper, 1 lower alphabet, 1 number and 1 special character and be at least 8 characters long'
				},
				consentGiven: {
					type: 'boolean',
					description: 'DPDPA consent given by the user (must be true to process personal data)'
				},
				consentAt: {
					type: 'string',
					format: 'date-time',
					description: 'ISO timestamp of when consent was given'
				},
				consentVersion: {
					type: 'string',
					description: 'Version of the privacy notice the user consented to'
				}
			},
			required: ['email', 'password', 'consentGiven']
		}
	})
	async signupHandler(req: Request, res: Response) {
		const { email, password, consentGiven, consentAt, consentVersion } = req.body
		if (!email || !password) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		if (consentGiven !== true) {
			const result = new Result(
				true,
				ErrorCode.BadRequest,
				'Consent is required to create an account'
			)
			res.status(result.getStatus()).json(result)
			return
		}
		if (!passwordRegex.test(password)) {
			const result = new Result(
				true,
				ErrorCode.BadRequest,
				'Password must contain atleast: 1 upper, 1 lower alphabet, 1 number and 1 special character and be atleast 8 character long'
			)
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.signUp(
			email,
			password,
			true,
			consentAt ? new Date(consentAt) : new Date(),
			consentVersion ?? '1.0.0'
		)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/login',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				email: {
					type: 'string',
					format: 'email'
				},
				password: {
					type: 'string'
				}
			},
			required: ['email', 'password']
		}
	})
	async loginHandler(req: Request, res: Response) {
		const { email, password } = req.body
		if (!email || !password) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.login(email, password)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/invalidate-token',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				reftoken: {
					type: 'string'
				}
			},
			required: ['reftoken']
		}
	})
	async invalidTokenHandler(req: Request, res: Response) {
		const { reftoken } = req.body
		if (!reftoken) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}

		const result = await this.service.invalidateToken(reftoken)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/user/download-data',
		tags: ['User'],
		method: Methods.GET,
		description:
			'DPDPA data portability — export the authenticated user’s personal data (profile, consent and device information) as JSON. Admins/ops may pass ?userId= to export another user’s data.',
		responses: {
			200: {
				description: 'Success — JSON Result containing the user’s personal data',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			},
			401: {
				description: 'Not Authorized',
				value: { $ref: Documentation.getRef(Result) }
			},
			404: {
				description: 'User not found',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		parameters: [
			{
				name: 'userId',
				in: 'query',
				required: false,
				description: 'Target user id (admin/ops only). Defaults to the authenticated user.'
			}
		]
	})
	async downloadDataHandler(req: Request, res: Response) {
		try {
			const context = ContextProvider.getContext()?.values as { id?: string; type?: UserType }
			if (!context?.id) {
				const result = new Result(true, ErrorCode.NotAuthorized, 'User not authenticated')
				res.status(result.getStatus()).json(result)
				return
			}
			const requestedUserId = req.query.userId?.toString()
			const isPrivileged = context.type === UserType.admin || context.type === UserType.ops
			if (requestedUserId && !isPrivileged && requestedUserId !== context.id) {
				const result = new Result(
					true,
					ErrorCode.NotAuthorized,
					"Not authorized to export another user's data"
				)
				res.status(result.getStatus()).json(result)
				return
			}
			const targetUserId = isPrivileged && requestedUserId ? requestedUserId : context.id
			const result = await this.service.exportUserData(targetUserId)
			res.status(result.getStatus()).json(result)
		} catch (error) {
			log.error('Error exporting user data', 'UserController.downloadDataHandler', error)
			const result = new Result(true, ErrorCode.InternalServerError, 'Failed to export user data')
			res.status(result.getStatus()).json(result)
		}
	}

	@Documentation.addRoute({
		path: '/user/get-names',
		tags: ['User'],
		method: Methods.GET,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		parameters: [{ name: 'ids', in: 'query', description: 'in string or in arrays' }]
	})
	async getNamesHandler(req: Request, res: Response) {
		const userIds = req?.query?.ids
		const type = req?.query?.type

		const { order, orderBy } = req.query

		if (!userIds) {
			const filter: FindOptionsWhere<User> = {
				type: type ? (type.toString() as any) : undefined
			}

			const result = await this.service.dao.readMany({
				where: filter,
				order: (order as any) || 'DESC',
				field: (orderBy as any) || 'createdAt',
				dbOptions: { loadEagerRelations: false, select: ['firstname', 'lastname', 'id', 'type'] },
				nonPaginated: true
			})
			res.status(result.getStatus()).json(result)
			return
		} else if (Array.isArray(userIds)) {
			const result = await this.service.dao.readMany({
				where: { id: In(userIds.map((e) => e)) },
				order: 'DESC',
				field: 'createdAt',
				nonPaginated: true,

				dbOptions: { loadEagerRelations: false, select: ['firstname', 'lastname', 'id', 'type'] }
			})
			res.status(result.getStatus()).json(result)
			return
		} else {
			const result = await this.service.dao.readMany({
				where: { id: userIds.toString() },
				order: 'DESC',
				field: 'createdAt',
				dbOptions: { loadEagerRelations: false, select: ['firstname', 'lastname', 'id', 'type'] }
			})
			res.status(result.getStatus()).json(result)
			return
		}
	}

	@Documentation.addRoute({
		path: '/user/delete-account',
		tags: ['User'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				userId: {
					type: 'string'
				}
			},
			required: ['userId']
		}
	})
	async deleteAccountHandler(req: Request, res: Response) {
		const { userId } = req.body
		if (!userId) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.deleteAccount(userId)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/users/google-access-token-login',
		tags: ['User'],
		method: Methods.POST,
		requestBody: {
			type: 'object',
			properties: {
				accessToken: { type: 'string' }
			},
			required: ['accessToken']
		},
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		}
	})
	async googleAccessTokenHandler(req: Request, res: Response) {
		const { accessToken } = req.body
		if (!accessToken) {
			const result = new Result(true, ErrorCode.BadRequest, 'Req params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.googleAccessTokenCallback(accessToken)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/users/login-with-apple',
		tags: ['User'],
		method: Methods.GET,
		responses: {
			200: {
				description: 'Success',
				value: {
					$ref: Documentation.getRef(
						Result<{
							url: string
							responseType: string
							scope: string
							redirectUri: string
							clinetId: string
						}>
					)
				}
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		}
	})
	async loginWithAppleUrlGetter(req: Request, res: Response) {
		const result = await this.service.getLoginWithAppleUrl()
		res.status(result.getStatus()).json(result)
	}

	@Documentation.addRoute({
		path: '/users/apple-id-token',
		tags: ['User'],
		method: Methods.POST,
		requestBody: {
			type: 'object',
			properties: {
				code: { type: 'string' },
				fullName: { type: 'string' }
			}
		},
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			}
		}
	})
	async appleIdTokenHandler(req: Request, res: Response) {
		log.debug('Apple token', 'appleIdTokenHandler', { body: req.body })
		try {
			const idToken = req.body.idToken || req.body.identityToken || req.body.code
			if (!idToken) {
				const result = new Result(true, ErrorCode.BadRequest, 'Missing Apple identity token')
				res.status(result.getStatus()).json(result)
				return
			}
			const result = await this.service.handleAppleIdToken(idToken, req.body.fullName)
			res.status(result.getStatus()).json(result)
		} catch (error) {
			log.error('Error in appleIdTokenHandler', 'appleIdTokenHandler', error)
			const result = new Result(true, ErrorCode.InternalServerError, 'Internal Server Error')
			res.status(result.getStatus()).json(result)
		}
	}

	async appleHookHandler(req: Request, res: Response) {
		log.debug('Apple hook', 'appleHookHandler', { body: req.body, query: req.query })
		try {
			if (typeof req.body === 'string') {
				const result = await this.service.appleCallbackHandler(req.body)
				res.status(result.getStatus()).json(result)
			} else if (req.body && typeof req.body === 'object') {
				if (req.body.payload) {
					// Consent revoked webhook
					const result = await this.service.appleRevokeHandle(req.body.payload)
					res.status(result.getStatus()).json(result)
				} else if (req.body.code) {
					// OAuth callback urlencoded body parsed as object
					const params = new URLSearchParams()
					for (const key of Object.keys(req.body)) {
						params.set(key, req.body[key])
					}
					const result = await this.service.appleCallbackHandler(params.toString())
					res.status(result.getStatus()).json(result)
				} else {
					const result = new Result(true, ErrorCode.BadRequest, 'Invalid Apple hook request')
					res.status(result.getStatus()).json(result)
				}
			} else {
				const result = new Result(true, ErrorCode.BadRequest, 'Invalid request body')
				res.status(result.getStatus()).json(result)
			}
		} catch (error) {
			log.error('Error in appleHookHandler', 'appleHookHandler', error)
			const result = new Result(true, ErrorCode.InternalServerError, 'Internal Server Error')
			res.status(result.getStatus()).json(result)
		}
	}
}
