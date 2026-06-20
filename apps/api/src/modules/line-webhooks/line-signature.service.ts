import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class LineSignatureService {
  constructor(private readonly configService: ConfigService) {}

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const channelSecret = this.getChannelSecret();
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

  private getChannelSecret(): string {
    const channelSecret = this.configService
      .get<string>("LINE_CHANNEL_SECRET")
      ?.trim();

    if (!channelSecret) {
      throw new InternalServerErrorException(
        "LINE_CHANNEL_SECRET is not configured",
      );
    }

    return channelSecret;
  }
}
