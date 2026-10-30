import pool from "@/lib/db";
import { verifySession } from "@/lib/session";
import { cookies } from "next/headers";

export async function GET() {
  let client;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_session")?.value;

    if (!token) {
      return Response.json({
        success: false,
        message: "You are not authenticated."
      }, { status: 401 });
    }

    const session = await verifySession(token);

    if (!session || !session.userId || session.sessionVersion === undefined) {
      cookieStore.set("auth_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0
      });

      return Response.json({
        success: false,
        message: "Your session is invalid or expired."
      }, { status: 401 });
    }

    client = await pool.connect();

    const result = await client.query(
      `SELECT
        id,
        full_name,
        email,
        email_verified,
        created_at,
        last_login_at,
        session_version
       FROM users
       WHERE id = $1`,
      [session.userId]
    );

    if (!result.rows.length) {
      return Response.json({
        success: false,
        message: "User account not found."
      }, { status: 404 });
    }

    const user = result.rows[0];

    if (Number(session.sessionVersion) !== Number(user.session_version)) {
      cookieStore.set("auth_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0
      });

      return Response.json({
        success: false,
        message: "Your session is no longer valid. Please sign in again."
      }, { status: 401 });
    }

    if (!user.email_verified) {
      return Response.json({
        success: false,
        message: "Your account is not verified."
      }, { status: 403 });
    }

    return Response.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }
    });
  } catch (error) {
    console.error("Authentication check error:", error);
    return Response.json({
      success: false,
      message: "Unable to verify your authentication."
    }, { status: 500 });
  } finally {
    client?.release();
  }
}
