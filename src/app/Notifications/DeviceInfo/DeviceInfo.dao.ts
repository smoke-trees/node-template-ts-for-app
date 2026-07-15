import { Dao, Database } from '@smoke-trees/postgres-backend'
import { DeviceInfo } from './DeviceInfo.entity'
import { inject, injectable } from 'inversify'

@injectable()
export class DeviceInfoDao extends Dao<DeviceInfo> {
	constructor(
		@inject('database')
		database: Database
	) {
		super(database, DeviceInfo, 'device_info')
	}
}
