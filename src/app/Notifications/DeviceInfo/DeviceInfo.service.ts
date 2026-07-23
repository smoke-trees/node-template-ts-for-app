import { ErrorCode, Result, Service } from '@smoke-trees/postgres-backend'
import { DeviceInfoDao } from './DeviceInfo.dao'
import { DeviceInfo } from './DeviceInfo.entity'
import { inject, injectable } from 'inversify'

@injectable()
export class DeviceInfoService extends Service<DeviceInfo> {
	dao: DeviceInfoDao

	constructor(
		@inject(DeviceInfoDao)
		dao: DeviceInfoDao
	) {
		super(dao)
		this.dao = dao
	}

	async create(info: DeviceInfo): Promise<Result<number | string>> {
		const deviceInfo = await this.dao.read({
			where: {
				deviceId: info.deviceId!,
				userId: info.userId
			}
		})
		if (deviceInfo.result) {
			const newDeviceInfo = { ...deviceInfo.result, ...info }
			const updatedInfo = await this.dao.update(deviceInfo.result.id, newDeviceInfo)
			if (updatedInfo.status.error) {
				return new Result(true, ErrorCode.NoUpdatesPerformed, 'Some Error in updating')
			}
			return new Result(false, ErrorCode.Success, 'Updated DeviceInfo')
		} else {
			return await this.dao.create(info)
		}
	}
}
