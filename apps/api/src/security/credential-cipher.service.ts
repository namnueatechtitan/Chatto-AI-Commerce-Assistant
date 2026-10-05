import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { isUUID } from "class-validator";

export type CredentialField = "channelSecret" | "channelAccessToken";
export interface CredentialContext { merchantId: string; channelId: string; field: CredentialField }
const unavailable = () => new ServiceUnavailableException("LINE credential encryption is unavailable");
const keyIdPattern = /^[A-Za-z0-9_-]{1,32}$/;

@Injectable()
export class CredentialCipherService {
  // Configuration is supplied by a secret manager/environment, never persisted in the DB.
  private keys() {
    try {
      const active = process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID ?? "";
      const value: unknown = JSON.parse(process.env.LINE_CREDENTIAL_KEYRING ?? "");
      if (!keyIdPattern.test(active) || !value || Array.isArray(value) || typeof value !== "object") throw unavailable();
      const entries = Object.entries(value);
      if (!entries.length || entries.length > 16) throw unavailable();
      const ring = new Map<string, Buffer>();
      for (const [id, encoded] of entries) {
        if (!keyIdPattern.test(id) || typeof encoded !== "string") throw unavailable();
        const key = Buffer.from(encoded, "base64");
        if (key.length !== 32 || key.toString("base64") !== encoded) throw unavailable();
        ring.set(id, key);
      }
      if (!ring.has(active)) throw unavailable();
      return { active, ring };
    } catch { throw unavailable(); }
  }
  private aad(context: CredentialContext, keyId: string): Buffer {
    if (!isUUID(context.merchantId) || !isUUID(context.channelId) ||
      !["channelSecret", "channelAccessToken"].includes(context.field)) throw unavailable();
    return Buffer.from(JSON.stringify(["chatto-line", "v1", keyId, context.merchantId.toLowerCase(), context.channelId.toLowerCase(), context.field]));
  }
  encrypt(plaintext: string, context: CredentialContext): string {
    try {
      if (!plaintext || Buffer.byteLength(plaintext) > 4096) throw unavailable();
      const { active, ring } = this.keys(), nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", ring.get(active)!, nonce);
      cipher.setAAD(this.aad(context, active));
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return ["chatto-line", "v1", active, nonce.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
    } catch { throw unavailable(); }
  }
  decrypt(envelope: string, context: CredentialContext): string {
    try {
      if (envelope.length > 6000) throw unavailable();
      const parts = envelope.split(":");
      if (parts.length !== 6 || parts[0] !== "chatto-line" || parts[1] !== "v1" || !keyIdPattern.test(parts[2])) throw unavailable();
      const buffers = parts.slice(3).map((part) => {
        const buffer = Buffer.from(part, "base64");
        if (buffer.toString("base64") !== part) throw unavailable();
        return buffer;
      });
      const [nonce, tag, encrypted] = buffers;
      const key = this.keys().ring.get(parts[2]);
      if (!key || nonce.length !== 12 || tag.length !== 16 || !encrypted.length || encrypted.length > 4096) throw unavailable();
      const decipher = createDecipheriv("aes-256-gcm", key, nonce);
      decipher.setAAD(this.aad(context, parts[2]));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch { throw unavailable(); }
  }
  reencrypt(envelope: string, context: CredentialContext): string {
    return this.encrypt(this.decrypt(envelope, context), context);
  }
}
