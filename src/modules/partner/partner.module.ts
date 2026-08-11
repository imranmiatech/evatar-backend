import { Module } from '@nestjs/common';
import { PartnerProductController } from './product/partner-product.controller';
import { PartnerProductService } from './product/partner-product.service';

@Module({
  controllers: [PartnerProductController],
  providers: [PartnerProductService],
})
export class PartnerModule {}
