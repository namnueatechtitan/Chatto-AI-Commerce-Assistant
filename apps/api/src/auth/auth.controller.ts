import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register a merchant user placeholder" })
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post("login")
  @ApiOperation({ summary: "Login placeholder" })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Get("profile")
  @ApiOperation({ summary: "Current merchant profile placeholder" })
  profile() {
    return this.authService.profile();
  }
}
