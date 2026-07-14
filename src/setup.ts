import { Application } from '@smoke-trees/postgres-backend'
import cors from 'cors'
import { json } from 'express'
import { Container } from 'inversify'
import database from './database'
import settings from './settings'
import {
	NotificationController,
	NotificationDao,
	NotificationService
} from './app/Notifications/Notification'
import { FirebaseMessagingClient } from './app/Notifications/Notification/notificationClient'
import {
	DeviceInfoController,
	DeviceInfoDao,
	DeviceInfoService
} from './app/Notifications/DeviceInfo'
import {
	UserTopicsController,
	UserTopicsDao,
	UserTopicsService
} from './app/Notifications/UserTopics'
import { UserDao } from './app/User/User.dao'
import { UserService } from './app/User/User.service'
import { UserController } from './app/User/User.controller'
import {
	ApplicationSettingsDao,
	ApplicationSettingsService,
	ApplicationSettingsController
} from './app/ApplicationSettings'
import { AuthMiddleware } from './middleware/authMiddleware'

export const container: Container = new Container()

const app = new Application(settings, database)

app.getApp().set('query parser', 'extended')

container.bind('database').toConstantValue(database)
container.bind(Application).toConstantValue(app)

container.bind(FirebaseMessagingClient).toSelf()

container.bind(NotificationDao).toSelf()
container.bind(NotificationService).toSelf()
container.bind(NotificationController).toSelf()

container.bind(DeviceInfoDao).toSelf()
container.bind(DeviceInfoService).toSelf()
container.bind(DeviceInfoController).toSelf()

container.bind(UserTopicsDao).toSelf()
container.bind(UserTopicsService).toSelf()
container.bind(UserTopicsController).toSelf()

container.bind(UserDao).toSelf()
container.bind(UserService).toSelf()
container.bind(UserController).toSelf()
container.bind(AuthMiddleware).toSelf()

container.bind(ApplicationSettingsDao).toSelf()
container.bind(ApplicationSettingsService).toSelf()
container.bind(ApplicationSettingsController).toSelf()

app.addController(container.get(NotificationController))
app.addController(container.get(DeviceInfoController))
app.addController(container.get(UserTopicsController))
app.addController(container.get(UserController))
app.addController(container.get(ApplicationSettingsController))

app.addMiddleWare(cors())
app.addMiddleWare(json())
