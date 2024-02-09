import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { LiveFeed } from './LiveFeed'

@Entity()
export class Alert {
  @PrimaryGeneratedColumn()
  id: number

  @Column('text')
  filepath: string

  @Column('integer')
  detection_time: number

  @Column('text')
  detection_objects: string

  @ManyToOne(() => LiveFeed)
  @JoinColumn({
    name: 'detection_feed',
  })
  @Column('integer')
  detection_feed?: LiveFeed

  @Column('integer')
  detection_status: number

  @Column({
    type: 'boolean',
    name: 'detection_alerted',
    default: 0,
  })
  detection_alerted: number

  constructor() {
    this.id = 0
    this.filepath = ''
    this.detection_time = 0
    this.detection_objects = ''
    this.detection_status = 0
    this.detection_alerted = 0
  }
}
