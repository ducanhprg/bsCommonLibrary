import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number; // Non-null assertion

  @Column()
  name!: string; // Non-null assertion

  @Column()
  email!: string; // Non-null assertion

  @Column({ nullable: true }) // This column can accept NULL values
  address?: string; 

  @Column({ default: true })
  isActive: boolean = true; // Initialized with a default value
}
