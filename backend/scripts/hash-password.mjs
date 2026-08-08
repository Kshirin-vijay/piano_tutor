#!/usr/bin/env node
import { generateSalt, hashPassword } from "../lib/crypto.mjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const passwordSalt = generateSalt();
const passwordHash = hashPassword(password, passwordSalt);
const signingSecret = generateSalt(32);

console.log(
  JSON.stringify(
    {
      passwordSalt,
      passwordHash,
      signingSecret,
    },
    null,
    2,
  ),
);
