import { Body, Controller, Get, Header, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import type { Request } from "express";
import { readCookie, requireWebOrigin } from "../../auth/auth-http";
import { AuthSessionService, SESSION_COOKIE } from "../../auth/auth-session.service";
import { CreateOnboardingStoreDto } from "../store-information/store-information.dto";
import { StoreInformationService } from "../store-information/store-information.service";
import { OnboardingService } from "./onboarding.service";

class OnboardingQuery {
  @IsOptional()
  @IsUUID()
  merchantId?: string;
}

@ApiTags("onboarding")
@Controller("onboarding")
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly sessions: AuthSessionService,
    private readonly information: StoreInformationService,
  ) {}

  @Get("status")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Derive onboarding progress for an authenticated merchant member" })
  async status(@Req() request: Request, @Query() query: OnboardingQuery) {
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return { user, ...await this.onboarding.status(user.id, query.merchantId) };
  }

  @Post("store")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Atomically create the first store with required information and optional FAQs; retry by requestId" })
  async createStore(@Req() request: Request, @Body() body: CreateOnboardingStoreDto) {
    requireWebOrigin(request);
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return this.information.create(user.id, body);
  }
}
