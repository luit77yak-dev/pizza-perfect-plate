/** Server-owned metadata only; missing/ambiguous environments fail closed. */
export function isVisualDemoAllowed(env: Record<string, string | undefined>): boolean {
  if (env["VERCEL_ENV"] === "production" || env["VERCEL_TARGET_ENV"] === "production") return false;
  if (env["VERCEL_ENV"] === "preview")
    return !env["VERCEL_TARGET_ENV"] || env["VERCEL_TARGET_ENV"] === "preview";
  return (
    env["NODE_ENV"] === "development" &&
    !env["VERCEL"] &&
    !env["VERCEL_ENV"] &&
    !env["VERCEL_TARGET_ENV"]
  );
}
