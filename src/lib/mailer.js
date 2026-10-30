import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  try {
    const result = await transporter.sendMail({
      from: {
        name: "Email Auth System",
        address: process.env.EMAIL_USER,
      },
      to,
      subject,
      html,
    });

    console.log("Email sent:", result.messageId);

    return {
      success: true,
      messageId: result.messageId,
    };

  } catch (error) {
    console.error("Email sending failed:", error);

    throw error;
  }
}