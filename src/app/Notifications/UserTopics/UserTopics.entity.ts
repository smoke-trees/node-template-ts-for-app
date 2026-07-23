import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { IUserTopics, IUserTopicsCreateModel } from './IUserTopics'
import { User } from '../../User'
import { FcmTopic } from '../FcmTopic/FcmTopic.entity'

@Entity({ name: 'user_topics' })
@Unique(['userId', 'topicId'])
@Documentation.addSchema()
export class UserTopics extends BaseEntity implements IUserTopics {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'user_id', type: 'uuid', nullable: false })
	@Documentation.addField({ type: 'string', format: 'uuid' })
	userId!: string

	@Column({ name: 'topic_id', type: 'uuid', nullable: false })
	@Documentation.addField({ type: 'string', format: 'uuid' })
	topicId!: string

	@ManyToOne(() => User, (user) => user.userTopics, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user?: User

	@ManyToOne(() => FcmTopic, (fcmTopic) => fcmTopic.userTopics, {
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn({ name: 'topic_id' })
	fcmTopic?: FcmTopic

	constructor(model?: IUserTopicsCreateModel) {
		super()
		if (model) {
			this.userId = model.userId
			this.topicId = model.topicId
		}
	}
}
