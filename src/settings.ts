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
	userSoftDelete: boolean
	maxSessionsPerUser: number
	// AWS storage config
	awsAccessKey: string;
	awsSecretKey: string;
	awsRegion: string;
  	awsProfileName: string;
  	defaultEmailSender: string;
  	s3Bucket: string;
  	s3Folder: string;

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

	gcpLoginCreds: {
		userInfoUrl: string
	}
	appleLoginCreds: {
		loginUrl: string
		scope: string
		responseMode: string
		redirectUri: string
		clientId: string
		clientSecret: string
		teamId: string
		keyId: string
		tokenUrl: string
		appBundleId: string
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
		this.userSoftDelete = this.getValue('USER_SOFT_DELETE', 'true') === 'true'
		this.maxSessionsPerUser = parseInt(this.getValue('MAX_SESSIONS_PER_USER', '5'), 10)
		this.awsAccessKey = this.getValue('AWS_ACCESS_KEY', '')
		this.awsSecretKey = this.getValue('AWS_SECRET_KEY', '')
		this.awsRegion = this.getValue('AWS_REGION', '')
		this.awsProfileName = this.getValue('AWS_PROFILE_NAME', '')
		this.defaultEmailSender = this.getValue('DEFAULT_EMAIL_SENDER', '')
		this.s3Bucket = this.getValue('S3_BUCKET', '')
		this.s3Folder = this.getValue('S3_FOLDER', '')
		this.gcpLoginCreds = {
			userInfoUrl: this.getValue(
				'GCP_USER_INFO_URL',
				'https://www.googleapis.com/oauth2/v1/userinfo'
			)
		}
		this.appleLoginCreds = {
			loginUrl: this.getValue('APPLE_LOGIN_URL', 'https://appleid.apple.com/auth/authorize'),
			scope: this.getValue('APPLE_LOGIN_SCOPE', 'email name'),
			responseMode: this.getValue('APPLE_LOGIN_RESPONSE_MODE', 'form_post'),
			redirectUri: this.getValue(
				'APPLE_LOGIN_REDIRECT_URI',
				'https://fomo-backend.smoketrees.in/users/apple-hook'
			),
			clientId: this.getValue('APPLE_LOGIN_CLIENT_ID', 'staging.login.test'),
			clientSecret: this.getValue('APPLE_LOGIN_CLIENT_SECRET', ''),
			teamId: this.getValue('APPLE_LOGIN_TEAM_ID', ''),
			keyId: this.getValue('APPLE_LOGIN_KEY_ID', ''),
			tokenUrl: this.getValue('APPLE_LOGIN_TOKEN_URL', 'https://appleid.apple.com/auth/token'),
			appBundleId: this.getValue('APPLE_APP_BUNDLE_ID', '')
		}
	}

	get defaultAppSettings(): Record<string, string> {
		return {
			forceUpdateMinimumVersionAndroid: '1.0.0',
			softUpdateMinimumVersionAndroid: '1.0.0',
			forceUpdateMinimumVersionIos: '1.0.0',
			softUpdateMinimumVersionIos: '1.0.0'
		}
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
