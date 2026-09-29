import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthSessionService } from "./auth-session.service";
import { GoogleAuthService } from "./google-auth.service";
import { LineAuthService } from "./line-auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthSessionService, GoogleAuthService, LineAuthService],
})
export class AuthModule {}
