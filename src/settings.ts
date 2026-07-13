import { Settings } from '@smoke-trees/postgres-backend'
import './config-env'

export class ApplicationSettings extends Settings {
	databaseType: 'postgres' | 'mysql'
	dbPassword: string
	dbUser: string
	dbHost: string
	dbPort: string | undefined
	database: string
	jwtTokenExpiry: number
	jwtRefreshExpiry: number
	jwtSecretKey: string
	refreshSecretKey: string
	orderIdPrefix: string
	frontEndUrl: string
	appName: string
	// Firebase Config for Firebase Cloud Messaging and download it from firebase console
	firebaseCreds: {
		type: string
		project_id: string
		private_key_id: string
		private_key: string
		client_email: string
		client_id: string
		auth_uri: string
		token_uri: string
		auth_provider_x509_cert_url: string
		client_x509_cert_url: string
		universe_domain: string
		
	}

	constructor() {
		super()
		this.databaseType = 'postgres'
		this.dbPassword = this.getValue('PGPASSWORD', 'mysecretpassword')
		this.dbUser = this.getValue('PGUSER', 'postgres')
		this.dbHost = this.getValue('PGHOST', 'localhost')
		this.dbPort = this.getValue('PGPORT', '5432')
		this.database = this.getValue('PGDATABASE', 'postgres')
		this.firebaseCreds = JSON.parse(this.getValue('FIREBASE_CREDS', '{}'))
		this.jwtTokenExpiry = parseTimespanToSeconds(this.getValue('JWT_TOKEN_EXPIRY', '1d'))
		this.jwtRefreshExpiry = parseTimespanToSeconds(this.getValue('JWT_REFRESH_EXPIRY', '7d'))
		this.jwtSecretKey = this.getValue('JWT_SECRET', 'mysecretjwt')
		this.refreshSecretKey = this.getValue('REFRESH_SECRET', 'mysecretrefresh')
		this.orderIdPrefix = this.getValue('ORDER_ID_PREFIX', 'ORD-')
		this.frontEndUrl = this.getValue('FRONTEND_URL', 'http://localhost:3000')
		this.appName = this.getValue('APP_NAME', 'Application')
		
	}
}

function parseTimespanToSeconds(val: string): number {
	const match = val.match(/^(\d+)([smhdwy]?)$/i)
	if (!match) {
		const parsed = Number(val)
		return isNaN(parsed) ? 0 : parsed
	}
	const num = parseInt(match[1], 10)
	const unit = match[2].toLowerCase()
	switch (unit) {
		case 's':
			return num
		case 'm':
			return num * 60
		case 'h':
			return num * 3600
		case 'd':
			return num * 86400
		case 'w':
			return num * 86400 * 7
		case 'y':
			return num * 86400 * 365
		default:
			return num
	}
}

const settings = new ApplicationSettings()

export default settings
