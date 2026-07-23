import { ErrorCode, Result, Service, log } from '@smoke-trees/postgres-backend'
import { UserTopics } from './UserTopics.entity'
import { UserTopicsDao } from './UserTopics.dao'
import { FcmTopicService } from '../FcmTopic/FcmTopic.service'
import { inject, injectable } from 'inversify'

@injectable()
export class UserTopicsService extends Service<UserTopics> {
	dao: UserTopicsDao
	fcmTopicService: FcmTopicService

	constructor(
		@inject(UserTopicsDao)
		dao: UserTopicsDao,
		@inject(FcmTopicService)
		fcmTopicService: FcmTopicService
	) {
		super(dao)
		this.dao = dao
		this.fcmTopicService = fcmTopicService
	}

	async subscribe(userId: string, topicName: string) {
		try {
			const topic = await this.fcmTopicService.dao.read({ where: { name: topicName } })
			if (topic.status.error || !topic.result) {
				return new Result(true, ErrorCode.BadRequest, 'FCM topic does not exist')
			}
			const topicId = topic.result.id
			const existing = await this.dao.read({
				where: { userId, topicId }
			})
			if (existing.result) {
				return new Result(true, ErrorCode.BadRequest, 'Already subscribed to this topic')
			}
			return await this.dao.create({ userId, topicId })
		} catch (error) {
			log.error('Error subscribing to topic', 'UserTopicsService.subscribe', error, {
				userId,
				topicName
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error subscribing to topic')
		}
	}

	async unsubscribe(userId: string, topicName: string) {
		try {
			const topic = await this.fcmTopicService.dao.read({ where: { name: topicName } })
			if (topic.status.error || !topic.result) {
				return new Result(false, ErrorCode.Success, 'Unsubscribed from topic')
			}
			const existing = await this.dao.read({
				where: { userId, topicId: topic.result.id }
			})
			if (!existing.result) {
				return new Result(false, ErrorCode.Success, 'Unsubscribed from topic')
			}

			return await this.dao.delete(existing.result.id)
		} catch (error) {
			log.error('Error unsubscribing from topic', 'UserTopicsService.unsubscribe', error, {
				userId,
				topicName
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error unsubscribing from topic')
		}
	}

	async getUserTopics(userId: string) {
		try {
			return this.dao.readMany({
				where: { userId },
				relations: { fcmTopic: true },
				nonPaginated: true
			})
		} catch (error) {
			log.error('Error getting user topics', 'UserTopicsService.getUserTopics', error, {
				userId
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error getting user topics')
		}
	}

	async getTopicUsers(topicName: string) {
		try {
			const topic = await this.fcmTopicService.dao.read({ where: { name: topicName } })
			if (topic.status.error) {
				return new Result(true, ErrorCode.InternalServerError, 'Error getting topic users')
			}
			if (!topic.result) {
				return new Result(false, ErrorCode.Success, 'No users found for topic', [])
			}
			return this.dao.readMany({ where: { topicId: topic.result.id }, nonPaginated: true })
		} catch (error) {
			log.error('Error getting topic users', 'UserTopicsService.getTopicUsers', error, {
				topicName
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error getting topic users')
		}
	}

	async getAllTopics() {
		try {
			return await this.fcmTopicService.getAllTopics()
		} catch (error) {
			log.error('Error getting all topics', 'UserTopicsService.getAllTopics', error)
			return new Result(true, ErrorCode.InternalServerError, 'Error getting topics')
		}
	}
}
