import {
	Application,
	Controller,
	Documentation,
	ErrorCode,
	Methods,
	Result,
	ServiceController
} from '@smoke-trees/postgres-backend'
import { RequestHandler, Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { Notification } from './Notification.entity'
import { FCMNotificationRequest, NotificationService } from './Notification.service'
import { IManualNotificationAdmin } from './INotification'
import { inject, injectable } from 'inversify'
import { AuthMiddleware } from '../../../middleware/authMiddleware'
import { ContextProvider } from '@smoke-trees/smoke-context'
import { UserType } from '../../User/IUser'

@injectable()
export class NotificationController extends ServiceController<Notification> {
	path = '/notification'
	protected controllers: Controller[]
	notificationService: NotificationService
	protected mw: RequestHandler<ParamsDictionary, any, any, ParsedQs, Record<string, any>>[]
	constructor(
		@inject(Application)
		app: Application,
		@inject(NotificationService)
		notificationService: NotificationService,
		@inject(AuthMiddleware)
		readonly authMiddleWare: AuthMiddleware
	) {
		super(
			app,
			Notification,
			notificationService,
			{ paths: { create: false, update: false, delete: false } },
			{
				readMany: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.query.userId?.toString()
					})
				],
				readManyWithoutPagination: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.query.userId?.toString()
					})
				]
			}
		)
		this.mw = []
		this.controllers = []
		this.loadDocumentation()
		this.addRoutes(
			{
				path: '/manual',
				method: Methods.POST,
				localMiddleware: [
					authMiddleWare.generateAuthMiddleWare({
						adminOnly: true
					})
				],
				handler: this.manualNotificationsByAdmin.bind(this)
			},
			{
				path: '/user',
				method: Methods.POST,
				localMiddleware: [
					authMiddleWare.generateAuthMiddleWare({
						adminOnly: true
					})
				],
				handler: this.sendFCMNotificationToUser.bind(this)
			},
			{
				path: '/topic',
				method: Methods.POST,
				localMiddleware: [
					authMiddleWare.generateAuthMiddleWare({
						adminOnly: true
					})
				],
				handler: this.sendMessageToTopic.bind(this)
			},

			{
				path: '/mark-all-as-read/:id',
				method: Methods.POST,
				localMiddleware: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.params.id
					})
				],
				handler: this.markNotificationAsRead.bind(this)
			}
		)
		this.notificationService = notificationService
	}

	async manualNotificationsByAdmin(req: Request, res: Response) {
		const body: IManualNotificationAdmin = req.body
		if (!body.title || !body.clickParams || !body.receiverType) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request Params Missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.notificationService.manualAdminNotification(body)
		res.status(result.getStatus()).json(result)
		return
	}

	@Documentation.addRoute({
		path: '/notification/topic',
		method: Methods.POST,
		tags: ['NotificationEntity'],
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			},
			500: {
				description: 'Internal Server Error',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				topic: { type: 'string' },
				notification: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						body: { type: 'string' },
						imageUrl: { type: 'string' },
						redirectParameters: { type: 'array', default: [] }
					}
				}
			}
		},
		description: 'Send FCM notification to a topic',
		operationId: 'sendMessageToTopic'
	})
	async sendMessageToTopic(req: Request, res: Response): Promise<void> {
		const topic = req.body.topic
		const body: IManualNotificationAdmin = req.body
		if (!topic || !body.title || !body.clickParams) {
			const result = new Result(true, ErrorCode.BadRequest, 'Request Params Missing')
			res.status(result.getStatus()).json(result)
			return
		}
		const response = await this.notificationService.sendMessageToTopic(topic, body)
		res.status(response.getStatus()).json(response)
	}

	@Documentation.addRoute({
		path: '/notification/mark-all-as-read/{id}',
		method: Methods.POST,
		tags: ['NotificationEntity'],
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			},
			500: {
				description: 'Internal Server Error',
				value: { $ref: Documentation.getRef(Result) }
			},
			404: {
				description: 'Not Found',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		parameters: [{ in: 'path', name: 'id', required: true }]
	})
	async markNotificationAsRead(req: Request, res: Response) {
		const id = req.params.id
		const notification = await this.service.dao.read(id)
		if (notification.status.error || !notification.result) {
			const result = new Result(true, ErrorCode.NotFound, 'Notification not found')
			res.status(result.getStatus()).json(result)
			return
		}
		const context = ContextProvider.getContext().values as
			| { id?: string; type?: UserType }
			| undefined
		if (context?.type !== UserType.admin && notification.result.userId !== context?.id) {
			const result = new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
			res.status(result.getStatus()).json(result)
			return
		}
		const result = await this.service.dao.update(id, { read: true })
		res.status(result.getStatus()).json(result)
	}

	@Documentation.addRoute({
		path: '/notification/user',
		method: Methods.POST,
		tags: ['NotificationEntity'],
		responses: {
			200: {
				description: 'Success',
				value: { $ref: Documentation.getRef(Result) }
			},
			400: {
				description: 'Bad Request',
				value: { $ref: Documentation.getRef(Result) }
			},
			500: {
				description: 'Internal Server Error',
				value: { $ref: Documentation.getRef(Result) }
			},
			404: {
				description: 'Not Found',
				value: { $ref: Documentation.getRef(Result) }
			}
		},
		requestBody: {
			type: 'object',
			properties: {
				userId: { type: 'string', format: 'uuid' },
				notification: {
					type: 'object',
					properties: {
						title: { type: 'string' },
						body: { type: 'string' },
						imageUrl: { type: 'string' },
						redirectParameters: { type: 'array', default: [] }
					}
				}
			}
		},
		description: 'Send FCM notification to user',
		operationId: 'sendFCMNotificationToUser'
	})
	async sendFCMNotificationToUser(req: Request, res: Response): Promise<void> {
		const userId = req.body.userId
		const title = req.body.notification.title
		const body = req.body.notification.body
		const imageUrl = req.body.notification.imageUrl
		const redirectParameters = req.body.notification.redirectParameters
		const notificationRequest = new FCMNotificationRequest(
			title,
			body,
			imageUrl,
			redirectParameters
		)

		const response = await this.notificationService.sendFCMNotificationToUser(
			userId,
			notificationRequest
		)
		res.status(response.getStatus()).json(response)
	}
}
