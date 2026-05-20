import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

type EncryptedJson = {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
};

@Injectable()
export class SecretVaultService {
  private readonly key = createHash("sha256")
    .update(
      process.env.CONNECTOR_SECRET_KEY ??
        process.env.JWT_SECRET ??
        "local-development-connector-secret",
    )
    .digest();

  encryptJson(value: Record<string, unknown> | undefined): EncryptedJson | null {
    if (!value || Object.keys(value).length === 0) return null;

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      alg: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: data.toString("base64"),
    };
  }

  decryptJson(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") return {};
    const encrypted = value as Partial<EncryptedJson>;
    if (
      encrypted.alg !== "aes-256-gcm" ||
      !encrypted.iv ||
      !encrypted.tag ||
      !encrypted.data
    ) {
      return {};
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.data, "base64")),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(decrypted) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  }
}
