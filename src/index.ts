import { Application, Documentation } from '@smoke-trees/postgres-backend'
import swaggerUiExpress from 'swagger-ui-express'
import database from './database'
import { container } from './setup'
import { ApplicationSettingsService } from './app/ApplicationSettings/ApplicationSettings.service'
import { log } from './log'

Documentation.addServers([
	{
		url: 'http://localhost:8080',
		description: 'Local server'
	}
])

Documentation.addInfo({
	title: 'Postgres Backend Template',
	description: 'This is a template for a postgres backend',
	version: '1.0.0'
})

const app = container.get(Application)

app.getApp().use('/docs', swaggerUiExpress.serveWithOptions({ cacheControl: true, maxAge: 64800 }))
app.getApp().get('/docs', swaggerUiExpress.setup(Documentation.getAPIJson()))

app.loadMiddleware()
app.loadControllers()

database
	.connect()
	.then(async (connected) => {
		if (connected) {
			await container.get(ApplicationSettingsService).seedDefaults()
			app.run()
		} else {
			log.error('Unable to connect to database', 'index', new Error('Database connection failed'))
		}
	})
	.catch((error) => {
		log.error('Unexpected error during application startup', 'index', error)
	})
