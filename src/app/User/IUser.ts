export interface IUser {
	id: string
	firstname?: string
	lastname?: string
	email: string
	emailVerified: boolean
	password: string
	type: UserType
	phoneNumber?: string
	country?: string
	countryCode?: string
	isSoftDeleted: boolean
	softDeletedAt: Date | null
	isActive: boolean
	consentGiven?: boolean | null
	consentAt?: Date | null
	consentVersion?: string | null
	appleUserId?: string
	googleUserId?: string
}

export enum UserType {
	user = 'user',
	ops = 'ops',
	admin = 'admin'
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

const capsAlpha = [
	'A',
	'B',
	'C',
	'D',
	'E',
	'F',
	'G',
	'H',
	'I',
	'J',
	'K',
	'L',
	'M',
	'N',
	'O',
	'P',
	'Q',
	'R',
	'S',
	'T',
	'U',
	'V',
	'W',
	'X',
	'Y',
	'Z'
]
const smallAlpha = [
	'a',
	'b',
	'c',
	'd',
	'e',
	'f',
	'g',
	'h',
	'i',
	'j',
	'k',
	'l',
	'm',
	'n',
	'o',
	'p',
	'q',
	'r',
	's',
	't',
	'u',
	'v',
	'w',
	'x',
	'y',
	'z'
]
const nums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const spChrs = [
	' ',
	'!',
	'"',
	'#',
	'$',
	'%',
	'&',
	"'",
	'(',
	')',
	'*',
	'+',
	',',
	'-',
	'.',
	'/',
	':',
	';',
	'<',
	'=',
	'>',
	'?',
	'@',
	'[',
	'\\',
	']',
	'^',
	'_',
	'`',
	'{',
	'|',
	'}',
	'~'
]

export const passwordRegex = {
	test: (password: string) => {
		if (password.length < 8) {
			return false
		}

		const arrays = [capsAlpha, smallAlpha, nums, spChrs]

		const hasEntry = (arr: string[]) => arr.some((e) => password.includes(e))

		return arrays.every(hasEntry)
	}
}
