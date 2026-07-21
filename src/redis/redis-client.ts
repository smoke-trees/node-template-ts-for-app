import GenericPool from 'generic-pool'
import Redis from 'ioredis'
import { KeyType, RedisPoolOptions, ValueType } from './types'

/**
 * RedisPool creates an option to create a connection pool of redis clients.
 * Whenever we want a redis connection to work with user acquires the connection from the pool
 * and then releases it after operations are completed. Make sure to release an acquired connection
 * as it may pause the next acquire until connection from this is not released.
 */
export default class RedisPool {
	_pool: GenericPool.Pool<Redis>
	constructor(options: RedisPoolOptions) {
		this._pool = GenericPool.createPool<Redis>(
			{
				create: async () => {
					return new Redis(options)
				},
				destroy: async (client) => {
					client.disconnect()
				}
			},
			options
		)
	}

	/**
	 * Create an hashmap on the redis server which store the fields.
	 * @param key Key for the hashmap
	 * @param data Object of the hash map
	 * @returns 1 if a new field is set and 0 if an old field was updated
	 */
	hset(
		key: KeyType,
		data: ValueType[] | { [key: string]: ValueType } | Map<string, ValueType>
	): Promise<number> {
		return this._pool.acquire().then((connection) => {
			return connection.hset(key, data).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Read a particular field in an hash stored at key in redis.
	 * @param key Key for the hashmap
	 * @param field Field user wants to read
	 * @returns Value stored in the hashmap of the field
	 */
	hget(key: KeyType, field: string): Promise<string | null> {
		return this._pool.acquire().then((connection) => {
			return connection.hget(key, field).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	hdel(key: KeyType, field: string): Promise<number | null> {
		return this._pool.acquire().then((connection) => {
			return connection.hdel(key, field).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Set a string in redis database at a key.
	 * @param key Key for the entry.
	 * @param value Value for the entry.
	 * @param expiryMode Expiry mode, example: EX,PX.
	 * @param time Time after which entry is deleted in seconds(EX) or milliseconds(PX) depending on expiry mode.
	 * @param setMode Set mode for the operation. example: NX|NN.
	 * @returns "OK" for successful operation
	 */
	set(
		key: KeyType,
		value: ValueType,
		expiryMode?: any,
		time?: number | string,
		setMode?: number | string
	): Promise<string | null> {
		const argumentSize = arguments.length
		return this._pool.acquire().then((connection) => {
			if (argumentSize === 2) {
				return connection.set(key, value).finally(() => {
					this._pool.release(connection)
				})
			}
			if (argumentSize === 3) {
				return connection.set(key, value, 'GET').finally(() => {
					this._pool.release(connection)
				})
			}
			if (argumentSize === 4) {
				return connection.set(key, value, expiryMode, time as any).finally(() => {
					this._pool.release(connection)
				})
			}
			return connection.set(key, value, expiryMode, time as any, setMode as any).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	del(...keys: KeyType[]): Promise<string | number | null> {
		return this._pool.acquire().then((connection) => {
			return connection.del(...(keys as [KeyType, ...KeyType[]])).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Read a string at a given location.
	 * @param key Key for the string entry
	 * @returns Read string at key or null if no string is present
	 */
	get(key: KeyType): Promise<string | null> {
		return this._pool.acquire().then((connection) => {
			return connection.get(key).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Returns TTL for a key in seconds.
	 * -1: No expiry on a key
	 * -2: Key doesn't exists
	 * @param key Key for the string entry
	 * @returns
	 */
	ttl(key: KeyType): Promise<number> {
		return this._pool.acquire().then((connection) => {
			return connection.ttl(key).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	hgetAll(key: KeyType): Promise<any> {
		return this._pool.acquire().then((connection) => {
			return connection.hgetall(key).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	expire(key: KeyType, seconds: number | string, mode: 'NX' | 'LT' | 'XX' | 'GT' = 'NX') {
		return this._pool.acquire().then((connection) => {
			return connection.expire(key, seconds, mode as any).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Add a member to a Redis Sorted Set with a score.
	 * @param key Key for the sorted set
	 * @param score Score (e.g. timestamp)
	 * @param member Member value
	 */
	zadd(key: KeyType, score: number, member: string): Promise<number> {
		return this._pool.acquire().then((connection) => {
			return connection.zadd(key, score, member).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Remove and return the lowest-scored members from a Sorted Set.
	 * @param key Key for the sorted set
	 * @param count Number of members to pop (default 1)
	 * @returns Array of [member, score] pairs
	 */
	zpopmin(key: KeyType, count = 1): Promise<string[]> {
		return this._pool.acquire().then((connection) => {
			return connection.zpopmin(key, count).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Get the number of members in a Sorted Set.
	 * @param key Key for the sorted set
	 */
	zcard(key: KeyType): Promise<number> {
		return this._pool.acquire().then((connection) => {
			return connection.zcard(key).finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Get members and scores from a Sorted Set (oldest → newest).
	 * Returns a flat array [member, score, member, score, ...].
	 * @param key Key for the sorted set
	 * @param start Start index (0 = first)
	 * @param stop Stop index (-1 = last)
	 */
	zrangeWithScores(key: KeyType, start: number, stop: number): Promise<string[]> {
		return this._pool.acquire().then((connection) => {
			return connection.zrange(key, start, stop, 'WITHSCORES').finally(() => {
				this._pool.release(connection)
			})
		})
	}

	/**
	 * Remove one or more members from a Sorted Set.
	 * @param key Key for the sorted set
	 * @param members Members to remove
	 */
	zrem(key: KeyType, ...members: string[]): Promise<number> {
		return this._pool.acquire().then((connection) => {
			return connection.zrem(key, ...members).finally(() => {
				this._pool.release(connection)
			})
		})
	}
}
