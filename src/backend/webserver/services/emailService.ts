import nodemailer from 'nodemailer';
import { APP_CONFIG } from '../config';

export const sendEmail = async (to: string, subject: string, html: string) => {
  const config = APP_CONFIG as any;
  const host = process.env.SMTP_HOST || config?.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || config?.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || config?.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || config?.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || config?.SMTP_FROM || 'noreply@invoice-builder.com';

  if (!host) {
    console.warn('SMTP_HOST is not configured. Email will be logged to console instead of sending.');
    console.log('--- EMAIL ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html}`);
    console.log('-------------');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    html
  });
};
