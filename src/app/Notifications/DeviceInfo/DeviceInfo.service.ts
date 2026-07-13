import { ErrorCode, Result, Service } from '@smoke-trees/postgres-backend'
import { DeviceInfoDao } from './DeviceInfo.dao'
import { DeviceInfo } from './DeviceInfo.entity'
import { FirebaseMessagingClient } from '../Notification/notificationClient'
import { inject, injectable } from 'inversify'

@injectable()
export class DeviceInfoService extends Service<DeviceInfo> {
	dao: DeviceInfoDao
	firebaseMessagingClient: FirebaseMessagingClient
	constructor(
		@inject(DeviceInfoDao)
		dao: DeviceInfoDao,
		@inject(FirebaseMessagingClient)
		firebaseMessagingClient: FirebaseMessagingClient
	) {
		super(dao)
		this.dao = dao
		this.firebaseMessagingClient = firebaseMessagingClient
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
				return new Result(false, ErrorCode.NoUpdatesPerformed, 'Some Error in updating')
			}
			return new Result(false, ErrorCode.Success, 'Updated DeviceInfo')
		} else {
			const newInfo = await this.dao.create(info)
			if (info.fcmToken) {
				await this.firebaseMessagingClient.subscribeToTopic([info.fcmToken!], `user-${info.userId}`)
			}
			return newInfo
		}
	}
}
