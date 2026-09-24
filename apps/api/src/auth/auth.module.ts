import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthSessionService } from "./auth-session.service";
import { GoogleAuthService } from "./google-auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthSessionService, GoogleAuthService],
})
export class AuthModule {}
