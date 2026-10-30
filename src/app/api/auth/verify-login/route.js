import pool from "@/lib/db";
import { verifyOTP } from "@/lib/otp";
import { createSession } from "@/lib/session";
import { cookies } from "next/headers";

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

const normalizedEmail = String(email).trim().toLowerCase();
const submittedCode = String(code);

if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
  !/^\d{6}$/.test(submittedCode)
) {
  return Response.json({
    success: false,
    message: "Invalid email or verification code."
  }, { status: 400 });
}

client = await pool.connect();
await client.query("BEGIN");

const userResult = await client.query(
  `SELECT id, full_name, email, email_verified
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

if (!user.email_verified) {
  await client.query("ROLLBACK");

  return Response.json({
    success: false,
    message: "Please verify your email first."
  }, { status: 403 });
}

const otpResult = await client.query(
  `SELECT id, otp_hash, expires_at, attempts
   FROM email_otps
   WHERE user_id = $1
   AND purpose = 'login'
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
    message: "No active login code found. Please log in again."
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
    message: "Your login code has expired. Please log in again."
  }, { status: 400 });
}

if (Number(otpRecord.attempts) >= 5) {
  await client.query("ROLLBACK");

  return Response.json({
    success: false,
    message: "Too many incorrect attempts. Please log in again."
  }, { status: 429 });
}

const isValid = verifyOTP(
  submittedCode,
  otpRecord.otp_hash
);

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
    message: "Incorrect login code.",
    remainingAttempts: Math.max(
      0,
      4 - Number(otpRecord.attempts)
    )
  }, { status: 400 });
}

await client.query(
  `UPDATE email_otps
   SET consumed_at = NOW()
   WHERE id = $1`,
  [otpRecord.id]
);

await client.query(
  `UPDATE users
   SET last_login_at = NOW()
   WHERE id = $1`,
  [user.id]
);

await client.query("COMMIT");

// Create secure authentication session
const token = await createSession(user);

const cookieStore = await cookies();

cookieStore.set("auth_session", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60
});

return Response.json({
  success: true,
  message: "Login successful! Welcome back.",
  user: {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    emailVerified: user.email_verified
  }
});

} catch (error) {
if (client) {
try {
await client.query("ROLLBACK");
} catch {}
}

console.error("Login OTP verification error:", error);

return Response.json({
  success: false,
  message: "Unable to verify login code. Please try again."
}, { status: 500 });

} finally {
client?.release();
}
}
