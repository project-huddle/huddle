import nodemailer from "nodemailer";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export async function sendMail(message: MailMessage): Promise<void> {
  const info = await transport.sendMail({
    from: process.env.MAIL_FROM ?? "Huddle <no-reply@localhost>",
    ...message,
  });
  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST)
    console.info("Development email generated", info.messageId);
}
