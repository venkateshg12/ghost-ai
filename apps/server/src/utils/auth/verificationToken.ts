import crypto from "crypto";

/*
 Email-verification and password-reset links are bearer credentials: whoever holds the token can
  take the account. Storing them in plaintext means a leaked backup, a database read or a dump in
  a log is enough to reset any account, so only a digest is persisted — the raw token exists in
  the email and nowhere else.
 
  SHA-256 rather than bcrypt on purpose: the token is 256 bits of CSPRNG output, so there is no
 guessable secret to slow an attacker down, and a fast hash keeps the lookup a single indexed
  query instead of a scan-and-compare.
 */
export const createVerificationToken = () => {
    const token = crypto.randomBytes(32).toString("hex");
    return { token, tokenHash: hashVerificationToken(token) };
};

export const hashVerificationToken = (token: string) =>
    crypto.createHash("sha256").update(token).digest("hex");
