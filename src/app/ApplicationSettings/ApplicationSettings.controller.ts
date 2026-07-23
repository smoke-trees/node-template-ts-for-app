import { Application, Controller, ServiceController } from '@smoke-trees/postgres-backend'
import { RequestHandler } from 'express'
import { ParsedQs } from 'qs'
import { ApplicationSettings } from './ApplicationSettings.entity'
import { ApplicationSettingsService } from './ApplicationSettings.service'
import { inject, injectable } from 'inversify'
import { AuthMiddleware } from '../../middleware/authMiddleware'

@injectable()
export class ApplicationSettingsController extends ServiceController<ApplicationSettings> {
	path = '/application-settings'
	protected controllers: Controller[]
	protected mw: RequestHandler<Record<string, string>, any, any, ParsedQs, Record<string, any>>[]
	service: ApplicationSettingsService

	constructor(
		@inject(Application)
		app: Application,
		@inject(ApplicationSettingsService)
		service: ApplicationSettingsService,
		@inject(AuthMiddleware)
		readonly authMiddleware: AuthMiddleware
	) {
		super(app, ApplicationSettings, service, undefined, {
			create: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			update: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			delete: [authMiddleware.generateAuthMiddleWare({ adminOnly: true })],
			read: [],
			readMany: [],
			readManyWithoutPagination: []
		})
		this.service = service
		this.controllers = []
		this.mw = []
	}
}
