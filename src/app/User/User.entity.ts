import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { IUser, UserType, SignupType } from './IUser'
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { NotificationEntity } from '../Notifications/Notification'
import { DeviceInfoEntity } from '../Notifications/DeviceInfo'
import { UserTopics } from '../Notifications/UserTopics'

@Documentation.addSchema()
@Entity({ name: 'user' })
export class User extends BaseEntity implements IUser {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'first_name', type: 'varchar', nullable: true })
	firstName?: string | undefined

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'last_name', type: 'varchar', nullable: true })
	lastName?: string | undefined

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'email', type: 'varchar' })
	email!: string

	@Documentation.addField({ type: 'boolean' })
	@Column({ name: 'email_verified', type: 'boolean', default: false })
	emailVerified!: boolean

	@Column({ name: 'password', type: 'varchar' })
	password!: string

	@Documentation.addField({ type: 'string', enum: Object.values(UserType) })
	@Column({ name: 'user_type', type: 'enum', enum: UserType, default: UserType.user })
	userType!: UserType

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

	@OneToMany(() => UserTopics, (userTopic) => userTopic.user, { cascade: true })
	userTopics?: UserTopics[]

	@Documentation.addField({ type: 'boolean' })
	@Column({ name: 'is_soft_deleted', type: 'boolean', nullable: true, default: false })
	isSoftDeleted!: boolean

	@Documentation.addField({ type: 'string', format: 'date-time' })
	@Column({ name: 'soft_deleted_at', type: 'timestamp', nullable: true })
	softDeletedAt!: Date | null

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'google_user_id', type: 'varchar', nullable: true })
	googleUserId?: string

	@Documentation.addField({ type: 'string' })
	@Column({ name: 'apple_user_id', type: 'varchar', nullable: true })
	appleUserId?: string

	@Documentation.addField({ type: 'string', enum: Object.values(SignupType) })
	@Column({ name: 'signup_type', type: 'enum', enum: SignupType })
	signupType!: SignupType

	constructor(it?: IUser) {
		super()
		if (it) {
			this.userType = it.userType
			this.firstName = it.firstName
			this.lastName = it.lastName
			this.email = it.email
			this.password = it.password
			this.phoneNumber = it.phoneNumber
			this.countryCode = it.countryCode
			this.emailVerified = it.emailVerified
			this.isActive = it.isActive
			this.consentGiven = it.consentGiven
			this.consentAt = it.consentAt
			this.consentVersion = it.consentVersion
			this.isSoftDeleted = it.isSoftDeleted
			this.softDeletedAt = it.softDeletedAt
			this.appleUserId = it.appleUserId
			this.googleUserId = it.googleUserId
			this.signupType = it.signupType
			if (it.id) {
				this.id = it.id
			}
		}
	}
}
