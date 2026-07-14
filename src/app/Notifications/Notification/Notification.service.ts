import { DeviceInfoDao, DeviceInfoEntity } from '../DeviceInfo'
import { NotificationDao } from './Notification.dao'
import { Notification } from './Notification.entity'
import {
	IManualNotificationAdmin,
	IRedirectParameters,
	NotificationReceivers,
	RedirectType
} from './INotification'
import { NotificationType } from './INotification'
import { FirebaseMessagingClient } from './notificationClient'
import crypto from 'crypto'
import { Documentation, ErrorCode, Result, Service, log } from '@smoke-trees/postgres-backend'
import { In, MoreThanOrEqual } from 'typeorm'
import { inject, injectable } from 'inversify'
import { UserDao } from '../../User/User.dao'
import { UserTopicsDao } from '../UserTopics/UserTopics.dao'

@Documentation.addSchema()
export class NotificationVariableData {
	@Documentation.addField({ type: 'string', nullable: true })
	userName?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	userStatus?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	giftName?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	catalogueName?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	amount?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	points?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	payoutStatus?: string | null

	@Documentation.addField({ type: 'string', nullable: true })
	giftStatus?: string | null

	constructor(
		userName: string | null,
		userStatus: string | null,
		giftName: string | null,
		catalogueName: string | null,
		amount: string | null,
		points: string | null,
		payoutStatus: string | null,
		giftStatus: string | null
	) {
		this.userName = userName ?? null
		this.userStatus = userStatus ?? null
		this.giftName = giftName ?? null
		this.catalogueName = catalogueName ?? null
		this.amount = amount ?? null
		this.points = points ?? null
		this.payoutStatus = payoutStatus ?? null
		this.giftStatus = giftStatus ?? null
	}
}

@Documentation.addSchema()
export class FCMNotificationRequest {
	@Documentation.addField({ type: 'string', nullable: false })
	title: string

	@Documentation.addField({ type: 'string', nullable: false })
	body: string

	@Documentation.addField({ type: 'string', nullable: true })
	imageUrl?: string | null

	@Documentation.addField({ type: 'object', default: [] })
	redirectParameters: IRedirectParameters[] | null

	constructor(
		title: string,
		body: string,
		imageUrl: string | null,
		redirectParameters: IRedirectParameters[] | null
	) {
		this.title = title
		this.body = body
		this.imageUrl = imageUrl || undefined
		this.redirectParameters = redirectParameters
	}
}

@injectable()
export class NotificationService extends Service<Notification> {
	userDao: UserDao
	deviceInfoDao: DeviceInfoDao
	firebaseMessagingClient: FirebaseMessagingClient
	userTopicsDao: UserTopicsDao
	constructor(
		@inject(NotificationDao)
		dao: NotificationDao,
		@inject(DeviceInfoDao)
		deviceInfoDao: DeviceInfoDao,
		@inject(FirebaseMessagingClient)
		firebaseMessagingClient: FirebaseMessagingClient,
		@inject(UserDao)
		userDao: UserDao,
		@inject(UserTopicsDao)
		userTopicsDao: UserTopicsDao
	) {
		super(dao)
		this.deviceInfoDao = deviceInfoDao
		this.firebaseMessagingClient = firebaseMessagingClient
		this.userDao = userDao
		this.userTopicsDao = userTopicsDao
	}

	createRawString(notificationString: string, variables: NotificationVariableData): string {
		for (let i = 0; i < Object.keys(variables).length; i++) {
			notificationString = notificationString.replace(
				`\${${Object.keys(variables)[i]}}`,
				Object.values(variables)[i]
			)
		}
		return notificationString
	}

	// async sendSinglePushNotification(notification: NotificationEntity) {}

	async sendFCMNotificationToDevices(
		devices: DeviceInfoEntity[],
		notificationCreate: FCMNotificationRequest
	): Promise<Result<null>> {
		const fcmDevices = devices!.filter((device) => Boolean(device.fcmToken))
		const fcmTokens = fcmDevices.map((device) => device.fcmToken) as string[]

		const fcmResponses = await this.firebaseMessagingClient.sendMulticastMessage(
			fcmTokens,
			notificationCreate
		)

		log.debug('FCM response', 'sendFCMNotificationToDevices', { fcmResponses })
		if (fcmResponses != null) {
			return new Result(false, ErrorCode.Success, 'Created Successfully')
		} else {
			return new Result(
				false,
				ErrorCode.InternalServerError,
				'Error in sending FCM Notification',
				fcmResponses
			)
		}
	}

