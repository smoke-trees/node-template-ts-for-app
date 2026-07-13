import { Service } from '@smoke-trees/postgres-backend'
import { ApplicationSettings } from './ApplicationSettings.entity'
import { ApplicationSettingsDao } from './ApplicationSettings.dao'
import { inject, injectable } from 'inversify'

@injectable()
export class ApplicationSettingsService extends Service<ApplicationSettings> {
	dao: ApplicationSettingsDao
	constructor(@inject(ApplicationSettingsDao) dao: ApplicationSettingsDao) {
		super(dao)
		this.dao = dao
	}
}
