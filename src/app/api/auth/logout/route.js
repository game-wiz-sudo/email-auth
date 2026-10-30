import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();

    cookieStore.set("auth_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0)
    });

    return Response.json({
      success: true,
      message: "You have been logged out successfully."
    });

  } catch (error) {
    console.error("Logout error:", error);

    return Response.json({
      success: false,
      message: "Unable to log out. Please try again."
    }, { status: 500 });
  }
}