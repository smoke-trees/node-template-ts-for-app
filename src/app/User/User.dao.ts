import { Dao, Database, ErrorCode, Result } from '@smoke-trees/postgres-backend'
import { User } from './User.entity'
import dayjs from 'dayjs'
import { UserType } from './IUser'
import { inject, injectable } from 'inversify'

@injectable()
export class UserDao extends Dao<User> {
	constructor(@inject('database') database: Database) {
		super(database, User, 'user')
	}
}
