import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { IFcmTopic, IFcmTopicCreateModel } from './IFcmTopic'
import { UserTopics } from '../UserTopics/UserTopics.entity'

@Documentation.addSchema()
@Entity({ name: 'fcm_topics' })
export class FcmTopic extends BaseEntity implements IFcmTopic {
	@PrimaryGeneratedColumn('uuid')
	@Documentation.addField({ type: 'string', format: 'uuid' })
	id!: string

	@Column({ name: 'name', type: 'varchar', unique: true, nullable: false })
	@Documentation.addField({ type: 'string' })
	name!: string

	@Column({ name: 'description', type: 'varchar', nullable: true })
	@Documentation.addField({ type: 'string', nullable: true })
	description?: string | null

	@OneToMany(() => UserTopics, (userTopic) => userTopic.fcmTopic, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	userTopics?: UserTopics[]

	constructor(data?: IFcmTopicCreateModel) {
		super()
		if (data) {
			this.name = data.name
			this.description = data.description ?? null
		}
	}
}
