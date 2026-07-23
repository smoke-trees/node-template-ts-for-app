import settings from '../../settings'
import aws from 'aws-sdk'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MimeMessage = require('mimemessage')

if (settings.awsAccessKey && settings.awsSecretKey) {
	aws.config.update({
		secretAccessKey: settings.awsSecretKey,
		accessKeyId: settings.awsAccessKey,
		region: settings.awsRegion
	})
}

if (settings.awsProfileName) {
	const profile = new aws.SharedIniFileCredentials({
		profile: settings.awsProfileName
	})
	aws.config.update({
		region: settings.awsRegion,
		credentials: profile
	})
}

const ses = new aws.SES({ apiVersion: '2010-12-01' })
export const sendEmail = async (
	subject: string,

	/* eslint-disable @typescript-eslint/no-explicit-any */
	body: any,
	options: any,
	/* eslint-enable @typescript-eslint/no-explicit-any */

	to: string[],
	cc?: string[],
	bcc?: string[],
	fromEmail = settings.defaultEmailSender,
	replyTo = settings.defaultEmailSender,
	configSet?: string
) => {
	let params: aws.SES.Types.SendEmailRequest | aws.SES.SendRawEmailRequest
	if (options.html) {
		params = {
			Destination: {
				ToAddresses: to
			},
			Message: {
				Body: {
					Html: {
						Charset: 'UTF-8',
						Data: body
					}
				},
				Subject: {
					Charset: 'UTF-8',
					Data: subject
				}
			},
			Source: fromEmail, // to be changed later
			ReplyToAddresses: [replyTo],
			ConfigurationSetName: configSet
		}
	} else if (options.raw) {
		params = {
			Destinations: [
				...to.map((a) => `To:${a}`),
				...(cc?.map((a) => `CC:${a}`) || []),
				...(bcc?.map((a) => `BCC:${a}`) || []),
				`Reply-To:${replyTo}`
			],
			RawMessage: {
				Data: body
			},
			Source: fromEmail, // to be changed later
			ConfigurationSetName: configSet
		}
		const result = await ses.sendRawEmail(params).promise()
		return result
	} else {
		params = {
			Destination: {
				ToAddresses: to // Email address/addresses that you want to send your email
			},
			Message: {
				Body: {
					Text: {
						Charset: 'UTF-8',
						Data: body
					}
				},
				Subject: {
					Charset: 'UTF-8',
					Data: subject
				}
			},
			Source: fromEmail, // to be changed later
			ReplyToAddresses: [replyTo],
			ConfigurationSetName: configSet
		}
	}

	if (cc) {
		params.Destination.CcAddresses = cc
	}
	if (bcc) {
		params.Destination.BccAddresses = bcc
	}

	const result = await ses.sendEmail(params).promise()
	return result
}

export const sendEmailWithAttachment = async (
	to: string,
	subject: string,
	pdfs?: { data: Buffer; name: string }[],
	emailHtml?: string,
	fromEmail = settings.defaultEmailSender,
	replyTo?: string
) => {
	const mimeMessage = MimeMessage.factory({
		contentType: 'multipart/mixed',
		body: [],
		Headers: {
			'Reply-To': replyTo || fromEmail,
			From: fromEmail
		},
		replyTo: [replyTo]
	})

	mimeMessage.header('subject', subject)
	mimeMessage.header('from', fromEmail)
	mimeMessage.header('Reply-To', replyTo)
	if (mimeMessage.setReplyTo) {
		mimeMessage.setReplyTo([replyTo])
	}
	pdfs?.forEach((pdf) => {
		const attachment = MimeMessage.factory({
			contentType: 'text/pdf',
			contentTransferEncoding: 'base64',
			body: Buffer.from(pdf.data).toString('base64')
		})
		attachment.header('Content-Disposition', `attachment ;filename="${pdf.name}"`)
		mimeMessage.body.push(attachment)
	})
	if (emailHtml) {
		mimeMessage.body.push(
			MimeMessage.factory({
				contentType: 'text/html;charset=utf-8',
				body: emailHtml
			})
		)
	}

	const params: AWS.SES.SendRawEmailRequest = {
		Destinations: to.split(','),
		RawMessage: {
			Data: mimeMessage.toString()
		},
		Source: fromEmail
		// to be changed later
	}
	return await ses.sendRawEmail(params).promise()
}
