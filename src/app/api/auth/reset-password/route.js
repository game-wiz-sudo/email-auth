import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { verifyOTP } from "@/lib/otp";
import { cookies } from "next/headers";

export async function POST(request) {
  let client;

  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return Response.json({
        success: false,
        message: "Enter a valid email address and six-digit code."
      }, { status: 400 });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      return Response.json({
        success: false,
        message: "Your new password must contain between 8 and 72 characters."
      }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    client = await pool.connect();
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, email_verified
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [email]
    );

    if (!userResult.rows.length || !userResult.rows[0].email_verified) {
      await client.query("ROLLBACK");
      return Response.json({
        success: false,
        message: "The reset code is invalid or has expired. Please request a new code."
      }, { status: 400 });
    }

    const user = userResult.rows[0];

    const otpResult = await client.query(
      `SELECT id, otp_hash, expires_at, attempts
       FROM email_otps
       WHERE user_id = $1
         AND purpose = 'password_reset'
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [user.id]
    );

    if (!otpResult.rows.length) {
      await client.query("ROLLBACK");
      return Response.json({
        success: false,
        message: "The reset code is invalid or has expired. Please request a new code."
      }, { status: 400 });
    }

    const otpRecord = otpResult.rows[0];

    if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
      await client.query(
        "UPDATE email_otps SET consumed_at = NOW() WHERE id = $1",
        [otpRecord.id]
      );
      await client.query("COMMIT");
      return Response.json({
        success: false,
        message: "Your reset code has expired. Please request a new one."
      }, { status: 400 });
    }

    if (Number(otpRecord.attempts) >= 5) {
      await client.query("ROLLBACK");
      return Response.json({
        success: false,
        message: "Too many incorrect attempts. Please request a new reset code."
      }, { status: 429 });
    }

    if (!verifyOTP(code, otpRecord.otp_hash)) {
      await client.query(
        `UPDATE email_otps
         SET attempts = attempts + 1,
             consumed_at = CASE WHEN attempts + 1 >= 5 THEN NOW() ELSE consumed_at END
         WHERE id = $1`,
        [otpRecord.id]
      );
      await client.query("COMMIT");

      const remainingAttempts = Math.max(0, 4 - Number(otpRecord.attempts));

      return Response.json({
        success: false,
        message: remainingAttempts > 0
          ? "Incorrect reset code. Please try again."
          : "Too many incorrect attempts. Please request a new reset code.",
        remainingAttempts
      }, { status: remainingAttempts > 0 ? 400 : 429 });
    }

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           session_version = session_version + 1
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    // Consume every outstanding OTP so older login/reset codes cannot be reused.
    await client.query(
      `UPDATE email_otps
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND consumed_at IS NULL`,
      [user.id]
    );

    await client.query("COMMIT");

    // Clear this browser's authentication cookie too.
    const cookieStore = await cookies();
    cookieStore.set("auth_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return Response.json({
      success: true,
      message: "Your password has been reset successfully. Please sign in with your new password."
    });
  } catch (error) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    console.error("Reset password error:", error);
    return Response.json({
      success: false,
      message: "Unable to reset your password right now. Please try again."
    }, { status: 500 });
  } finally {
    client?.release();
  }
}

