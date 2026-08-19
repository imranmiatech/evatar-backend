import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
      this.logger.warn(
        'Twilio credentials not provided in environment variables.',
      );
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

      // If Twilio Trial Limit Reached (63038), From Mismatch (21659), Geo Permission Disabled (21408), or Unverified Trial Recipient (21608)
      if ([63038, 21659, 21408, 21608].includes(error.code)) {
        this.logger.warn(
          `[DEV/TRIAL MODE] Twilio limit/geo-permission error (${error.code}: ${error.message}). Bypassing SMS delivery so signup can proceed cleanly.`,
        );
        return { sid: 'mock_sid_due_to_twilio_limits', code: error.code };
      }

      throw error;
    }
  }

  async sendWhatsapp(to: string, body: string) {
    const from = this.configService.get<string>('TWILIO_WHATSAPP_FROM');

    if (!from) {
      throw new BadRequestException(
        'TWILIO_WHATSAPP_FROM is required for WhatsApp delivery',
      );
    }

    try {
      const message = await this.client.messages.create({
        body,
        from: this.whatsappAddress(from),
        to: this.whatsappAddress(to),
      });
      this.logger.log(
        `WhatsApp sent successfully to ${to}, SID: ${message.sid}`,
      );
      return message;
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp to ${to}:`, error);

      if (error.code === 21211) {
        throw new BadRequestException(`Invalid WhatsApp number: ${to}`);
      }

      if (error.code === 63038 || error.code === 21659) {
        this.logger.warn(
          `[DEV MODE] Twilio WhatsApp limit/config error. Code: ${error.code}`,
        );
      }

      throw error;
    }
  }

  private whatsappAddress(phoneNumber: string) {
    const value = phoneNumber.trim();
    return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
  }
}
