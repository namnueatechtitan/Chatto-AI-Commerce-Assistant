import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InternalServiceGuard } from "../../auth/internal-service.guard";
import { InternalAiService } from "./internal-ai.service";
import { VectorDocumentSyncDto } from "./vector-sync.dto";

@Controller("internal/ai")
@UseGuards(InternalServiceGuard)
export class InternalAiController {
  constructor(private readonly internalAiService: InternalAiService) {}

  @Get("products/export")
  @Header("Cache-Control", "private, no-store")
  async exportProducts(
    @Query("merchant_id", ParseUUIDPipe) merchantId: string,
  ) {
    return this.internalAiService.exportProducts(merchantId);
  }

  @Get("knowledge-base/export")
  @Header("Cache-Control", "private, no-store")
  async exportKnowledgeBase(
    @Query("merchant_id", ParseUUIDPipe) merchantId: string,
  ) {
    return this.internalAiService.exportKnowledgeBase(merchantId);
  }

  @Get("vector-documents/export")
  @Header("Cache-Control", "private, no-store")
  async exportVectorDocuments(
    @Query("merchant_id", ParseUUIDPipe) merchantId: string,
  ) {
    return this.internalAiService.exportVectorDocuments(merchantId);
  }

  @Post("vector-documents/sync")
  @Header("Cache-Control", "private, no-store")
  async syncVectorDocuments(
    @Body() body: VectorDocumentSyncDto,
  ) {
    return this.internalAiService.syncVectorDocuments(
      body.merchant_id,
      body.documents,
    );
  }

  @Get("merchant-settings/:merchantId")
  @Header("Cache-Control", "private, no-store")
  async exportMerchantSettings(
    @Param("merchantId", ParseUUIDPipe) merchantId: string,
  ) {
    return this.internalAiService.exportMerchantSettings(merchantId);
  }
}
