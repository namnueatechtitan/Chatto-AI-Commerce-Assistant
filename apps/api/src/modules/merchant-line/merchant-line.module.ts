import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { CredentialEncryptionModule } from "../../security/credential-encryption.module";
import { StoreInformationModule } from "../store-information/store-information.module";
import { LineProviderAdapter } from "./line-provider.adapter";
import { MerchantLineController } from "./merchant-line.controller";
import { MerchantLineGuard } from "./merchant-line.guard";
import { MerchantLineService } from "./merchant-line.service";
@Module({
  imports: [AuthModule, StoreInformationModule, CredentialEncryptionModule], controllers: [MerchantLineController],
  providers: [MerchantLineGuard, MerchantLineService,
    { provide: LineProviderAdapter, useFactory: () => new LineProviderAdapter() }],
})
export class MerchantLineModule {}
