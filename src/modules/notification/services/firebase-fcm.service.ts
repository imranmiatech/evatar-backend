import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface SendPushNotificationPayload {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendPushNotificationResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

@Injectable()
export class FirebaseFcmService {
  private readonly logger = new Logger(FirebaseFcmService.name);
  private app?: App;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send Push Notification to device FCM tokens
   */
  async sendPushNotification(
    payload: SendPushNotificationPayload,
  ): Promise<SendPushNotificationResult> {
    if (!payload.tokens || payload.tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const app = this.firebaseApp();
    if (!app) {
      this.logger.warn(
        'Firebase credentials are not configured. Skipping FCM push delivery.',
      );
      return {
        successCount: 0,
        failureCount: payload.tokens.length,
        invalidTokens: [],
      };
    }

    this.logger.log(
      `[FCM Push] Sending '${payload.title}' to ${payload.tokens.length} device tokens...`,
    );

    try {
      const messaging = getMessaging(app);
      const response = await messaging.sendEachForMulticast({
        tokens: payload.tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });

      const invalidTokens = response.responses
        .map((item, index) => ({
          item,
          token: payload.tokens[index],
        }))
        .filter(({ item }) => this.isInvalidTokenError(item.error?.code))
        .map(({ token }) => token);

      if (invalidTokens.length > 0) {
        this.logger.warn(
          `[FCM] Removing ${invalidTokens.length} invalid device token(s) after push failure.`,
        );
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error: any) {
      this.logger.error(
        `[FCM Push Error] Failed to send push notification: ${error.message}`,
      );
      return {
        successCount: 0,
        failureCount: payload.tokens.length,
        invalidTokens: [],
      };
    }
  }

  private firebaseApp() {
    if (this.app) {
      return this.app;
    }

    const existingApp = getApps()[0];
    if (existingApp) {
      this.app = existingApp;
      return this.app;
    }

    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

    try {
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        this.app = initializeApp({
          credential: cert(serviceAccount),
          ...(projectId ? { projectId } : {}),
        });
        return this.app;
      }

      if (process.env.GOOGLE_APPLICATION_CREDENTIALS || projectId) {
        this.app = initializeApp({
          credential: applicationDefault(),
          ...(projectId ? { projectId } : {}),
        });
        return this.app;
      }
    } catch (error: any) {
      this.logger.error(
        `[FCM Init Error] Failed to initialize Firebase Admin SDK: ${error.message}`,
      );
      return undefined;
    }

    return undefined;
  }

  private isInvalidTokenError(code?: string) {
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  }
}
