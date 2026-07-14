import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { IUser, UserType } from './IUser'
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { NotificationEntity } from '../Notifications/Notification'
import { DeviceInfoEntity } from '../Notifications/DeviceInfo'

@Documentation.addSchema()
@Entity({ name: 'user' })
export class User extends BaseEntity implements IUser {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'firstname', type: 'varchar', nullable: true })
	firstname?: string | undefined

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'lastname', type: 'varchar', nullable: true })
	lastname?: string | undefined

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'email', type: 'varchar' })
	email!: string

	@Documentation.addField({ type: 'boolean' })
	@Column({ name: 'email_verified', type: 'boolean', default: false })
	emailVerified!: boolean

	@Column({ name: 'password', type: 'varchar' })
	password!: string

	@Documentation.addField({ type: 'string', enum: Object.values(UserType) })
	@Column({ name: 'type', type: 'enum', enum: UserType, default: UserType.student })
	type!: UserType

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'country', type: 'varchar', nullable: true })
	country?: string | undefined

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'phone_number', type: 'varchar', nullable: true })
	phoneNumber?: string

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'country_code', type: 'varchar', nullable: true })
	countryCode?: string

	@Documentation.addField({ type: 'boolean' })
	@Column({ name: 'is_active', type: 'boolean', nullable: true, default: true })
	isActive!: boolean

	@Documentation.addField({ type: 'boolean' })
	@Column({ name: 'consent_given', type: 'boolean', nullable: true, default: false })
	consentGiven?: boolean | null

	@Documentation.addField({ type: 'string', format: 'date-time' })
	@Column({ name: 'consent_at', type: 'timestamp', nullable: true })
	consentAt?: Date | null

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'consent_version', type: 'varchar', nullable: true })
	consentVersion?: string | null

	@OneToMany(() => NotificationEntity, (notification) => notification.user, { cascade: true })
	notification?: NotificationEntity[]

	@OneToMany(() => DeviceInfoEntity, (device) => device.user)
	device?: DeviceInfoEntity[]

	constructor(it?: IUser) {
		super()
		if (it) {
			this.type = it.type
			this.firstname = it.firstname
			this.lastname = it.lastname
			this.email = it.email
			this.country = it.country
			this.password = it.password
			this.phoneNumber = it.phoneNumber
			this.countryCode = it.countryCode
			this.emailVerified = it.emailVerified
			this.isActive = it.isActive
			this.consentGiven = it.consentGiven
			this.consentAt = it.consentAt
			this.consentVersion = it.consentVersion
			if (it.id) {
				this.id = it.id
			}
		}
	}
}
