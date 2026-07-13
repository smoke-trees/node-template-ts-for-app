import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { IRedirectParameters } from './INotification'
import { INotificationCreateModel, INotificationModel, NotificationType } from './INotification'
import { User } from '../../User'

@Entity({
	name: 'notification'
})
@Documentation.addSchema()
export class Notification extends BaseEntity implements INotificationModel {
	@PrimaryGeneratedColumn('increment', { type: 'bigint' })
	@Documentation.addField({
		type: 'number',
		format: 'int64',
		description: 'Id of user'
	})
	id!: number

	@Column({ name: 'user_id', type: 'uuid', nullable: true })
	@Documentation.addField({ type: 'string' })
	userId?: string

	@Column({ name: 'batch_id', type: 'uuid', nullable: true })
	@Documentation.addField({ type: 'string' })
	batchId!: string | null

	@Column({ type: 'varchar', nullable: true, name: 'image_url' })
	@Documentation.addField({
		description: 'The image url in the notification',
		type: 'string',
		example: 'https://example.com/image.png'
	})
	imageUrl!: string | null

	@Column({ name: 'notification_token', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	notificationToken!: string | null

	@Column({ name: 'phone_number', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string' })
	phoneNumber!: string | null

	@Column({
		name: 'notification_type',
		type: 'enum',
		enum: Object.values(NotificationType),
		nullable: false,
		default: NotificationType.Promotional
	})
	@Documentation.addField({ type: 'string' })
	notificationType!: NotificationType

	@Column({ type: 'json', nullable: true, name: 'redirect_parameters' })
	@Documentation.addField({ type: 'object', default: [] })
	redirectParameters!: IRedirectParameters[] | null

	@Column({ type: 'varchar', nullable: true, name: 'title' })
	@Documentation.addField({
		description: 'Title of notification',
		type: 'string',
		example: 'Profile Approved'
	})
	title!: string | null

	@Column({ type: 'varchar', nullable: true, name: 'body' })
	@Documentation.addField({
		description: 'body of notification',
		type: 'string',
		example: 'Your profile has been approved!'
	})
	body!: string | null

	@Column({
		type: 'boolean',
		nullable: true,
		name: 'notification_sent',
		default: false
	})
	@Documentation.addField({
		description: 'was notification sent successfully',
		type: 'boolean',
		example: true
	})
	notificationSent!: boolean | null

	@Column({
		type: 'boolean',
		nullable: false,
		name: 'read',
		default: false
	})
	@Documentation.addField({
		description: 'was notification sent successfully',
		type: 'boolean',
		example: true
	})
	read!: boolean

	@Column({ type: 'json', nullable: true, name: 'notification_failure_data' })
	@Documentation.addField({
		description: 'notification failure data',
		type: 'object',
		example: 'Not enough credits remaining'
	})
	notificationFailureData!: any | null

	@ManyToOne(() => User, (user) => user.notification)
	@JoinColumn({ name: 'user_id' })
	user?: User

	constructor(notification?: INotificationCreateModel) {
		super(notification)
		if (notification) {
			if (notification.id) this.id = notification.id ?? null
			this.userId = notification.userId ?? undefined
			this.batchId = notification.batchId ?? null
			this.notificationToken = notification.notificationToken ?? null
			this.imageUrl = notification.imageUrl ?? null
			this.phoneNumber = notification.phoneNumber ?? null
			this.notificationType = notification.notificationType ?? NotificationType.Promotional
			this.redirectParameters = notification.redirectParameters ?? null
			this.title = notification.title ?? null
			this.body = notification.body ?? null
			this.notificationSent = notification.notificationSent ?? null
			this.notificationFailureData = notification.notificationFailureData ?? null
			this.read = notification.read ?? false
		}
	}
}
