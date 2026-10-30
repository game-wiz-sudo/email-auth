import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { generateOTP, hashOTP } from "@/lib/otp";
import bcrypt from "bcryptjs";

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export async function POST(request) {
  let client;

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({
        success: false,
        message: "Email and password are required."
      }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Response.json({
        success: false,
        message: "Please enter a valid email address."
      }, { status: 400 });
    }

    client = await pool.connect();

    const userResult = await client.query(
      `SELECT id, full_name, email, password_hash, email_verified
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return Response.json({
        success: false,
        message: "Invalid email or password."
      }, { status: 401 });
    }

    const user = userResult.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return Response.json({
        success: false,
        message: "Invalid email or password."
      }, { status: 401 });
    }

    if (!user.email_verified) {
      return Response.json({
        success: false,
        message: "Please verify your email address before logging in.",
        requiresVerification: true
      }, { status: 403 });
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    await client.query("BEGIN");

    await client.query(
      `UPDATE email_otps
       SET consumed_at = NOW()
       WHERE user_id = $1
       AND purpose = 'login'
       AND consumed_at IS NULL`,
      [user.id]
    );

    await client.query(
      `INSERT INTO email_otps
       (user_id, otp_hash, purpose, expires_at)
       VALUES ($1, $2, 'login', NOW() + INTERVAL '10 minutes')`,
      [user.id, otpHash]
    );

    await client.query("COMMIT");

    const safeName = escapeHTML(user.full_name);

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#07111f;font-family:Arial,sans-serif;color:#ffffff;">
        <div style="max-width:560px;margin:35px auto;padding:35px 25px;background:#101d30;border:1px solid #24344a;border-radius:18px;">

          <div style="text-align:center;margin-bottom:30px;">
            <div style="font-size:25px;font-weight:800;color:#34d399;">
              AUTH<span style="color:#ffffff;">FLOW</span>
            </div>
            <p style="color:#94a3b8;font-size:12px;letter-spacing:2px;">
              SECURE ACCOUNT ACCESS
            </p>
          </div>

          <h2 style="font-size:25px;color:#ffffff;">
            Your login verification code
          </h2>

          <p style="color:#b6c3d3;font-size:15px;line-height:1.8;">
            Hello ${safeName},
            <br><br>
            We received a request to sign in to your account.
            Use the verification code below to complete your login.
          </p>

          <div style="margin:30px 0;padding:25px;background:#07111f;border:1px solid #176b50;border-radius:14px;text-align:center;">
            <div style="font-size:12px;color:#94a3b8;letter-spacing:2px;margin-bottom:12px;">
              YOUR VERIFICATION CODE
            </div>

            <div style="font-size:38px;font-weight:800;letter-spacing:9px;color:#34d399;">
              ${otp}
            </div>
          </div>

          <p style="color:#94a3b8;font-size:13px;line-height:1.7;">
            This code expires in <strong style="color:#ffffff;">10 minutes</strong>.
            Never share this code with anyone.
          </p>

          <div style="border-top:1px solid #26364b;margin-top:30px;padding-top:20px;">
            <p style="color:#64748b;font-size:12px;text-align:center;">
              If you did not attempt to sign in, please secure your account.
              <br><br>
              AUTHFLOW SECURITY TEAM
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Your Secure Login Verification Code",
        html: emailHTML
      });
    } catch (emailError) {
      await client.query(
        `UPDATE email_otps
         SET consumed_at = NOW()
         WHERE user_id = $1
         AND purpose = 'login'
         AND consumed_at IS NULL`,
        [user.id]
      );

      throw emailError;
    }

    return Response.json({
      success: true,
      message: "Login verification code sent successfully.",
      requiresOTP: true,
      email: user.email
    });

  } catch (error) {
    console.error("Login error:", error);

    return Response.json({
      success: false,
      message: "Unable to process your login. Please try again."
    }, { status: 500 });

  } finally {
    client?.release();
  }
}