import { Injectable } from '@nestjs/common';
import { AddMembershipPaymentMethodDto } from '../dto/add-payment-method.dto';
import { PaymentAccountService } from '../../payment/payment-account.service';

@Injectable()
export class MembershipPaymentMethodService {
  constructor(private readonly paymentAccountService: PaymentAccountService) {}

  getPaymentMethods(userId: string) {
    return this.paymentAccountService.getPaymentMethods(userId);
  }

  addPaymentMethod(userId: string, dto: AddMembershipPaymentMethodDto) {
    return this.paymentAccountService.addPaymentMethod(userId, dto);
  }

  setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    return this.paymentAccountService.setDefaultPaymentMethod(
      userId,
      paymentMethodId,
    );
  }

  removeDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    return this.paymentAccountService.removeDefaultPaymentMethod(
      userId,
      paymentMethodId,
    );
  }

  deletePaymentMethod(userId: string, paymentMethodId: string) {
    return this.paymentAccountService.deletePaymentMethod(userId, paymentMethodId);
  }
}
