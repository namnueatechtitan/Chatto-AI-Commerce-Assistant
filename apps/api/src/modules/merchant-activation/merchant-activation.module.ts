import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { StoreInformationModule } from "../store-information/store-information.module";
import { MerchantActivationController } from "./merchant-activation.controller";
import { MerchantActivationGuard } from "./merchant-activation.guard";
import { MerchantActivationService } from "./merchant-activation.service";
@Module({ imports: [AuthModule, StoreInformationModule], controllers: [MerchantActivationController],
  providers: [MerchantActivationService, MerchantActivationGuard], exports: [MerchantActivationService] })
export class MerchantActivationModule {}
