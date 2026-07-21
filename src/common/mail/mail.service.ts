import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendDummyEmail(to: string, subject: string, content: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        text: content,
      });
      this.logger.log(`Dummy email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send dummy email to ${to}:`, error);
      return false;
    }
  }
}
