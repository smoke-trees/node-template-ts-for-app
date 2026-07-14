import { Database } from '@smoke-trees/postgres-backend'
import './config-env'
import settings from './settings'
import { User } from './app/User/User.entity'
import { DeviceInfo } from './app/Notifications/DeviceInfo/DeviceInfo.entity'
import { Notification } from './app/Notifications/Notification/Notification.entity'
import { ApplicationSettings } from './app/ApplicationSettings/ApplicationSettings.entity'
import { UserTopics } from './app/Notifications/UserTopics/UserTopics.entity'

const database = new Database(settings)

// Add Entities
database.addEntity(User, DeviceInfo, Notification, ApplicationSettings, UserTopics)

// Add Migrations

export default database
