import {
	Application,
	Controller,
	Documentation,
	ErrorCode,
	Methods,
	Result,
	ServiceController
} from '@smoke-trees/postgres-backend'
import { Response, Request } from 'express'
import { User } from './User.entity'
import { UserService } from './User.service'
import { passwordRegex } from './IUser'
import { FindOptionsWhere, In, Raw } from 'typeorm'
import { inject, injectable } from 'inversify'
import { AuthMiddleware } from '../../middleware/authMiddleware'

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
			create: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			update: [
				authMiddleware.generateAuthMiddleWare({
					userIdLoc: (req: Request) => req.params.id
				})
			],
			delete: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			read: [authMiddleware.generateAuthMiddleWare({})],
			readMany: [],
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
		path: '/user/reset-subscription',
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
				purchaseId: {
					type: 'string'
				}
			},
			required: ['userId', 'purchaseId']
		}
	})
	async resetSubscriptionHandler(req: Request, res: Response) {
		const { userId, purchaseId } = req.body
		if (!userId || !purchaseId) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.resetSubscription(userId, purchaseId)
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
					description: 'Password must contain at least: 1 upper, 1 lower alphabet, 1 number and 1 special character and be at least 8 characters long'
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
			required: ['email', 'password']
		}
	})
	async signupHandler(req: Request, res: Response) {
		const { email, password, consentGiven, consentAt, consentVersion } = req.body
		if (!email || !password) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request params missing')
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
			consentGiven ?? null,
			consentAt ? new Date(consentAt) : null,
			consentVersion ?? null
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
}
