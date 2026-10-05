import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class LineSignatureService {
  verifySignature(rawBody: Buffer, signature: string, channelSecret: string): boolean {
    if (!channelSecret || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    const expectedSignature = createHmac("sha256", channelSecret)
      .update(rawBody)
      .digest("base64");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

}
