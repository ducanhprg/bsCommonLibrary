import { Repository } from 'typeorm';
import { mainDataSource } from '@shared/configs/mysqlConfig';
import { User } from '@shared/database/models/User';

export const UserRepository = mainDataSource.getRepository(User);
