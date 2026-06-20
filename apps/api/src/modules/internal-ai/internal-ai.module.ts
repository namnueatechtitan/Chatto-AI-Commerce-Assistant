import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { InternalAiController } from "./internal-ai.controller";
import { InternalAiService } from "./internal-ai.service";

@Module({
  imports: [PrismaModule],
  controllers: [InternalAiController],
  providers: [InternalAiService],
  exports: [InternalAiService],
})
export class InternalAiModule {}
