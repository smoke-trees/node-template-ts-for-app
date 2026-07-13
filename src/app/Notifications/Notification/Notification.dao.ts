import { Dao, Database } from '@smoke-trees/postgres-backend'
import { Notification } from './Notification.entity'
import { inject, injectable } from 'inversify'

@injectable()
export class NotificationDao extends Dao<Notification> {
	constructor(
		@inject('database')
		database: Database
	) {
		super(database, Notification, 'notification')
	}
}