import pool from "@/lib/db";
import { verifyOTP } from "@/lib/otp";

export async function POST(request) {
let client;

try {
const { email, code } = await request.json();

if (!email || !code) {
  return Response.json({
    success: false,
    message: "Email and verification code are required."
  }, { status: 400 });
}

const normalizedEmail = email.trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  return Response.json({
    success: false,
    message: "Invalid email address."
  }, { status: 400 });
}

if (!/^\d{6}$/.test(code)) {
  return Response.json({
    success: false,
    message: "Enter a valid 6-digit verification code."
  }, { status: 400 });
}

client = await pool.connect();

await client.query("BEGIN");

const userResult = await client.query(
  `SELECT id, email_verified
   FROM users
   WHERE email = $1
   FOR UPDATE`,
  [normalizedEmail]
);

if (userResult.rows.length === 0) {
  await client.query("ROLLBACK");

  return Response.json({
    success: false,
    message: "Account not found."
  }, { status: 404 });
}

const user = userResult.rows[0];

if (user.email_verified) {
  await client.query("ROLLBACK");

  return Response.json({
    success: true,
    message: "Your email address is already verified."
  });
}

const otpResult = await client.query(
  `SELECT id, otp_hash, expires_at, attempts
   FROM email_otps
   WHERE user_id = $1
   AND purpose = 'register'
   AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE`,
  [user.id]
);

if (otpResult.rows.length === 0) {
  await client.query("ROLLBACK");

  return Response.json({
    success: false,
    message: "No active verification code found. Please request a new code."
  }, { status: 400 });
}

const otpRecord = otpResult.rows[0];

if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
  await client.query(
    `UPDATE email_otps
     SET consumed_at = NOW()
     WHERE id = $1`,
    [otpRecord.id]
  );

  await client.query("COMMIT");

  return Response.json({
    success: false,
    message: "Your verification code has expired. Please request a new one."
  }, { status: 400 });
}

if (otpRecord.attempts >= 5) {
  await client.query("ROLLBACK");

  return Response.json({
    success: false,
    message: "Too many incorrect attempts. Please request a new code."
  }, { status: 429 });
}

const isValid = verifyOTP(code, otpRecord.otp_hash);

if (!isValid) {
  await client.query(
    `UPDATE email_otps
     SET attempts = attempts + 1,
         consumed_at = CASE
           WHEN attempts + 1 >= 5 THEN NOW()
           ELSE consumed_at
         END
     WHERE id = $1`,
    [otpRecord.id]
  );

  await client.query("COMMIT");

  return Response.json({
    success: false,
    message: "Incorrect verification code.",
    remainingAttempts: Math.max(0, 4 - otpRecord.attempts)
  }, { status: 400 });
}

await client.query(
  `UPDATE users
   SET email_verified = TRUE
   WHERE id = $1`,
  [user.id]
);

await client.query(
  `UPDATE email_otps
   SET consumed_at = NOW()
   WHERE id = $1`,
  [otpRecord.id]
);

await client.query("COMMIT");

return Response.json({
  success: true,
  message: "Your email has been verified successfully! Your account is now active."
});

} catch (error) {
if (client) {
try {
await client.query("ROLLBACK");
} catch {}
}

console.error("Email verification error:", error);

return Response.json({
  success: false,
  message: "Email verification failed. Please try again."
}, { status: 500 });

} finally {
client?.release();
}
}
