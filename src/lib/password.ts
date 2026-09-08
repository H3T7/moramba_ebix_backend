import bcrypt from "bcryptjs";

/**
 * WHY WE HASH PASSWORDS
 * ----------------------
 * We never store a password as plain text. If our database ever leaked,
 * every user's real password would be exposed — and since people reuse
 * passwords, that's a disaster far beyond just our app.
 *
 * Instead we store a HASH: a one-way scramble of the password. "One-way"
 * means there's no function to turn the hash back into the password —
 * the only way to check a password is to hash the ATTEMPT the same way
 * and compare the two hashes.
 *
 * bcrypt specifically also "salts" the hash (mixes in random data unique
 * to each password) so two users with the same password get completely
 * different hashes, and adds deliberate computational slowness — that's
 * a feature, not a bug: it makes brute-forcing a password much slower.
 */

const SALT_ROUNDS = 10; // higher = slower to hash = more resistant to brute force, but slower logins. 10 is a solid default.

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}