	async addNotificationToUser(
		userId: string,
		notification: FCMNotificationRequest,
		batchId: string
	): Promise<Result<null>> {
		const notificationEntity = new Notification({
			userId: userId,
			notificationToken: null,
			title: notification.title,
			body: notification.body,
			imageUrl: notification.imageUrl,
			redirectParameters: notification.redirectParameters,
			phoneNumber: null,
			notificationType: NotificationType.Promotional,
			notificationSent: true,
			notificationFailureData: null,
			batchId
		})
		await this.create(notificationEntity)
		return new Result(false, ErrorCode.Success, 'Success', null)
	}

	async sendFCMNotificationToUser(userId: string, notificationCreate: FCMNotificationRequest) {
		const notificationEntity = new Notification({
			userId: userId,
			notificationToken: null,
			title: notificationCreate.title,
			body: notificationCreate.body,
			imageUrl: notificationCreate.imageUrl,
			redirectParameters: notificationCreate.redirectParameters,
			phoneNumber: null,
			notificationType: NotificationType.Promotional,
			notificationSent: true,
			notificationFailureData: null,
			batchId: crypto.randomUUID()
		})
		await this.create(notificationEntity)
		// const devices = await this.deviceInfoDao.readManyWithoutPagination(undefined, undefined, { userId });
		const devices = await this.deviceInfoDao.readMany({ where: { userId } })
		if (devices.status.error) {
			return devices
		}
		if (!devices.result || devices.result.length === 0) {
			return new Result(false, ErrorCode.Success, 'No devices found for user')
		}

		return this.sendFCMNotificationToDevices(devices.result, notificationCreate)
	}

	async sendMessageToTopic(topic: string, notificationCreate: IManualNotificationAdmin) {
		try {
			const notificationBody = this.createNotificationBody(notificationCreate)
			const messageId = await this.firebaseMessagingClient.sendMessageToTopic(
				topic,
				notificationBody
			)
			if (messageId == null) {
				return new Result(
					true,
					ErrorCode.InternalServerError,
					'Error in sending FCM Notification to topic'
				)
			}

			const subscribers = await this.userTopicsDao.readMany({ where: { topicName: topic } })
			if (subscribers.result && subscribers.result.length > 0) {
				const batchId = crypto.randomUUID()
				for (const subscriber of subscribers.result) {
					const notificationEntity = new Notification({
						userId: subscriber.userId,
						notificationToken: null,
						title: notificationBody.title,
						body: notificationBody.body,
						imageUrl: notificationBody.imageUrl ?? null,
						redirectParameters: notificationBody.redirectParameters,
						phoneNumber: null,
						notificationType: NotificationType.Promotional,
						notificationSent: true,
						notificationFailureData: null,
						batchId,
						topicName: topic
					})
					this.create(notificationEntity)
				}
			}

			return new Result(false, ErrorCode.Success, 'Sent Successfully', 1)
		} catch (error) {
			log.error(
				'Error in sending FCM Notification to topic',
				'NotificationService.sendMessageToTopic',
				error,
				{
					topic
				}
			)
			return new Result(
				true,
				ErrorCode.InternalServerError,
				'Error in sending FCM Notification to topic'
			)
		}
	}

	async manualAdminNotification(body: IManualNotificationAdmin) {
		const notification = this.createNotificationBody(body)
		if (body.receiverType === NotificationReceivers.User) {
			if (body.receiverIds && body.receiverIds.length > 0) {
				body.receiverIds.forEach((e) => this.sendFCMNotificationToUser(e, notification))
			}
		}

		return new Result(false, ErrorCode.Success, 'Initiated Notifications')
	}

	createNotificationBody(body: IManualNotificationAdmin) {
		const result: FCMNotificationRequest = {
			title: body.title,
			body: body.body,
			redirectParameters: []
		}
		if (body.imageUrl) {
			result.imageUrl = body.imageUrl
		}
		const clickParams = body.clickParams as any
		if (clickParams && clickParams.type) {
			result.redirectParameters?.push({
				key: 'type',
				value: clickParams.type
			})
		} else {
			return result
		}
		switch (clickParams.type) {
			case RedirectType.Course:
				result.redirectParameters?.push({
					key: 'courseId',
					value: clickParams.params?.courseId
				})
				break
			case RedirectType.Series:
				result.redirectParameters?.push({
					key: 'seriesId',
					value: clickParams.params?.seriesId
				})
				break
			case RedirectType.Subscription:
				result.redirectParameters?.push({
					key: 'subscriptionId',
					value: clickParams.params?.subscriptionId
				})

				break
			case RedirectType.Website:
				result.redirectParameters?.push({
					key: 'url',
					value: clickParams.params?.url
				})
				break

			//   case RedirectType.Variant:
			//     result.redirectParameters?.push({
			//       key: "variantId",
			//       value: body.clickParams.params.varientId,
			//     });
			//     result.redirectParameters?.push({
			//       key: "varientType",
			//       value: body.clickParams.params.varientType,
			//     });
			//     break;
			default:
				break
		}
		return result
	}
}
