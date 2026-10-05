import { Injectable } from "@nestjs/common";

import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  register(payload: RegisterDto) {
    return {
      message: "Phase 2 register scaffold",
      user: {
        id: "placeholder-user-id",
        email: payload.email,
        name: payload.name,
      },
      merchant: {
        id: "placeholder-merchant-id",
        shopName: payload.shopName,
        businessCategory: payload.businessCategory ?? null,
      },
      tokens: {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      },
    };
  }

  login(payload: LoginDto) {
    return {
      message: "Phase 2 login scaffold",
      user: {
        id: "placeholder-user-id",
        email: payload.email,
      },
      tokens: {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      },
    };
  }

  profile() {
    return {
      message: "Phase 2 auth profile scaffold",
      user: {
        id: "placeholder-user-id",
        email: "merchant@example.com",
        name: "Alice Merchant",
        merchantId: "placeholder-merchant-id",
      },
    };
  }
}
