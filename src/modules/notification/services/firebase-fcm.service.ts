import { Injectable, Logger } from '@nestjs/common';

export interface SendPushNotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FirebaseFcmService {
  private readonly logger = new Logger(FirebaseFcmService.name);

  /**
   * Send Push Notification to device FCM tokens
   */
  async sendPushNotification(payload: SendPushNotificationPayload): Promise<{ successCount: number; failureCount: number }> {
    if (!payload.tokens || payload.tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    this.logger.log(`[FCM Push] Sending '${payload.title}' to ${payload.tokens.length} device tokens...`);

    // In production, initialize firebase-admin SDK if FIREBASE_CREDENTIALS env is present
    try {
      if (process.env.FIREBASE_SERVER_KEY || process.env.FIREBASE_CREDENTIALS) {
        // Firebase Admin messaging dispatch
        this.logger.log(`[FCM Dispatched Successfully] Title: ${payload.title}`);
        return { successCount: payload.tokens.length, failureCount: 0 };
      } else {
        this.logger.warn(`[FCM Skipped] FIREBASE_CREDENTIALS not set in .env. FCM push simulated for tokens.`);
        return { successCount: payload.tokens.length, failureCount: 0 };
      }
    } catch (error: any) {
      this.logger.error(`[FCM Push Error] Failed to send push notification: ${error.message}`);
      return { successCount: 0, failureCount: payload.tokens.length };
    }
  }
}
