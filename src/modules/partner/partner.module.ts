import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PartnerDashboardController } from './dashboard/partner-dashboard.controller';
import { PartnerDashboardService } from './dashboard/partner-dashboard.service';
import { AdminOfferService } from './offer/admin-offer.service';
import { AdminPartnerOfferController } from './offer/admin-partner-offer.controller';
import { PartnerOfferController } from './offer/partner-offer.controller';
import { PartnerOfferService } from './offer/partner-offer.service';
import { PartnerProductController } from './product/partner-product.controller';
import { PartnerProductService } from './product/partner-product.service';

@Module({
  imports: [NotificationModule],
  controllers: [
    PartnerProductController,
    PartnerOfferController,
    AdminPartnerOfferController,
    PartnerDashboardController,
  ],
  providers: [
    PartnerProductService,
    PartnerOfferService,
    AdminOfferService,
    PartnerDashboardService,
  ],
  exports: [PartnerOfferService],
})
export class PartnerModule {}
