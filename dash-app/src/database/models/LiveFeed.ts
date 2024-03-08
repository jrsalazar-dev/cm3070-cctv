import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class LiveFeed {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'integer',
    default: null,
    nullable: true,
  })
  cameraIndex?: number

  @Column('text')
  url?: string

  @Column('text')
  name: string

  @Column({
    default: 0,
    type: 'boolean',
    name: 'is_detecting',
  })
  is_detecting: boolean
  @Column({
    default: 0,
    type: 'boolean',
    name: 'is_alerting',
  })
  is_alerting: boolean = false

  constructor() {
    this.id = 0
    this.name = ''
    this.is_detecting = false
  }
}
