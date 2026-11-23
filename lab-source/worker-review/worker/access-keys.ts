// REVIEW SNAPSHOT: no operational Access keys. Fail closed until configured in protected build.
// Original RSA public JWK pins stay in the verified private source archive.
export const PINNED_ACCESS_KEYS: ReadonlyArray<JsonWebKey & {kid?:string}> = [];
