import { App, initializeApp, cert, ServiceAccount, getApps, getApp } from 'firebase-admin/app'
import {
	getMessaging,
	BatchResponse,
	MulticastMessage,
	TopicMessage
} from 'firebase-admin/messaging'
import { FCMNotificationRequest } from './Notification.service'
import { log } from '@smoke-trees/postgres-backend'
import settings from '../../../settings'
import { injectable } from 'inversify'

const serviceAccount = settings.firebaseCreds

@injectable()
export class FirebaseMessagingClient {
	private firebaseAdmin: App

	constructor() {
		log.info('Initializing Firebase Admin', 'FirebaseMessagingClient.constructor')
		if (serviceAccount && serviceAccount.project_id) {
			try {
				this.firebaseAdmin =
					getApps().length === 0 ?
						initializeApp({
							credential: cert(serviceAccount as ServiceAccount)
						})
					:	getApp()
				log.info('Firebase Admin successfully initialized', 'FirebaseMessagingClient.constructor')
			} catch (e) {
				log.error('Error initializing Firebase Admin', 'FirebaseMessagingClient.constructor', e)
				this.firebaseAdmin = {} as App
			}
		} else {
			log.info(
				'Firebase credentials not found, initializing in dummy mode',
				'FirebaseMessagingClient.constructor'
			)
			this.firebaseAdmin = {} as App
		}
	}

	async sendMulticastMessage(
		tokens: string[],
		notification: FCMNotificationRequest
	): Promise<BatchResponse | null> {
		if (!this.firebaseAdmin || !this.firebaseAdmin.name) {
			log.warn(
				'Firebase Admin is not initialized. Skipping notification.',
				'FirebaseMessagingClient.sendMulticastMessage'
			)
			return null
		}
		const data: { [key: string]: string } = {}
		if (notification.redirectParameters && notification.redirectParameters.length > 0) {
			notification.redirectParameters?.forEach((e) => {
				data[e.key] = e.value?.toString()
			})
		}
		const message: MulticastMessage = {
			notification: {
				title: notification.title,
				body: notification.body
			},
			apns: {
				payload: {
					aps: {
						mutableContent: true
					}
				}
			},
			tokens
		}
		if (notification.redirectParameters && notification.redirectParameters.length > 0) {
			message.data = data
		}
		if (notification.imageUrl) {
			message.android = {
				notification: {
					imageUrl: notification.imageUrl ?? undefined
				}
			}
			message.apns!.fcmOptions = {
				imageUrl: notification.imageUrl ?? undefined
			}
		}
		try {
			const response = await getMessaging(this.firebaseAdmin).sendEachForMulticast(message)
			log.info(
				'Successfully sent Bulk FCM Notification',
				'FirebaseMessagingClient.sendMulticastMessage',
				{ response }
			)
			return response
		} catch (e) {
			log.error(
				`Error in sending Bulk FCM Notification`,
				'FirebaseMessagingClient.sendMulticastMessage',
				e
			)
			return null
		}
	}

	async sendMessageToTopic(
		topic: string,
		notification: FCMNotificationRequest
	): Promise<string | null> {
		if (!this.firebaseAdmin || !this.firebaseAdmin.name) {
			log.warn(
				'Firebase Admin is not initialized. Skipping notification.',
				'FirebaseMessagingClient.sendMessageToTopic'
			)
			return null
		}
		const data: { [key: string]: string } = {}
		notification.redirectParameters?.forEach((e) => {
			data[e.key] = e.value.toString()
		})
		const message: TopicMessage = {
			notification: {
				title: notification.title,
				body: notification.body
			},
			android: {
				notification: {
					imageUrl: notification.imageUrl ?? undefined
				}
			},
			apns: {
				payload: {
					aps: {
						mutableContent: true
					}
				},
				fcmOptions: {
					imageUrl: notification.imageUrl ?? undefined
				}
			},
			data,
			topic
		}
		try {
			const response = await getMessaging(this.firebaseAdmin).send(message)
			log.info(
				`Successfully sent FCM Notification to topic: ${topic}`,
				'FirebaseMessagingClient.sendMessageToTopic',
				{ response }
			)
			return response
		} catch (e) {
			log.error(
				`Error in sending FCM Notification to topic: ${topic}`,
				'FirebaseMessagingClient.sendMessageToTopic',
				e
			)
			return null
		}
	}

	async subscribeToTopic(tokens: string[], topic: string) {
		if (!this.firebaseAdmin || !this.firebaseAdmin.name) {
			log.warn(
				'Firebase Admin is not initialized. Skipping topic subscription.',
				'FirebaseMessagingClient.subscribeToTopic'
			)
			return null
		}
		const response = await getMessaging(this.firebaseAdmin).subscribeToTopic(tokens, topic)
		log.info(
			`Successfully subscribed to topic: ${topic}`,
			'FirebaseMessagingClient.subscribeToTopic',
			{ response }
		)
		return response
	}
}
