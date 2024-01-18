import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

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

  @Column('integer')
  detection_feed: number

  @Column('integer')
  detection_status: number

  constructor() {
    this.id = 0
    this.filepath = ''
    this.detection_time = 0
    this.detection_objects = ''
    this.detection_feed = 0
    this.detection_status = 0
  }
}
