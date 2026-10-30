import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET is missing from environment variables.");
}

const secretKey = new TextEncoder().encode(secret);

export async function createSession(user) {
  return await new SignJWT({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    sessionVersion: Number(user.session_version ?? 0)
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

