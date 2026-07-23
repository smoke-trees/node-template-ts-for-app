import { Dao, Database } from '@smoke-trees/postgres-backend'
import { inject, injectable } from 'inversify'
import { FcmTopic } from './FcmTopic.entity'

@injectable()
export class FcmTopicDao extends Dao<FcmTopic> {
	constructor(
		@inject('database')
		db: Database
	) {
		super(db, FcmTopic, 'fcm_topics')
	}
}
