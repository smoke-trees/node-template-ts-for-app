import { Dao, Database } from '@smoke-trees/postgres-backend'
import { ApplicationSettings } from './ApplicationSettings.entity'
import { inject, injectable } from 'inversify'

@injectable()
export class ApplicationSettingsDao extends Dao<ApplicationSettings> {
	constructor(@inject('database') database: Database) {
		super(database, ApplicationSettings, 'application_settings')
	}
}
