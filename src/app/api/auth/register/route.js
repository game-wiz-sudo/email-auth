import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { generateOTP, hashOTP } from "@/lib/otp";
import bcrypt from "bcryptjs";

export async function POST(request) {
let client;

try {
const { fullName, email, password } = await request.json();

if (!fullName || !email || !password) {
  return Response.json({
    success: false,
    message: "Please provide your full name, email and password."
  }, { status: 400 });
}

const normalizedEmail = email.trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  return Response.json({
    success: false,
    message: "Please provide a valid email address."
  }, { status: 400 });
}

if (password.length < 8) {
  return Response.json({
    success: false,
    message: "Password must contain at least 8 characters."
  }, { status: 400 });
}

if (fullName.trim().length > 150) {
  return Response.json({
    success: false,
    message: "Full name is too long."
  }, { status: 400 });
}

client = await pool.connect();

const existing = await client.query(
  "SELECT id, email_verified FROM users WHERE email = $1",
  [normalizedEmail]
);

if (existing.rows.length > 0 && existing.rows[0].email_verified) {
  return Response.json({
    success: false,
    message: "An account with this email already exists."
  }, { status: 409 });
}

const passwordHash = await bcrypt.hash(password, 12);

const otp = generateOTP();
const otpHash = hashOTP(otp);

await client.query("BEGIN");

let userId;

if (existing.rows.length > 0) {
  userId = existing.rows[0].id;

  await client.query(
    `UPDATE users
     SET full_name = $1, password_hash = $2
     WHERE id = $3`,
    [fullName.trim(), passwordHash, userId]
  );
} else {
  const userResult = await client.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [fullName.trim(), normalizedEmail, passwordHash]
  );

  userId = userResult.rows[0].id;
}

await client.query(
  `UPDATE email_otps
   SET consumed_at = NOW()
   WHERE user_id = $1
   AND purpose = 'register'
   AND consumed_at IS NULL`,
  [userId]
);

await client.query(
  `INSERT INTO email_otps
   (user_id, otp_hash, purpose, expires_at)
   VALUES ($1, $2, 'register', NOW() + INTERVAL '10 minutes')`,
  [userId, otpHash]
);

await client.query("COMMIT");

try {
  await sendEmail({
  to: normalizedEmail,
  subject: "Your Verification Code | Email Auth System",

  html: `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
  </head>

  <body style="
    margin:0;
    padding:0;
    background:#f3f5f8;
    font-family:Arial,Helvetica,sans-serif;
    color:#172033;
  ">

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f3f5f8;padding:45px 15px;">

      <tr>
        <td align="center">

          <table width="100%" cellpadding="0" cellspacing="0"
            style="
              max-width:520px;
              background:#ffffff;
              border-radius:16px;
              overflow:hidden;
              box-shadow:0 8px 35px rgba(20,30,50,0.07);
            ">

            <!-- HEADER -->

            <tr>
              <td style="
                background:#101c2e;
                padding:35px 35px;
                text-align:center;
              ">

                <div style="
                  display:inline-block;
                  background:#183c37;
                  color:#65d6a4;
                  font-size:12px;
                  font-weight:bold;
                  letter-spacing:3px;
                  padding:9px 15px;
                  border-radius:6px;
                ">
                  EMAIL AUTH SYSTEM
                </div>

                <h1 style="
                  color:#ffffff;
                  font-size:25px;
                  margin:25px 0 8px;
                  font-weight:700;
                ">
                  Verify your email
                </h1>

                <p style="
                  color:#aab7c8;
                  font-size:14px;
                  margin:0;
                  line-height:22px;
                ">
                  One final step to secure your account.
                </p>

              </td>
            </tr>

            <!-- CONTENT -->

            <tr>
              <td style="padding:38px 35px 25px;">

                <p style="
                  font-size:15px;
                  color:#263449;
                  margin:0 0 18px;
                ">
                  Hello <strong>${fullName.trim().replace(/[&<>"']/g, "")}</strong>,
                </p>

                <p style="
                  font-size:14px;
                  color:#667085;
                  line-height:25px;
                  margin:0 0 25px;
                ">
                  Thank you for creating an account.
                  To complete your registration, please use
                  the verification code below.
                </p>

                <!-- OTP CARD -->

                <table width="100%" cellpadding="0" cellspacing="0"
                  style="
                    background:#f5f8f7;
                    border:1px solid #dcebe4;
                    border-radius:12px;
                  ">

                  <tr>
                    <td align="center" style="padding:28px 15px;">

                      <p style="
                        color:#718096;
                        font-size:11px;
                        font-weight:bold;
                        letter-spacing:2px;
                        margin:0 0 15px;
                      ">
                        YOUR VERIFICATION CODE
                      </p>

                      <div style="
                        font-size:34px;
                        font-weight:700;
                        letter-spacing:9px;
                        color:#087b54;
                      ">
                        ${otp}
                      </div>

                      <p style="
                        color:#718096;
                        font-size:12px;
                        margin:18px 0 0;
                      ">
                        Enter this code on the verification page.
                      </p>

                    </td>
                  </tr>

                </table>

                <!-- EXPIRY -->

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:25px 0 15px;">

                      <p style="
                        color:#667085;
                        font-size:13px;
                        line-height:23px;
                        margin:0;
                      ">
                        <strong style="color:#263449;">
                          Security notice:
                        </strong>
                        This verification code expires in
                        <strong>10 minutes</strong>.
                        Do not share it with anyone.
                      </p>

                    </td>
                  </tr>
                </table>

                <div style="
                  border-top:1px solid #edf0f3;
                  margin-top:15px;
                  padding-top:22px;
                ">

                  <p style="
                    color:#98a2b3;
                    font-size:12px;
                    line-height:21px;
                    margin:0;
                  ">
                    If you did not request this verification code,
                    you can safely ignore this email.
                    Someone may have entered your email address by mistake.
                  </p>

                </div>

              </td>
            </tr>

            <!-- FOOTER -->

            <tr>
              <td style="
                background:#f8fafc;
                padding:24px 25px;
                text-align:center;
                border-top:1px solid #edf0f3;
              ">

                <p style="
                  color:#263449;
                  font-size:12px;
                  font-weight:bold;
                  letter-spacing:1px;
                  margin:0 0 8px;
                ">
                  EMAIL AUTH SYSTEM
                </p>

                <p style="
                  color:#98a2b3;
                  font-size:11px;
                  line-height:19px;
                  margin:0;
                ">
                  Automated security notification.<br>
                  Please do not reply to this email.
                </p>

                <p style="
                  color:#b0b8c4;
                  font-size:10px;
                  margin:18px 0 0;
                ">
                  © ${new Date().getFullYear()} Email Auth System.
                  All rights reserved.
                </p>

              </td>
            </tr>

          </table>

        </td>
      </tr>

    </table>

  </body>
  </html>
  `
});
} catch (emailError) {
  console.error("Registration email delivery failed:", emailError);

  return Response.json({
    success: false,
    message: "Your registration could not be completed because the verification email could not be sent. Please try again."
  }, { status: 503 });
}

return Response.json({
  success: true,
  message: "Registration received! Check your email for your verification code."
});


} catch (error) {
if (client) {
try {
await client.query("ROLLBACK");
} catch {}
}

console.error("Registration error:", error);

return Response.json({
  success: false,
  message: "Registration failed. Please try again."
}, { status: 500 });

} finally {
client?.release();
}
}
