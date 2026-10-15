import { createHash, randomBytes } from "node:crypto";
/** Server-only primitive; registration must use the real committed checkout key. */
export async function issueTrackingOnce(
  register: (sha256: string) => Promise<boolean>,
): Promise<string | undefined> {
  const token = randomBytes(32).toString("base64url");
  const registered = await register(createHash("sha256").update(token).digest("hex"));
  // Never recover or return an earlier secret: lost response => assisted support.
  return registered ? token : undefined;
}
