import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "node:crypto";
import bcrypt from "bcrypt";

const ISSUER = "Atlas Invest";
const BACKUP_CODE_COUNT = 10;

export function generateTwoFactorSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function buildQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code.trim(), secret });
  } catch {
    return false;
  }
}

function randomBackupCode(): string {
  const bytes = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${bytes.slice(0, 5)}-${bytes.slice(5, 10)}`;
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, randomBackupCode);
}

export function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code.trim().toUpperCase(), 10);
}

export function compareBackupCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code.trim().toUpperCase(), hash);
}
