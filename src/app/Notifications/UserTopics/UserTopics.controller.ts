import {
	Application,
	Controller,
	Documentation,
	ErrorCode,
	Methods,
	Result,
	ServiceController
} from '@smoke-trees/postgres-backend'
import { Request, Response } from 'express'
import { UserTopics } from './UserTopics.entity'
import { UserTopicsService } from './UserTopics.service'
import { inject, injectable } from 'inversify'
import { AuthMiddleware } from '../../../middleware/authMiddleware'

@injectable()
export class UserTopicsController extends ServiceController<UserTopics> {
	path: string = '/user-topics'
	protected controllers: Controller[] = []
	protected mw = []
	service: UserTopicsService
	constructor(
		@inject(Application)
		app: Application,
		@inject(UserTopicsService)
		service: UserTopicsService,
		@inject(AuthMiddleware)
		readonly authMiddleware: AuthMiddleware
	) {
		super(app, UserTopics, service, undefined, {
			create: [authMiddleware.generateAuthMiddleWare({})],
			read: [authMiddleware.generateAuthMiddleWare({})],
			readMany: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			delete: [authMiddleware.generateAuthMiddleWare({})]
		})
		this.service = service
		this.addRoutes(
			{
				path: '/subscribe',
				method: Methods.POST,
				handler: this.subscribeHandler.bind(this),
				localMiddleware: [authMiddleware.generateAuthMiddleWare({})]
			},
			{
				path: '/unsubscribe',
				method: Methods.POST,
				handler: this.unsubscribeHandler.bind(this),
				localMiddleware: [authMiddleware.generateAuthMiddleWare({})]
			},
			{
				path: '/user/:userId',
				method: Methods.GET,
				handler: this.getUserTopicsHandler.bind(this),
				localMiddleware: [authMiddleware.generateAuthMiddleWare({})]
			},
			{
				path: '/topic/:topicName',
				method: Methods.GET,
				handler: this.getTopicUsersHandler.bind(this),
				localMiddleware: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })]
			}
		)
		this.loadDocumentation()
	}

	@Documentation.addRoute({
		path: '/user-topics/subscribe',
		tags: ['UserTopics'],
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
				userId: { type: 'string', format: 'uuid' },
				topicName: { type: 'string' }
			},
			required: ['userId', 'topicName']
		}
	})
	async subscribeHandler(req: Request, res: Response) {
		const { userId, topicName } = req.body
		if (!userId || !topicName) {
			const result = new Result(true, ErrorCode.BadRequest, 'userId and topicName are required')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.subscribe(userId, topicName)
		res.status(result.getStatus()).json(result)
	}

	@Documentation.addRoute({
		path: '/user-topics/unsubscribe',
		tags: ['UserTopics'],
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
				userId: { type: 'string', format: 'uuid' },
				topicName: { type: 'string' }
			},
			required: ['userId', 'topicName']
		}
	})
	async unsubscribeHandler(req: Request, res: Response) {
		const { userId, topicName } = req.body
		if (!userId || !topicName) {
			const result = new Result(true, ErrorCode.BadRequest, 'userId and topicName are required')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.unsubscribe(userId, topicName)
		res.status(result.getStatus()).json(result)
	}

	@Documentation.addRoute({
		path: '/user-topics/user/{userId}',
		tags: ['UserTopics'],
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
	async getUserTopicsHandler(req: Request, res: Response) {
		const { userId } = req.params
		if (!userId) {
			const result = new Result(true, ErrorCode.BadRequest, 'userId is required')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.getUserTopics(userId)
		res.status(result.getStatus()).json(result)
	}

	@Documentation.addRoute({
		path: '/user-topics/topic/{topicName}',
		tags: ['UserTopics'],
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
				name: 'topicName',
				in: 'path',
				required: true
			}
		]
	})
	async getTopicUsersHandler(req: Request, res: Response) {
		const { topicName } = req.params
		if (!topicName) {
			const result = new Result(true, ErrorCode.BadRequest, 'topicName is required')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.getTopicUsers(topicName)
		res.status(result.getStatus()).json(result)
	}
}
