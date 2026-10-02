import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { MerchantsModule } from "../merchants.module";
import { StoreInformationModule } from "../store-information/store-information.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({ imports: [AuthModule, MerchantsModule, StoreInformationModule], controllers: [OnboardingController], providers: [OnboardingService] })
export class OnboardingModule {}
