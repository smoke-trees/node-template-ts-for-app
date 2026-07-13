import { ErrorCode, Result, Service } from '@smoke-trees/postgres-backend'
import {
	ApplicationSettings,
	IApplicationSettingsCreate,
	SettingTypes
} from './ApplicationSettings.entity'
import { ApplicationSettingsDao } from './ApplicationSettings.dao'
import { inject, injectable } from 'inversify'
import { log } from '../../log'
import settings from '../../settings'

@injectable()
export class ApplicationSettingsService extends Service<ApplicationSettings> {
	dao: ApplicationSettingsDao
	constructor(@inject(ApplicationSettingsDao) dao: ApplicationSettingsDao) {
		super(dao)
		this.dao = dao
	}

	async seedDefaults() {
		try {
			const seeded = await Promise.all(
				Object.entries(settings.defaultAppSettings).map(async ([name, value]) => {
					const existing = await this.dao.readMany({ where: { name } })
					if (existing.status.error || existing.result?.length) return false

					const insert = await this.dao.create({
						name,
						value,
						type: SettingTypes.STRING,
						isPublic: true
					} as IApplicationSettingsCreate)
					if (insert.status.error) return false

					log.info('Created default setting', 'ApplicationSettingsService.seedDefaults', { name })
					return true
				})
			)
			const created = seeded.filter(Boolean).length
			return new Result(false, ErrorCode.Success, 'Seeded default settings', created)
		} catch (error) {
			log.error('Failed to seed default settings', 'ApplicationSettingsService.seedDefaults', error)
			return new Result(true, ErrorCode.InternalServerError, 'Failed to seed default settings')
		}
	}
}
