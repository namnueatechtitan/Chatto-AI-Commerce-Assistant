import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { InternalAiController } from "./internal-ai.controller";
import { InternalAiService } from "./internal-ai.service";
import { ReadonlyQueryService } from "./readonly-query.service";

@Module({
  imports: [PrismaModule],
  controllers: [InternalAiController],
  providers: [InternalAiService, ReadonlyQueryService],
  exports: [InternalAiService],
})
export class InternalAiModule {}
