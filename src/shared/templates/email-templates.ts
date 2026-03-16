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
    },

    /**
     * Appointment Confirmation — sent to the PATIENT after successful booking
     */
    appointmentConfirmationPatient: (params: {
        patientName: string;
        doctorName: string;
        date: string;
        startTime: string;
        endTime: string;
        description: string;
        amount: number;
        receiptUrl: string | null;
    }) => {
        const subject = 'Appointment Confirmed - Niramayaa';
        const text = `Hi ${params.patientName}, your appointment with Dr. ${params.doctorName} on ${params.date} from ${params.startTime} to ${params.endTime} is confirmed.`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; line-height: 1.6; color: #1e293b; background-color: #ffffff; }
          .info-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .info-row { padding: 8px 0; border-bottom: 1px solid #d1fae5; }
          .info-row:last-child { border-bottom: none; }
          .label { color: #065f46; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
          .value { color: #1e293b; font-weight: 700; }
          .badge { display: inline-block; background-color: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; }
          .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; }
          .footer { text-align: center; font-size: 0.75rem; color: #64748b; margin-top: 20px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">✅ Appointment Confirmed</h1>
            <p style="margin:10px 0 0 0; opacity: 0.9;">Niramayaa Healthcare</p>
          </div>
          <div class="content">
            <p>Hi <strong>${params.patientName}</strong>,</p>
            <p>Your appointment has been successfully booked and payment confirmed. Here are your appointment details:</p>

            <div class="info-box">
              <div class="info-row">
                <span class="label">Doctor:</span>
                <span class="value">Dr. ${params.doctorName}</span>
              </div>
              <div class="info-row">
                <span class="label">Date:</span>
                <span class="value">${params.date}</span>
              </div>
              <div class="info-row">
                <span class="label">Time:</span>
                <span class="value">${params.startTime} – ${params.endTime} IST</span>
              </div>
              <div class="info-row">
                <span class="label">Reason:</span>
                <span class="value">${params.description}</span>
              </div>
              <div class="info-row">
                <span class="label">Amount Paid:</span>
                <span class="value">₹${params.amount}</span>
              </div>
              <div class="info-row">
                <span class="label">Status:</span>
                <span class="badge">Scheduled</span>
              </div>
            </div>

            ${params.receiptUrl ? `
            <div style="text-align: center;">
              <a href="${params.receiptUrl}" class="button">View Payment Receipt</a>
            </div>
            ` : ''}

            <p style="margin-top: 24px;">Please arrive a few minutes early. If you need to reschedule, contact us as soon as possible.</p>
            <p>Best regards,<br /><strong>The Niramayaa Team</strong></p>
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
     * Appointment Notification — sent to the DOCTOR when a patient books
     */
    appointmentNotificationDoctor: (params: {
        doctorName: string;
        patientName: string;
        patientEmail: string;
        patientPhone: string;
        patientGender: string;
        patientBloodGroup: string;
        patientHeight: number;
        patientWeight: number;
        date: string;
        startTime: string;
        endTime: string;
        description: string;
    }) => {
        const subject = 'New Appointment Booking - Niramayaa';
        const text = `Hi Dr. ${params.doctorName}, a new appointment has been booked by ${params.patientName} on ${params.date} from ${params.startTime} to ${params.endTime}.`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; line-height: 1.6; color: #1e293b; background-color: #ffffff; }
          .section-title { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6366f1; margin: 20px 0 8px; }
          .info-box { background-color: #f8faff; border: 1px solid #e0e7ff; padding: 20px; border-radius: 10px; margin-bottom: 16px; }
          .info-row { padding: 7px 0; border-bottom: 1px solid #e0e7ff; }
          .info-row:last-child { border-bottom: none; }
          .label { color: #4338ca; font-weight: 600; font-size: 0.85rem; }
          .value { color: #1e293b; font-weight: 700; }
          .badge { display: inline-block; background-color: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 700; }
          .description-box { background-color: #f8faff; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 12px 0; font-style: italic; color: #374151; }
          .footer { text-align: center; font-size: 0.75rem; color: #64748b; margin-top: 20px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">📋 New Appointment</h1>
            <p style="margin:10px 0 0 0; opacity: 0.9;">A patient has booked a slot with you</p>
          </div>
          <div class="content">
            <p>Hi <strong>Dr. ${params.doctorName}</strong>,</p>
            <p>A new appointment has been confirmed and payment received. Here are the details:</p>

            <p class="section-title">📅 Appointment Details</p>
            <div class="info-box">
              <div class="info-row">
                <span class="label">Date:</span>
                <span class="value">${params.date}</span>
              </div>
              <div class="info-row">
                <span class="label">Time Slot:</span>
                <span class="value">${params.startTime} – ${params.endTime} IST</span>
              </div>
              <div class="info-row">
                <span class="label">Status:</span>
                <span class="badge">Scheduled</span>
              </div>
            </div>

            <p class="section-title">🧑‍⚕️ Patient Details</p>
            <div class="info-box">
              <div class="info-row">
                <span class="label">Name:</span>
                <span class="value">${params.patientName}</span>
              </div>
              <div class="info-row">
                <span class="label">Email:</span>
                <span class="value">${params.patientEmail}</span>
              </div>
              <div class="info-row">
                <span class="label">Phone:</span>
                <span class="value">${params.patientPhone}</span>
              </div>
              <div class="info-row">
                <span class="label">Gender:</span>
                <span class="value">${params.patientGender}</span>
              </div>
              <div class="info-row">
                <span class="label">Blood Group:</span>
                <span class="value">${params.patientBloodGroup}</span>
              </div>
              <div class="info-row">
                <span class="label">Height / Weight:</span>
                <span class="value">${params.patientHeight} cm / ${params.patientWeight} kg</span>
              </div>
            </div>

            <p class="section-title">📝 Reason for Visit</p>
            <div class="description-box">${params.description}</div>

            <p style="margin-top: 24px;">Please review the patient's details in your dashboard before the appointment.</p>
            <p>Best regards,<br /><strong>The Niramayaa Team</strong></p>
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
};

/**
 * Shared Helper for Prescription HTML formatting
 */
const renderPrescriptionHtml = (patientName: string, heading: string, introText: string, items: any[]) => {
    const prescriptionItemsHtml = items.map(item => `
        <div style="padding: 15px; border-bottom: 1px solid #f1f5f9;">
            <p style="margin: 0; font-weight: bold; color: #1e293b;">${item.medicine_name}</p>
            <p style="margin: 5px 0; font-size: 0.9rem; color: #64748b;">
                Dosage: ${item.dosage_value} ${item.dosage_unit} | 
                Timing: ${item.timing.replace('_', ' ')}
            </p>
            <p style="margin: 5px 0; font-size: 0.85rem;">
                Schedule: 
                ${item.morning ? '<span style="color: #059669;">Morning</span>' : ''} 
                ${item.afternoon ? '<span style="color: #059669;">Afternoon</span>' : ''} 
                ${item.night ? '<span style="color: #059669;">Night</span>' : ''}
            </p>
            ${item.note ? `<p style="margin: 5px 0; font-size: 0.85rem; font-style: italic; color: #64748b;">Note: ${item.note}</p>` : ''}
        </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 30px; line-height: 1.6; color: #1e293b; background-color: #ffffff; }
          .prescription-box { background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; margin: 20px 0; overflow: hidden; }
          .footer { text-align: center; font-size: 0.75rem; color: #64748b; margin-top: 20px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">${heading}</h1>
            <p style="margin:10px 0 0 0; opacity: 0.9;">Niramayaa Healthcare</p>
          </div>
          <div class="content">
            <p>Hi <strong>${patientName}</strong>,</p>
            <p>${introText}</p>
            
            <div class="prescription-box">
                <div style="background-color: #f1f5f9; padding: 10px 15px; font-weight: bold; font-size: 0.85rem; color: #475569;">MEDICINE DETAILS</div>
                ${prescriptionItemsHtml}
            </div>

            <p>You can also view this prescription in your Niramayaa patient dashboard at any time.</p>
            <p>Please follow the dosage instructions carefully. If you have any questions or experience side effects, please contact your doctor immediately.</p>
            <p>Best regards,<br />The Niramayaa Team</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Niramayaa Healthcare. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
};
