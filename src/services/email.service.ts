import { mailRepository, type MailEntry } from "../repositories/mail.repository";
import { logger } from "../utils/logger";

export const emailService = {
  async triggerLifecycleEmail(type: string, recipient: string, data: any): Promise<void> {
    try {
      logger.info(`[Email Dispatch] Triggering email event "${type}" to ${recipient}`, "EmailService");
      const entry: MailEntry = {
        to: [recipient],
        type,
        data,
        message: {
          subject: type.replace(/_/g, " ").toUpperCase()
        },
        timestamp: new Date().toISOString()
      };
      await mailRepository.triggerMail(entry);
    } catch (err: any) {
      logger.error(`[Email Dispatch] Failed to trigger email: ${err.message}`, "EmailService");
    }
  }
};
