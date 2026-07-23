import { ErrorCode, Result, Service, log } from '@smoke-trees/postgres-backend'
import { UserTopics } from './UserTopics.entity'
import { UserTopicsDao } from './UserTopics.dao'
import { inject, injectable } from 'inversify'

@injectable()
export class UserTopicsService extends Service<UserTopics> {
	dao: UserTopicsDao
	constructor(
		@inject(UserTopicsDao)
		dao: UserTopicsDao
	) {
		super(dao)
		this.dao = dao
	}

	async subscribe(userId: string, topicName: string) {
		try {
			const existing = await this.dao.read({
				where: { userId, topicName }
			})
			if (existing.result) {
				return new Result(true, ErrorCode.BadRequest, 'Already subscribed to this topic')
			}
			return this.dao.create({ userId, topicName })
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
			return this.dao.delete({ userId, topicName })
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
			return this.dao.readMany({ where: { userId } })
		} catch (error) {
			log.error('Error getting user topics', 'UserTopicsService.getUserTopics', error, {
				userId
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error getting user topics')
		}
	}

	async getTopicUsers(topicName: string) {
		try {
			return this.dao.readMany({ where: { topicName } })
		} catch (error) {
			log.error('Error getting topic users', 'UserTopicsService.getTopicUsers', error, {
				topicName
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error getting topic users')
		}
	}

	async getAllTopics() {
		try {
			const res = await this.dao.readMany({nonPaginated: true})
			if (res.status.error || !res.result) {
				return new Result(false, ErrorCode.Success, 'Topics fetched successfully', [])
			}
			const topicNames = Array.from(
				new Set(res.result.map((t: UserTopics) => t.topicName).filter(Boolean))
			)
			return new Result(false, ErrorCode.Success, 'Topics fetched successfully', topicNames)
		} catch (error) {
			log.error('Error getting all topics', 'UserTopicsService.getAllTopics', error)
			return new Result(true, ErrorCode.InternalServerError, 'Error getting topics')
		}
	}
}
