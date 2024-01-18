import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class LiveFeed {
  @PrimaryGeneratedColumn()
  id: number

  @Column('integer')
  cameraIndex?: number

  @Column('text')
  url?: string

  @Column('text')
  name: string

  constructor() {
    this.id = 0
    this.name = ''
  }
}
