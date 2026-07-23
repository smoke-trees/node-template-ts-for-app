import { ErrorCode, Result, log } from '@smoke-trees/postgres-backend'
import fs from 'fs'
import { sendEmail } from '../../utils/ses/email'
import path from 'path'
import ejs from 'ejs'
import { injectable } from 'inversify'

export enum EjsTemplates {
	signIn = 'sign-in',
	signUp = 'sign-up',
	welcome = 'welcome',
	emailVerification = 'email-verification',
	forgotPasswordOtp = 'forgot-password-otp'
}

@injectable()
export class EmailService {
	emailTemplates: Map<EjsTemplates, { templateFile: string; subject: string }> = new Map()
	constructor() {
		this.emailTemplates = new Map([
			[
				EjsTemplates.signIn,
				{ templateFile: 'SIGN-IN.ejs', subject: '[Smoketrees Digital] Sign In' }
			],
			[
				EjsTemplates.signUp,
				{ templateFile: 'SIGN-UP.ejs', subject: '[Smoketrees Digital] Sign Up' }
			],
			[
				EjsTemplates.welcome,
				{ templateFile: 'WELCOME.ejs', subject: '[Smoketrees Digital] Welcome' }
			],
			[
				EjsTemplates.emailVerification,
				{
					templateFile: 'EMAIL_VERIFICATION.ejs',
					subject: '[Smoketrees Digital] Email Verification'
				}
			],
			[
				EjsTemplates.forgotPasswordOtp,
				{
					templateFile: 'FORGOT_PASSWORD_OTP.ejs',
					subject: '[Smoketrees Digital] Forgot Password OTP'
				}
			]
		])
	}

	async sendTemplateEmail(
		data: ejsRenderParamsType,
		recipient: {
			to: string[]
			cc?: string[]
			bcc?: string[]
			from?: string
			replyTo?: string
		}
		// configSet: string = "lms-app"
	): Promise<Result<string>> {
		const { templateName, params } = data
		const templateInfo = this.emailTemplates.get(templateName)
		try {
			if (!templateInfo || !templateInfo.templateFile) {
				return new Result(true, ErrorCode.BadRequest, 'Email template not found')
			}
			let subject = templateInfo.subject // Set default subject.
			if (params.subject) {
				subject = params.subject
			}
			const html = await this.generateHtml(data)
			const sendEmailResult = await sendEmail(
				subject,
				html,
				{ html: true },
				recipient.to,
				recipient.cc,
				recipient.bcc,
				recipient.from,
				recipient.replyTo
			)

			const result = new Result(
				!!sendEmailResult.$response.error,
				ErrorCode.Success,
				'Sent email request',
				sendEmailResult.MessageId
			)
			log.info('Email sent successfully', 'sendTemplateEmail', {
				templateName,
				params,
				recipient,
				sendEmailResult
			})
			return result
		} catch (error) {
			log.error('Error in sending email ', 'sendTemplateEmail', error, {
				templateName,
				params,
				recipient
			})
			return new Result(true, ErrorCode.BadRequest, 'Error in sending request')
		}
	}

	async generateHtml(data: ejsRenderParamsType) {
		const { templateName, params } = data
		const templateFile = this.emailTemplates.get(templateName)?.templateFile
		if (templateFile) {
			const template = fs
				.readFileSync(path.resolve(__dirname, '..', '..', '..', 'EmailTemplates', templateFile))
				.toString('utf-8')
			return ejs.render(template, params)
		}
		return
	}
}

export type ejsRenderParamsType =
	| {
			templateName: EjsTemplates.signIn
			params: {
				subject?: string
				otp: string
			}
	  }
	| {
			templateName: EjsTemplates.signUp
			params: {
				subject?: string
				otp: string
			}
	  }
	| {
			templateName: EjsTemplates.emailVerification
			params: {
				subject?: string
				firstName: string
				lastName: string
				verificationLink: string
				termsLink: string
				privacyLink: string
			}
	  }
	| {
			templateName: EjsTemplates.forgotPasswordOtp
			params: {
				subject?: string
				otp: string
				termsLink: string
				privacyLink: string
			}
	  }
	| {
			templateName: EjsTemplates.welcome
			params: {
				subject?: string
				firstName: string
				lastName: string
				termsLink: string
				privacyLink: string
				websiteLink: string
			}
	  }
