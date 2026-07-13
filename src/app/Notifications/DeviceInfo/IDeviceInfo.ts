export interface IDeviceInfoCreateModel {
	id?: number
	userId: string
	fcmToken: string | null
	deviceId: string | null
	os?: string
	currentUserVersion: string | null
	currentUserBuildNumber: string | null
	installedTime: Date | null
	deviceIpAddress: string | null
	lastLoginTime: Date | null
}

export type IDeviceInfoModel = IDeviceInfoCreateModel
