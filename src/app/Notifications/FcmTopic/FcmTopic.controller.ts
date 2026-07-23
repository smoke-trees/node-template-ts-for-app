import {
	Application,
	Controller,
	Documentation,
	Methods,
	Result,
	ServiceController
} from '@smoke-trees/postgres-backend'
import { Request, Response } from 'express'
import { FcmTopic } from './FcmTopic.entity'
import { FcmTopicService } from './FcmTopic.service'
import { inject, injectable } from 'inversify'
import { AuthMiddleware } from '../../../middleware/authMiddleware'

@injectable()
export class FcmTopicController extends ServiceController<FcmTopic> {
	path: string = '/fcm-topics'
	protected controllers: Controller[] = []
	protected mw = []
	service: FcmTopicService
	constructor(
		@inject(Application)
		app: Application,
		@inject(FcmTopicService)
		service: FcmTopicService,
		@inject(AuthMiddleware)
		readonly authMiddleware: AuthMiddleware
	) {
		super(app, FcmTopic, service, undefined, {
			create: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			update: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			delete: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			read: [],
			readMany: [],
			readManyWithoutPagination: []
		})
		this.service = service
		this.addRoutes({
			path: '/seed',
			method: Methods.GET,
			handler: this.seedTopicsHandler.bind(this),
			localMiddleware: []
		})
		this.loadDocumentation()
	}

	@Documentation.addRoute({
		path: '/fcm-topics/seed',
		tags: ['FcmTopic'],
		method: Methods.POST,
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			}
		}
	})
	async seedTopicsHandler(_req: Request, res: Response) {
		const result = await this.service.seedDefaults()
		res.status(result.getStatus()).json(result)
	}
}
