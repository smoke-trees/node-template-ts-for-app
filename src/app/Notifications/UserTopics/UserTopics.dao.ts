import { Dao, Database } from '@smoke-trees/postgres-backend'
import { UserTopics } from './UserTopics.entity'
import { inject, injectable } from 'inversify'

@injectable()
export class UserTopicsDao extends Dao<UserTopics> {
	constructor(
		@inject('database')
		database: Database
	) {
		super(database, UserTopics, 'user_topics')
	}
}
