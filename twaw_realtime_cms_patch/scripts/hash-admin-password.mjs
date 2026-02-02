#!/usr/bin/env node
import crypto from 'node:crypto';

// Usage:
//   node scripts/hash-admin-password.mjs "your super secret password"
// Output:
//   hex SHA-256 hash (paste into wrangler secret ADMIN_PASSWORD_HASH)

const password = process.argv.slice(2).join(' ').trim();
if (!password) {
  console.error('Usage: node scripts/hash-admin-password.mjs "your password"');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
console.log(hash);
