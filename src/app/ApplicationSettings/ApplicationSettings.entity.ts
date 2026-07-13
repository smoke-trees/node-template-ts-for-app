import { BaseEntity, Documentation } from '@smoke-trees/postgres-backend'
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { Optional } from '../../types'

export enum SettingTypes {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
	ARRAY = 'array'
}

export interface IApplicationSettings {
	id: string
	name: string
	value: string
	type: SettingTypes
	isPublic: boolean
}

export type IApplicationSettingsCreate = Optional<IApplicationSettings, 'id'>

@Documentation.addSchema()
@Entity({ name: 'application_settings' })
export class ApplicationSettings extends BaseEntity {
	@Documentation.addField({ type: 'string' })
	@PrimaryGeneratedColumn('uuid', { name: 'id' })
	id!: string

	@Documentation.addField({ type: 'string' })
	@Column({ type: 'varchar' })
	name!: string

	@Documentation.addField({ type: 'string' })
	@Column({ type: 'json' })
	value!: string

	@Documentation.addField({
		type: 'string',
		enum: Object.values(SettingTypes),
		default: SettingTypes.STRING
	})
	@Column({ type: 'enum', enum: SettingTypes, default: SettingTypes.STRING })
	type!: string

	@Documentation.addField({ type: 'string' })
	@Column({ type: 'boolean', nullable: true, default: false })
	isPublic!: boolean

	constructor(it?: IApplicationSettingsCreate) {
		super(it)
		if (it) {
			if (it.id) this.id = it.id
			this.name = it.name
			this.value = it.value
			this.type = it.type
			this.isPublic = it.isPublic
		}
	}
}
