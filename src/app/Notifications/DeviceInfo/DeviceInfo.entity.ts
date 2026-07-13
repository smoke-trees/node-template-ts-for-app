import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { IDeviceInfoCreateModel, IDeviceInfoModel } from './IDeviceInfo'
import { User } from '../../User'

@Entity({
	name: 'device_info'
})
@Documentation.addSchema()
export class DeviceInfo extends BaseEntity implements IDeviceInfoModel {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Documentation.addField({
		type: 'number',
		format: 'int64',
		description: 'Id of user'
	})
	id!: number

	@Column({ name: 'user_id', type: 'uuid', nullable: false })
	@Documentation.addField({ type: 'string', format: 'uuid' })
	userId!: string

	@Column({ name: 'fcm_token', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	fcmToken!: string | null

	@Column({ name: 'device_id', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	deviceId!: string | null

	@Column({ name: 'os', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	os?: string | undefined

	@Column({ name: 'current_user_version', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	currentUserVersion!: string | null

	@Column({
		name: 'current_user_build_number',
		type: 'varchar',
		nullable: true
	})
	@Documentation.addField({ type: 'string' })
	currentUserBuildNumber!: string | null

	@Column({ name: 'installed_time', type: 'timestamp', nullable: true })
	@Documentation.addField({ type: 'string', format: 'date-time' })
	installedTime!: Date | null

	@Column({ name: 'device_ip_address', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	deviceIpAddress!: string | null

	@Column({ name: 'last_login_time', type: 'timestamp', nullable: true })
	@Documentation.addField({ type: 'string', format: 'date-time' })
	lastLoginTime!: Date | null

	@ManyToOne(() => User, (user) => user.device)
	@JoinColumn({ name: 'user_id' })
	user?: User

	constructor(deviceInfo?: IDeviceInfoCreateModel) {
		super(deviceInfo)
		if (deviceInfo) {
			const {
				fcmToken,
				deviceId,
				currentUserVersion,
				currentUserBuildNumber,
				os,
				userId,
				id,
				installedTime,
				deviceIpAddress,
				lastLoginTime
			} = deviceInfo
			if (id) this.id = id
			this.userId = userId
			this.os = os
			this.currentUserBuildNumber = currentUserBuildNumber
			this.currentUserVersion = currentUserVersion
			this.deviceId = deviceId
			this.fcmToken = fcmToken
			this.installedTime = installedTime
			this.deviceIpAddress = deviceIpAddress
			this.lastLoginTime = lastLoginTime
		}
	}
}
