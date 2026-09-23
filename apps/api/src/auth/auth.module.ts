import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./auth-session.service";
import { GoogleAuthService } from "./google-auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, GoogleAuthService],
})
export class AuthModule {}
