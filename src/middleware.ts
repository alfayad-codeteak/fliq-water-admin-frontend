export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    // Run auth middleware only for app routes, never for static/assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
