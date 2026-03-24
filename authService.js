const crypto = require('crypto');

// ── AES-256-CBC helpers ───────────────────────────────────────────────────────
// Your passwords are stored as AES-256 encrypted strings.
// We decrypt the stored password and compare it in plain text.
//
// Required env vars:
//   AES_SECRET_KEY  — 32-byte hex string  (64 hex chars)
//   AES_SECRET_IV   — 16-byte hex string  (32 hex chars)

function getKeyAndIV() {
  const key = process.env.AES_SECRET_KEY;
  const iv  = process.env.AES_SECRET_IV;

  if (!key || !iv) {
    throw new Error('AES_SECRET_KEY and AES_SECRET_IV must be set in environment variables');
  }
  if (key.length !== 64) {
    throw new Error('AES_SECRET_KEY must be a 64-character hex string (32 bytes)');
  }
  if (iv.length !== 32) {
    throw new Error('AES_SECRET_IV must be a 32-character hex string (16 bytes)');
  }

  return {
    key: Buffer.from(key, 'hex'),
    iv:  Buffer.from(iv,  'hex'),
  };
}

/**
 * Decrypts an AES-256-CBC encrypted string.
 * The stored password is expected to be a base64-encoded ciphertext.
 *
 * @param {string} encryptedBase64 — the password as stored in MongoDB
 * @returns {string} — the decrypted plain-text password
 */
function decryptPassword(encryptedBase64) {
  const { key, iv } = getKeyAndIV();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Encrypts a plain-text password using AES-256-CBC.
 * Useful for seeding users or changing passwords.
 *
 * @param {string} plainText
 * @returns {string} — base64-encoded ciphertext (ready to store in MongoDB)
 */
function encryptPassword(plainText) {
  const { key, iv } = getKeyAndIV();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  return encrypted.toString('base64');
}

/**
 * Verifies a plain-text password against the encrypted one stored in MongoDB.
 *
 * @param {string} plainText      — password submitted in the login request
 * @param {string} encryptedBase64 — password as stored in MongoDB
 * @returns {boolean}
 */
function verifyPassword(plainText, encryptedBase64) {
    const decrypted = decryptPassword(encryptedBase64);
    if (decrypted === plainText) {
        return true;
    } else {
        return false;
    }
} 

module.exports = { encryptPassword, decryptPassword, verifyPassword };
