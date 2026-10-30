import pool from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { generateOTP, hashOTP } from "@/lib/otp";

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export async function POST(request) {
  let client;
  let otpId;

  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({
        success: false,
        message: "Please enter a valid email address."
      }, { status: 400 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, full_name, email, email_verified
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [email]
    );

    // Always return the same public response for an unknown, unverified,
    // or eligible address so this endpoint does not disclose account status.
    if (userResult.rows.length === 0 || !userResult.rows[0].email_verified) {
      await client.query("COMMIT");
      return Response.json({
        success: true,
        message: "If a verified account exists for that email, a password reset code will be sent."
      });
    }

    const user = userResult.rows[0];

    await client.query(
      `UPDATE email_otps
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND purpose = 'password_reset'
         AND consumed_at IS NULL`,
      [user.id]
    );

    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    const inserted = await client.query(
      `INSERT INTO email_otps
        (user_id, otp_hash, purpose, expires_at, attempts)
       VALUES ($1, $2, 'password_reset', NOW() + INTERVAL '10 minutes', 0)
       RETURNING id`,
      [user.id, otpHash]
    );

    otpId = inserted.rows[0].id;
    await client.query("COMMIT");

    const safeName = escapeHTML(user.full_name);

    try {
      await sendEmail({
        to: user.email,
        subject: "Your AUTHFLOW password reset code",
        html: `
          <div style="margin:0;padding:35px 15px;background:#080d18;font-family:Arial,sans-serif;color:#f4f7fb">
            <div style="max-width:520px;margin:auto;padding:32px;background:#101827;border:1px solid #263449;border-radius:16px">
              <h2 style="margin:0 0 12px;color:#34d399">AUTHFLOW</h2>
              <h1 style="font-size:23px">Reset your password</h1>
              <p style="color:#aab7c8;line-height:1.7">Hello ${safeName}, use the verification code below to reset your AUTHFLOW password.</p>
              <div style="margin:28px 0;padding:20px;text-align:center;background:#080d18;border:1px solid #285746;border-radius:12px">
                <span style="font-size:34px;font-weight:800;letter-spacing:9px;color:#34d399">${otp}</span>
              </div>
              <p style="color:#aab7c8;line-height:1.7">This code expires in <strong style="color:#34d399">10 minutes</strong> and can be used only once. Never share it with anyone.</p>
              <p style="margin-top:28px;color:#718198;font-size:12px">If you did not request a password reset, you can safely ignore this email.</p>
            </div>
          </div>
        `
      });
    } catch (mailError) {
      console.error("Password reset email failed:", mailError);
      await pool.query(
        "UPDATE email_otps SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL",
        [otpId]
      );
      return Response.json({
        success: true,
        message: "If a verified account exists for that email, a password reset code will be sent. If it does not arrive, please try again shortly."
      });
    }

    return Response.json({
      success: true,
      message: "If a verified account exists for that email, a password reset code will be sent."
    });
  } catch (error) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch {}
    }
    console.error("Forgot password error:", error);
    return Response.json({
      success: false,
      message: "Unable to process your request right now. Please try again."
    }, { status: 500 });
  } finally {
    client?.release();
  }
}
