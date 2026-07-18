import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: Twilio;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials not provided in environment variables.');
    }
  }

  async sendSms(to: string, body: string) {
    try {
      const from = this.configService.get<string>('TWILIO_PHONE_NUMBER');
      const message = await this.client.messages.create({
        body,
        from,
        to,
      });
      this.logger.log(`SMS sent successfully to ${to}, SID: ${message.sid}`);
      return message;
    } catch (error: any) {
      this.logger.error(`Failed to send SMS to ${to}:`, error);
      
      // If Twilio complains about an invalid number (e.g. error code 21211)
      if (error.code === 21211) {
        throw new BadRequestException(`Invalid phone number: ${to}`);
      }

      // If Twilio Trial Limit Reached (63038) or From Number Mismatch (21659)
      if (error.code === 63038 || error.code === 21659) {
        this.logger.warn(`[DEV MODE] Twilio limit/config error. Bypassing SMS delivery so signup can proceed. Code: ${error.code}`);
        return { sid: 'mock_sid_due_to_twilio_limits' };
      }

      throw error;
    }
  }
}
