export interface IUserTopics {
	id?: string
	userId: string
	topicName: string
}

export interface IUserTopicsCreateModel {
	userId: string
	topicName: string
}
