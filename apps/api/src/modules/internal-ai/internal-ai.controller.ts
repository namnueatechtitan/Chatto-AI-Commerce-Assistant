import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { InternalAiService } from "./internal-ai.service";

function assertInternalToken(authHeader?: string): void {
  const expected = process.env.INTERNAL_SERVICE_TOKEN ?? "dev_internal_service_token";

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedException("Missing internal service token");
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (token !== expected) {
    throw new UnauthorizedException("Invalid internal service token");
  }
}

@Controller("internal/ai")
export class InternalAiController {
  constructor(private readonly internalAiService: InternalAiService) {}

  @Get("products/export")
  async exportProducts(
    @Headers("authorization") authorization: string | undefined,
    @Query("merchant_id") merchantId: string,
  ) {
    assertInternalToken(authorization);
    return this.internalAiService.exportProducts(merchantId);
  }

  @Get("knowledge-base/export")
  async exportKnowledgeBase(
    @Headers("authorization") authorization: string | undefined,
    @Query("merchant_id") merchantId: string,
  ) {
    assertInternalToken(authorization);
    return this.internalAiService.exportKnowledgeBase(merchantId);
  }

  @Get("vector-documents/export")
  async exportVectorDocuments(
    @Headers("authorization") authorization: string | undefined,
    @Query("merchant_id") merchantId: string,
  ) {
    assertInternalToken(authorization);
    return this.internalAiService.exportVectorDocuments(merchantId);
  }

  @Get("merchant-settings/:merchantId")
  async exportMerchantSettings(
    @Headers("authorization") authorization: string | undefined,
    @Param("merchantId") merchantId: string,
  ) {
    assertInternalToken(authorization);
    return this.internalAiService.exportMerchantSettings(merchantId);
  }
}
