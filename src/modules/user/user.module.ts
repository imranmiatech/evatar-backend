import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
