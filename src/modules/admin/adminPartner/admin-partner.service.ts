import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminPartnerService {
  async getPartners() {
    return {
      data: [],
      message: 'Admin partner module is ready.',
    };
  }
}
