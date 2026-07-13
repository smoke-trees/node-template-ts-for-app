import { RedisConnectionObjectInterface } from './types'
import RedisPool from '../redis/redis-client'
import { RedisPoolOptions } from '../redis/types'
import { log } from '@smoke-trees/postgres-backend'

const dbOptions: RedisPoolOptions = {
	host: process.env.REDIS_HOST ?? 'localhost',
	port: parseInt(process.env.REDIS_PORT ?? '6379'),
	username: process.env.REDIS_USERNAME ?? '',
	password: process.env.REDIS_PASSWORD ?? ''
	// db: parseInt(process.env.REDIS_DB ?? '0')
}

const connect = async (): Promise<RedisConnectionObjectInterface> => {
	try {
		// Create a connection pool to do operations
		const pool = new RedisPool(dbOptions)
		log.info('Connected to redis Database', 'connect redis')
		return {
			connection: pool
		}
	} catch (error) {
		log.error('Error in connecting to redis db', 'connect redis', error)
		throw error
	}
}

export const RedisDatabaseObject = connect()

export default RedisDatabaseObject
