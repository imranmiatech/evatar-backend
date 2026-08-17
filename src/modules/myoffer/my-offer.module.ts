import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MyOfferController } from './my-offer.controller';
import { MyOfferService } from './my-offer.service';

@Module({
  imports: [PrismaModule],
  controllers: [MyOfferController],
  providers: [MyOfferService],
  exports: [MyOfferService],
})
export class MyOfferModule {}
