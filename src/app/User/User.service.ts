import { ErrorCode, Result, Service, log } from '@smoke-trees/postgres-backend'
import { User } from './User.entity'
import { UserDao } from './User.dao'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import settings from '../../settings'
import jwt from 'jsonwebtoken'
import { _QueryDeepPartialEntity, SelectedRead } from '@smoke-trees/postgres-backend/dist/core/Dao'
import { EntityManager, FindOneOptions, FindOptionsWhere, FindOptionsSelect } from 'typeorm'
import { ContextProvider } from '@smoke-trees/smoke-context'
import { UserType } from './IUser'
import { DeviceInfoEntity } from '../Notifications/DeviceInfo'
import { inject, injectable } from 'inversify'

import database from '../../database'
import RedisDatabaseObject from '../../redis/redis-connection'

@injectable()
export class UserService extends Service<User> {
	dao: UserDao
	constructor(
		@inject(UserDao)
		dao: UserDao
	) {
		super(dao)
		this.dao = dao
	}

	hashPassword(password: string) {
		return bcrypt.hashSync(password, 12)
	}

	async exportUserData(userId: string) {
		try {
			const userResult = await this.dao.read({
				where: { id: userId },
				relations: ['device']
			})
			if (userResult.status.error || !userResult.result) {
				return new Result(true, ErrorCode.NotFound, 'User not found')
			}
			const user = userResult.result as User & { device?: DeviceInfoEntity[] }

			const toIso = (value?: Date | null) =>
				value ?
					value instanceof Date ?
						value.toISOString()
					:	new Date(value).toISOString()
				:	null

			const devices = (user.device ?? []).map((device) => ({
				deviceId: device.deviceId ?? null,
				operatingSystem: device.os ?? null,
				appVersion: device.currentUserVersion ?? null,
				buildNumber: device.currentUserBuildNumber ?? null,
				fcmToken: device.fcmToken ?? null,
				ipAddress: device.deviceIpAddress ?? null,
				installedOn: toIso(device.installedTime),
				lastLoginOn: toIso(device.lastLoginTime),
				registeredOn: toIso(device.createdAt),
				lastUpdated: toIso(device.updatedAt)
			}))

			const exportData = {
				dataFiduciary: settings.appName,
				exportedOn: new Date().toISOString(),
				personalInformation: {
					id: user.id,
					firstName: user.firstname ?? null,
					lastName: user.lastname ?? null,
					email: user.email,
					emailVerified: user.emailVerified,
					phoneNumber: user.phoneNumber ?? null,
					country: user.country ?? null,
					countryCode: user.countryCode ?? null,
					accountType: user.type,
					isActive: user.isActive,
					registeredOn: toIso(user.createdAt),
					lastUpdated: toIso(user.updatedAt)
				},
				consent: {
					consentGiven: user.consentGiven ?? false,
					consentGivenOn: toIso(user.consentAt),
					consentVersion: user.consentVersion ?? null
				},
				devices
			}

			return new Result(false, ErrorCode.Success, 'User data exported successfully', exportData)
		} catch (error) {
			log.error('Error exporting user data', 'UserService.exportUserData', error, {
				userId
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error exporting user data')
		}
	}

	async deleteAccount(userId: string) {
		try {
			if (settings.userSoftDelete) {
				const userResult = await this.dao.read(userId)
				if (userResult.status.error || !userResult.result) {
					return new Result(true, ErrorCode.NotFound, 'User not found')
				}
				const originalEmail = userResult.result.email
				const deletedEmail = `deleted_${Date.now()}_${originalEmail}`
				const result = await this.dao.update(userId, {
					isActive: false,
					isSoftDeleted: true,
					softDeletedAt: new Date(),
					email: deletedEmail
				})
				if (result.status.error) {
					return result
				}
				return new Result(false, ErrorCode.Success, 'Account deleted successfully')
			} else {
				const result = await this.dao.delete({ id: userId })
				if (result.status.error) {
					return result
				}
				return new Result(false, ErrorCode.Success, 'Account deleted successfully')
			}
		} catch (error) {
			log.error('Error deleting account', 'UserService.deleteAccount', error, {
				userId
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error deleting account')
		}
	}

	async login(email: string, password: string) {
		const user = await this.dao.read({
			where: { email: email.toLowerCase(), isActive: true, isSoftDeleted: false }
		})
		if (user.status.error || !user.result) {
			return new Result(true, ErrorCode.NotAuthorized, 'User not found')
		}
		const hashedPassword = await bcrypt.compare(password, user.result.password)
		if (!hashedPassword) {
			return new Result(true, ErrorCode.NotAuthorized, 'Incorrect Password')
		}
		if (user.result && user.status.error === false) {
			if (!user.result.emailVerified) {
				await this.createVerificationLink(user.result.id)
			}
			return this.generateTokens(user.result)
		} else {
			return new Result(true, ErrorCode.InternalServerError, user.message)
		}
	}

	async signUp(
		email: string,
		password: string,
		consentGiven?: boolean | null,
		consentAt?: Date | null,
		consentVersion?: string | null
	) {
		const user = await this.dao.read({
			where: { email: email.toLowerCase(), isActive: true, isSoftDeleted: false }
		})
		if (user.result) {
			return new Result(true, ErrorCode.NotAuthorized, 'User Already Exists')
		}
		const preHash = Date.now()
		const hashedPassword = this.hashPassword(password)
		const postHash = Date.now() - preHash
		const createUser = await this.dao.create({
			email: email.toLowerCase(),
			password: hashedPassword,
			...(consentGiven ?
				{
					consentGiven: true,
					consentAt: consentAt ?? new Date(),
					consentVersion: consentVersion ?? '1.0.0'
				}
			:	{})
		})
		const postCreate = Date.now() - postHash
		if (createUser.status.error || !createUser.result) {
			return createUser
		}
		const preLinkCreate = Date.now() - postCreate
		await this.createVerificationLink(createUser.result.toString())
		const postLinkCreate = Date.now() - preLinkCreate
		log.debug('Signup timings', 'UserService/signUp', {
			preHash,
			postHash,
			preLinkCreate,
			postLinkCreate
		})
		const userResult = await this.dao.read(createUser.result!)
		if (userResult.result && userResult.status.error === false) {
			return this.generateTokens(userResult.result)
		} else {
			return new Result(true, ErrorCode.InternalServerError, 'Error in creating user')
		}
		// return new Result(false, ErrorCode.Success, "Sign Up Succesfull! A Verification Email is sent, Please verify your email. ");
	}

	async resendVerifyEmail(userId: string) {
		if (!userId) {
			return new Result(true, ErrorCode.BadRequest, 'Invalid user id')
		}
		return this.createVerificationLink(userId)
	}

	async createVerificationLink(userId: string, redirectionLink?: string) {
		try {
			const user = await this.dao.read(userId)
			if (!user.result) return user
			const nonce = crypto.randomBytes(64).toString('base64')
			const signString = crypto.createHash('sha256')
			signString.update(user.result?.email + nonce)
			const signature = signString.digest('hex')
			const generatedAt = new Date()

			const { connection } = await RedisDatabaseObject

			const result = await connection.hset(`email-verify:${signature}`, {
				email: user.result.email,
				userId,
				redirectionLink,
				generatedAt: generatedAt.toISOString()
			})

			const expire = await connection.expire(`email-verify:${signature}`, 604800, 'NX')
			log.debug('Email verification creation result', 'createVerificationLink', {
				result,
				expire
			})
			// Send email verification email commented out as email services are removed
			/*
      this.emailService.sendTemplateEmail(
        {
          templateName: EjsTemplates.emailVerification,
          params: {
            firstname: user.result?.firstname || "User",
            lastname: user.result?.lastname || "User",
            verificationLink: `${settings.frontEndUrl}/verify-email/${signature}`,
            termsLink: `${settings.frontEndUrl}/terms-and-conditions`,
            privacyLink: `${settings.frontEndUrl}/privacy-policy`,
          },
        },
        { to: [user.result.email] }
      );
      */

			return new Result(false, ErrorCode.Success, 'Generated email verification string', signature)
		} catch (error) {
			log.error(
				'Error in generating verification string',
				'UserService.createVerificationLink',
				error,
				{
					userId
				}
			)
			return new Result(
				true,
				ErrorCode.InternalServerError,
				'Error in generating verification string'
			)
		}
	}

	async verifyEmail(signingString: string): Promise<Result<{ link: string }>> {
		try {
			const { connection } = await RedisDatabaseObject
			const data = await connection.hgetAll(`email-verify:${signingString}`)

			if (data) {
				const userId = data.userId
				log.debug('Data in redis', 'verifyEmail', { data, signingString })
				// if (!data.redirectionLink) {
				//   log.warn("Invalid data in redis ", "verifyEmail", { userId });
				//   return new Result(
				//     true,
				//     ErrorCode.BadRequest,
				//     "Error in verifying email"
				//   );
				// }
				if (!userId) {
					log.warn('Invalid data in redis ', 'verifyEmail', { userId })
					return new Result(true, ErrorCode.BadRequest, 'Error in verifying email')
				}
				const userResult = await this.dao.read(userId)
				if (!userResult.result || !userResult.result.isActive || userResult.result.isSoftDeleted) {
					return new Result(true, ErrorCode.BadRequest, 'User not found')
				}
				if (data.email === userResult.result.email) {
					await this.dao.update(userId, {
						emailVerified: true
					})
					// Send welcome email commented out as email services are removed
					/*
          this.emailService.sendTemplateEmail(
            {
              templateName: EjsTemplates.welcome,
              params: {
                firstname: userResult.result.firstname || "",
                lastname: userResult.result.lastname || "",
                termsLink: `${settings.frontEndUrl}/terms-and-conditions`,
                privacyLink: `${settings.frontEndUrl}/privacy-policy`,
                websiteLink: `${settings.frontEndUrl}`,
              },
            },
            { to: [userResult.result.email || data.email] }
          );
          */
				}
				await connection.del(`email-verify:${signingString}`)

				return new Result(false, ErrorCode.Success, 'Verified email', {
					link: data.redirectionLink,
					userId
				})
			} else {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid email used')
			}
		} catch (error) {
			log.error('Error in verifying email', 'UserService.verifyEmail', error, {
				signingString
			})
			return new Result(true, ErrorCode.InternalServerError, 'Error in verifying email')
		}
	}

	async generateTokens(user: User) {
		const tid = crypto.randomUUID()
		const refreshTokenId = crypto.randomUUID()
		const tokenExpiry = settings.jwtTokenExpiry
		const refreshExpiry = settings.jwtRefreshExpiry

		const { password, ...safeUser } = user
		const token = jwt.sign(
			{
				...safeUser,
				userId: user.id,
				tid,
				tokenExpiry
				// exp: tokenExpiry,
			},
			settings.jwtSecretKey,
			{ algorithm: 'HS256', expiresIn: tokenExpiry }
		)

		const refreshToken = jwt.sign(
			{
				tid: refreshTokenId
				// exp: refreshExpiry
			},
			settings.refreshSecretKey,
			{
				algorithm: 'HS256',
				expiresIn: refreshExpiry
			}
		)
		const { connection } = await RedisDatabaseObject
		await connection.set(`refresh-token:${refreshTokenId}`, user.id, 'EX', refreshExpiry)
		return new Result(false, ErrorCode.Success, 'Success', {
			accessToken: token,
			refreshToken,
			expiresIn: tokenExpiry,
			refreshExpiresIn: refreshExpiry,
			type: 'Bearer'
		})
	}

	async refreshToken(token: string) {
		try {
			const decodeToken = jwt.verify(token, settings.refreshSecretKey, {
				algorithms: ['HS256']
			}) as { tid: string }

			const { connection } = await RedisDatabaseObject

			const refreshData = await connection.get(`refresh-token:${decodeToken.tid}`)
			if (!refreshData) {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid Token')
			}

			const user = await this.dao.read(refreshData)
			if (user.status.error || !user.result || !user.result.isActive || user.result.isSoftDeleted) {
				return new Result(true, ErrorCode.NotAuthorized, 'Invalid Token')
			}
			return this.generateTokens(user.result)
		} catch (e) {
			log.error('Error Refreshing token', 'UserService.refreshToken', e)
			return new Result(true, ErrorCode.InternalServerError, 'Unknown Error Occured')
		}
	}

	async invalidateToken(token: string) {
		try {
			const decodeToken = jwt.verify(token, settings.refreshSecretKey, {
				algorithms: ['HS256']
			}) as { tid: string }

			const { connection } = await RedisDatabaseObject

			await connection.del(`refresh-token:${decodeToken.tid}`)
			return new Result(false, ErrorCode.Success, 'Success')
		} catch (e) {
			log.error('Error Invalidating token', 'UserService.invalidateToken', e)
			return new Result(true, ErrorCode.InternalServerError, 'Unknown Error Occured')
		}
	}

	async forgotPasswordGetOTP(email: string) {
		const normalizedEmail = email.toLowerCase()
		const user = await this.dao.read({ where: { email: normalizedEmail } })
		if (user.status.error || !user.result || !user.result.isActive || user.result.isSoftDeleted) {
			return new Result(true, ErrorCode.NotFound, 'User not found')
		}

		if (user.result.emailVerified) {
			const otp = process.env.NODE_ENV === 'production' ? Date.now().toString().slice(-6) : '123456'
			const { connection } = await RedisDatabaseObject
			await connection.set(`reset-password:${normalizedEmail}`, otp, 'EX', 15 * 60)
			if (user.result?.email && user.result?.email === normalizedEmail) {
				// Send OTP email commented out as email services are removed
				/*
        const sentResult = await this.emailService.sendTemplateEmail(
          {
            templateName: EjsTemplates.forgotPasswordOtp,
            params: {
              otp: otp,
              privacyLink: `${settings.frontEndUrl}/privacy-policy`,
              termsLink: `${settings.frontEndUrl}/terms-and-conditions`,
            },
          },
          { to: [user.result.email] }
        );

        if (sentResult.status.error) {
          return new Result(true, ErrorCode.InternalServerError, "Error in sending OTP");
        }
        */

				return new Result(false, ErrorCode.Success, 'Successfully sent OTP')
			}

			return new Result(true, ErrorCode.InternalServerError, 'Error in sending OTP')
		} else {
			await this.createVerificationLink(user.result.id)
			return new Result(
				true,
				ErrorCode.NoUpdatesPerformed,
				'A Verification Email is sent, Please verify your email.'
			)
		}
	}

	async forgotPasswordChange(email: string, otp: string, newPassword: string) {
		const { connection } = await RedisDatabaseObject
		const otpRead = await connection.get(`reset-password:${email}`)
		if (!otpRead || otp !== otpRead) {
			return new Result(true, ErrorCode.BadRequest, 'Incorrect OTP')
		}
		const hashedPassword = this.hashPassword(newPassword)
		return this.dao.update({ email }, { password: hashedPassword })
	}

	async resetPassword(userId: string, oldPassword: string, newPassword: string) {
		const user = await this.dao.read(userId)
		if (user.status.error || !user.result) return user
		const oldHash = await bcrypt.compare(oldPassword, user.result.password)
		if (!oldHash) {
			return new Result(true, ErrorCode.NotAuthorized, 'Incorrect password')
		}
		const newHash = this.hashPassword(newPassword)
		return await this.dao.update(user.result.id, { password: newHash })
	}

	async create(
		value: _QueryDeepPartialEntity<User> | _QueryDeepPartialEntity<User>[],
		manager?: EntityManager
	): Promise<Result<number | string | null>> {
		if (Array.isArray(value)) {
			for (const v of value) {
				if (!v.password) return new Result(true, ErrorCode.BadRequest, 'Password is required')
				v.password = this.hashPassword(v.password as string)
			}
		} else {
			if (!value.password) return new Result(true, ErrorCode.BadRequest, 'Password is required')
			value.password = this.hashPassword(value.password as string)
		}
		return super.create(value, manager)
	}

	async readOne<S extends FindOptionsSelect<User> | undefined = undefined>(
		filter: string | number | (Omit<FindOneOptions<User>, 'select'> & { select?: S }),
		manager?: EntityManager
	): Promise<Result<SelectedRead<User, S> | null>> {
		const { values } = ContextProvider.getContext()

		if (!values?.type) {
			return new Result(true, ErrorCode.NotAuthorized, 'Not Authorized') as any
		}

		const result = await super.readOne(filter, manager)

		if (!result.result) {
			return result as any
		}

		const userResult = result.result as any
		if (values.type === UserType.student && userResult?.id !== values.id) {
			return new Result(true, ErrorCode.NotAuthorized, 'Not Authorized') as any
		}
		return result as any
	}

	async update(
		id: string | number | FindOptionsWhere<User>,
		values: {
			id?: string | (() => string) | undefined
			firstname?: (() => string) | (string | undefined)
			lastname?: (() => string) | (string | undefined)
			email?: string | (() => string) | undefined
			emailVerified?: (() => string) | boolean | undefined
			password?: string | (() => string) | undefined
			type?: (() => string) | UserType | undefined
			country?: (() => string) | (string | undefined)
		},
		manager?: EntityManager
	): Promise<Result<number | null>> {
		const context = ContextProvider.getContext().values
		if (!context?.type) {
			return new Result(true, ErrorCode.NotAuthorized, 'Not Authorized')
		}
		if (context.type === UserType.admin) {
			if (values.password) {
				values.password = this.hashPassword(values.password as string)
			}
			return super.update(id, values, manager)
		}
		delete values.password
		delete values.type
		delete values.emailVerified
		delete values.email
		return super.update(id, values, manager)
	}
}
