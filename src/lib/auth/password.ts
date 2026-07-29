import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A hash of nothing, to compare against when there is no user.
 *
 * Returning the same message for "no such account" and "wrong password" is not
 * enough on its own: bcrypt at ten rounds takes on the order of a hundred
 * milliseconds, and skipping it when the account does not exist makes the two
 * cases trivially distinguishable by response time. That turns the login
 * endpoint into a membership oracle for a service whose membership is itself
 * sensitive — "this person is chasing benefits" is not a fact we get to leak,
 * and it is the same reasoning the password-reset flow already applies.
 *
 * Generated once at module load from a value nobody knows, so it can never
 * match a real password.
 */
const ABSENT_USER_HASH = bcrypt.hashSync(
  `absent-user-${Math.random().toString(36)}${Date.now()}`,
  ROUNDS,
);

/**
 * Spend the same time verifying a password for an account that does not exist.
 * The result is always false and is never a reason to admit anybody.
 */
export async function burnPasswordComparison(plain: string): Promise<false> {
  await bcrypt.compare(plain, ABSENT_USER_HASH);
  return false;
}
