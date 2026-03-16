import nodemailer from 'nodemailer';
import { EmailTemplates } from '../templates/email-templates';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT as string),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Send a generic email
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"${process.env.SENDER_NAME}" <${process.env.SENDER_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  /**
   * Send OTP Verification Email
   */
  public async sendVerificationOtpEmail(email: string, otp: string): Promise<boolean> {
    const { subject, html, text } = EmailTemplates.otpVerification(otp);

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send Password Reset Email
   */
  public async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    const { subject, html, text } = EmailTemplates.passwordReset(firstName, resetUrl);

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send Payment Success & Invoice Email (Subscription)
   */
  public async sendSubscriptionInvoice(
    email: string,
    firstName: string,
    planName: string,
    amount: number,
    receiptUrl: string | null
  ): Promise<boolean> {
    const { subject, html, text } = EmailTemplates.subscriptionInvoice(firstName, planName, amount, receiptUrl);

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }


   public async sendAppointmentConfirmationToPatient(
    email: string,
    params: Parameters<typeof EmailTemplates.appointmentConfirmationPatient>[0]
  ): Promise<boolean> {
    const { subject, html, text } = EmailTemplates.appointmentConfirmationPatient(params);
    return await this.sendEmail({ to: email, subject, html, text });
  }

  /**
   * Send Appointment Notification to Doctor
   */
  public async sendAppointmentNotificationToDoctor(
    email: string,
    params: Parameters<typeof EmailTemplates.appointmentNotificationDoctor>[0]
  ): Promise<boolean> {
    const { subject, html, text } = EmailTemplates.appointmentNotificationDoctor(params);
    return await this.sendEmail({ to: email, subject, html, text });
  }
}

export default new EmailService();
