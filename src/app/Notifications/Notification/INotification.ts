// import { User } from "../../User/user.entity";
export interface IRedirectParameters {
	key: string
	value: string
}

export interface INotificationCreateModel {
	id?: number
	userId?: string
	batchId: string | null
	notificationToken: string | null
	imageUrl?: string | null
	phoneNumber: string | null
	title: string | null
	body: string | null
	notificationType: NotificationType
	redirectParameters: IRedirectParameters[] | null
	notificationSent: boolean | null
	notificationFailureData: any | null
	read?: boolean
}

export type INotificationModel = INotificationCreateModel

export enum NotificationType {
	Promotional = 'PROMOTIONAL'
}

export interface IManualNotificationAdmin {
	receiverType: NotificationReceivers
	receiverIds?: string[]
	title: string
	body: string
	imageUrl?: string
	clickParams: NotificationClickParams
}

export enum NotificationReceivers {
	All = 'All',
	User = 'User'
	// Form = "Form",
	// Series = "Series",
	// Subscription = "Subscription",
	// ActiveSubscription = "Active Subscription",
}

export enum RedirectType {
	Course = 'Course',
	Series = 'Series',
	Subscription = 'Subscription',
	Website = 'Website'
}
export type NotificationClickParams =
	| {
			type: RedirectType.Course
			params: {
				courseId: string
			}
	  }
	| {
			type: RedirectType.Series
			params: {
				seriesId: string
			}
	  }
	| {
			type: RedirectType.Subscription
			params: {
				subscriptionId: string
			}
	  }
	| {
			type: RedirectType.Website
			params: {
				url: string
			}
	  }
