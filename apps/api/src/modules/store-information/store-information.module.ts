import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { MerchantsModule } from "../merchants.module";
import { StoreInformationController } from "./store-information.controller";
import { StoreInformationService } from "./store-information.service";
@Module({ imports: [AuthModule, MerchantsModule], controllers: [StoreInformationController], providers: [StoreInformationService], exports: [StoreInformationService] })
export class StoreInformationModule {}
