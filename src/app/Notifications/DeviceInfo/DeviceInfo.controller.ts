import { Application, Controller, ServiceController } from '@smoke-trees/postgres-backend'
import { RequestHandler, Request } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'
import { DeviceInfo } from './DeviceInfo.entity'
import { DeviceInfoService } from './DeviceInfo.service'
import { inject } from 'inversify'
import { AuthMiddleware } from '../../../middleware/authMiddleware'

export class DeviceInfoController extends ServiceController<DeviceInfo> {
	path = '/device-info'
	protected controllers: Controller[]
	protected mw: RequestHandler<ParamsDictionary, any, any, ParsedQs, Record<string, any>>[]
	constructor(
		@inject(Application)
		app: Application,
		@inject(DeviceInfoService)
		userService: DeviceInfoService,
		@inject(AuthMiddleware)
		readonly authMiddleWare: AuthMiddleware
	) {
		super(
			app,
			DeviceInfo,
			userService,
			{},
			{
				create: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.body.userId
					})
				],
				read: [
					authMiddleWare.generateAuthMiddleWare({
						contextOnly: true
					})
				],
				readMany: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.query.userId?.toString()
					})
				],
				readManyWithoutPagination: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.query.userId?.toString()
					})
				],
				update: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.body.userId
					})
				],
				delete: [
					authMiddleWare.generateAuthMiddleWare({
						userIdLoc: (req: Request) => req.query.userId?.toString()
					})
				]
			}
		)
		this.mw = []
		this.controllers = []
		this.loadDocumentation()
	}
}
