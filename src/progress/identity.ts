/**
 * The single place that resolves "who is this practice for". Today there is one
 * local user, so this returns "local". When the server/native phase adds
 * accounts, this is the only function that changes (it returns the authenticated
 * user id), and all per-user storage keys follow automatically.
 */

const LOCAL_USER_ID = "local";

export function getUserId(): string {
  return LOCAL_USER_ID;
}
