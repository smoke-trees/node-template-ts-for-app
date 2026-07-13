import { Database } from '@smoke-trees/postgres-backend'
import './config-env'
import settings from './settings'
import { User } from './app/User/User.entity'
import { DeviceInfo } from './app/Notifications/DeviceInfo/DeviceInfo.entity'
import { Notification } from './app/Notifications/Notification/Notification.entity'

const database = new Database(settings)

// Add Entities
database.addEntity(User, DeviceInfo, Notification)

// Add Migrations

export default database
