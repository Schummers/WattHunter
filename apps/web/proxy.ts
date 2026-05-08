import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclude `dev/*` so wireframe previews bypass auth middleware
    "/((?!_next/static|_next/image|favicon.ico|dev/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
