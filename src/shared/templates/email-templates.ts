/**
 * Email Templates for Niramayaa Healthcare
 */

export const EmailTemplates = {
    /**
     * OTP Verification Template
     */
    otpVerification: (otp: string) => {
        const subject = 'Verify Your Email - Niramayaa';
        const text = `Your Niramayaa verification code is: ${otp}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; line-height: 1.6; color: #1e293b; background-color: #ffffff; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1; }
          .footer { text-align: center; font-size: 0.75rem; color: #64748b; margin-top: 20px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">Niramayaa</h1>
            <p style="margin:10px 0 0 0; opacity: 0.9;">Email Verification</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Welcome to <strong>Niramayaa</strong>. Use the following dynamic One-Time Password (OTP) to verify your email address. This code is valid for 10 minutes.</p>
            <div class="otp-code">${otp}</div>
            <p>If you did not request this, please ignore this email.</p>
            <p>Best regards,<br />The Niramayaa Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Niramayaa Healthcare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return { subject, html, text };
    },

    /**
     * Password Reset Template
     */
    passwordReset: (firstName: string, resetUrl: string) => {
        const subject = 'Password Reset Request - Niramayaa';
        const text = `Hi ${firstName}, reset your password using this link: ${resetUrl}`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; line-height: 1.6; color: #1e293b; background-color: #ffffff; }
          .button { display: inline-block; padding: 14px 28px; background-color: #dc2626; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 25px 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .footer { text-align: center; font-size: 0.75rem; color: #64748b; margin-top: 20px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password for your <strong>Niramayaa</strong> account. Click the button below to set a new password. This link is valid for 1 hour.</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>If you did not request this, you can safely ignore this email.</p>
            <p>Best regards,<br />The Niramayaa Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Niramayaa Healthcare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return { subject, html, text };
    },

    /**
     * Subscription Invoice Template
     */
    subscriptionInvoice: (firstName: string, planName: string, amount: number, receiptUrl: string | null) => {
        const subject = 'Payment Successful - Niramayaa';
        const text = `Hi ${firstName}, your payment of ₹${amount} for the Niramayaa ${planName} plan was successful.`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; line-height: 1.6; color: #1e293b; background-color: #ffffff; }
          .invoice-box { background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px; }
          .footer { text-align: center; font-size: 0.75rem; color: #64748b; margin-top: 20px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">Payment Successful</h1>
            <p style="margin:10px 0 0 0; opacity: 0.9;">Thank you for your subscription</p>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Your payment for the <strong>Niramayaa ${planName} Plan</strong> has been processed successfully. Your account is now active.</p>
            
            <div class="invoice-box">
              <p style="margin:0;"><strong>Plan:</strong> ${planName}</p>
              <p style="margin:10px 0;"><strong>Amount Paid:</strong> ₹${amount}</p>
              <p style="margin:0;"><strong>Status:</strong> Confirmed</p>
              
              ${receiptUrl ? `
              <div style="text-align: center;">
                <a href="${receiptUrl}" class="button">View Official Receipt</a>
              </div>
              ` : ''}
            </div>

            <p>You can now log in to your dashboard and start managing your practice.</p>
            <p>Best regards,<br />The Niramayaa Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Niramayaa Healthcare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        return { subject, html, text };
    }
};
