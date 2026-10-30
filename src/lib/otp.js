import {
  randomInt,
  createHmac,
  timingSafeEqual,
} from "crypto";

export function generateOTP() {
  return randomInt(100000, 1000000).toString();
}

export function hashOTP(otp) {
  const secret = process.env.OTP_SECRET;

  if (!secret) {
    throw new Error("OTP_SECRET is missing.");
  }

  return createHmac("sha256", secret)
    .update(otp)
    .digest("hex");
}

export function verifyOTP(otp, storedHash) {
  const submittedHash = Buffer.from(hashOTP(otp), "hex");
  const originalHash = Buffer.from(storedHash, "hex");

  if (submittedHash.length !== originalHash.length) {
    return false;
  }

  return timingSafeEqual(submittedHash, originalHash);
}