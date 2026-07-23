export interface IFcmTopic {
	id?: string
	name: string
	description?: string | null
}

export interface IFcmTopicCreateModel {
	name: string
	description?: string | null
}
