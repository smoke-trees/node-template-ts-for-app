import { ErrorCode, Result, Service, log } from '@smoke-trees/postgres-backend'
import { FcmTopicDao } from './FcmTopic.dao'
import { FcmTopic } from './FcmTopic.entity'
import { inject, injectable } from 'inversify'

@injectable()
export class FcmTopicService extends Service<FcmTopic> {
	dao: FcmTopicDao
	constructor(
		@inject(FcmTopicDao)
		dao: FcmTopicDao
	) {
		super(dao)
		this.dao = dao
	}

	async ensureTopic(name: string, description?: string | null) {
		try {
			const existing = await this.dao.read({ where: { name } })
			if (existing.result) {
				return existing
			}
			try {
				return await this.dao.create({ name, description })
			} catch (createError) {
				// Handle race: another request may have created the topic between read and create
				const retried = await this.dao.read({ where: { name } })
				if (retried.result) {
					return retried
				}
				throw createError
			}
		} catch (error) {
			log.error('Error ensuring fcm topic exists', 'FcmTopicService.ensureTopic', error, { name })
			return new Result(true, ErrorCode.InternalServerError, 'Error creating fcm topic')
		}
	}

	async seedDefaults() {
		try {
			const defaultTopics = [
				{ name: 'LOGGED_IN_USERS', description: 'System topic for all logged in users' },
				{ name: 'GUEST_USERS', description: 'System topic for guest/logged out users' }
			]
			for (const topic of defaultTopics) {
				await this.ensureTopic(topic.name, topic.description)
			}
			return new Result(false, ErrorCode.Success, 'Default FCM topics seeded successfully')
		} catch (error) {
			log.error('Failed to seed default fcm topics', 'FcmTopicService.seedDefaults', error)
			return new Result(true, ErrorCode.InternalServerError, 'Failed to seed default fcm topics')
		}
	}

	async getAllTopics() {
		try {
			const res = await this.dao.readMany({ nonPaginated: true })
			if (res.status.error) {
				return new Result(true, ErrorCode.InternalServerError, 'Error getting fcm topics')
			}
			return new Result(
				false,
				ErrorCode.Success,
				'FCM topics fetched successfully',
				res.result ?? []
			)
		} catch (error) {
			log.error('Error getting all fcm topics', 'FcmTopicService.getAllTopics', error)
			return new Result(true, ErrorCode.InternalServerError, 'Error getting fcm topics')
		}
	}
}
