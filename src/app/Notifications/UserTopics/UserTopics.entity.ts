import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { IUserTopics, IUserTopicsCreateModel } from './IUserTopics'
import { User } from '../../User'

@Entity({ name: 'user_topics' })
@Unique(['userId', 'topicName'])
@Documentation.addSchema()
export class UserTopics extends BaseEntity implements IUserTopics {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({ name: 'user_id', type: 'uuid', nullable: false })
	@Documentation.addField({ type: 'string', format: 'uuid' })
	userId!: string

	@Column({ name: 'topic_name', type: 'varchar', nullable: false })
	@Documentation.addField({ type: 'string' })
	topicName!: string

	@ManyToOne(() => User, (user) => user.userTopics, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user?: User

	constructor(model?: IUserTopicsCreateModel) {
		super()
		if (model) {
			this.userId = model.userId
			this.topicName = model.topicName
		}
	}
}
