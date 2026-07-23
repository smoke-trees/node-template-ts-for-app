export interface IUser {
	id: string
	firstName?: string
	lastName?: string
	email: string
	emailVerified: boolean
	password: string
	userType: UserType
	phoneNumber?: string
	countryCode?: string
	isSoftDeleted: boolean
	softDeletedAt: Date | null
	isActive: boolean
	consentGiven?: boolean | null
	consentAt?: Date | null
	consentVersion?: string | null
	appleUserId?: string
	googleUserId?: string
	signupType: SignupType
}

export enum UserType {
	user = 'user',
	ops = 'ops',
	admin = 'admin'
}

export enum SignupType {
	email = 'email',
	google = 'google',
	apple = 'apple',
	phone = 'phone'
}

export interface IGCPTokenRes {
	access_token: string
	expires_in: number
	scope: string
	token_type: string
	id_token: string
}

export interface IGCPUserInfo {
	id: string
	email: string
	verified_email: boolean
	name: string
	given_name: string
	family_name: string
	picture: string
}
