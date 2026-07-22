import { Database, log } from '@smoke-trees/postgres-backend'
import { container } from '../setup'

const database = container.get<Database>('database')
describe('Test Suite', function () {
	before(async function () {
		await database.connect()
		log.info(String(await database.ready), 'index.test')
	})
	after(function () {})
})
