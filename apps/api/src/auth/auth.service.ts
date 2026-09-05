import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";

import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  private readonly invalidCredentialsMessage = "Invalid email or password";

  constructor(private readonly prismaService: PrismaService) {}

  async register(payload: RegisterDto) {
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: payload.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await argon2.hash(payload.password);

    try {
      const user = await this.prismaService.user.create({
        data: {
          name: payload.name,
          email: payload.email,
          passwordHash,
          globalRole: "merchant_user",
        },
        select: {
          id: true,
          name: true,
          email: true,
          globalRole: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        message: "Registration successful",
        user,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An account with this email already exists");
      }

      throw error;
    }
  }

  async login(payload: LoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    let passwordMatches = false;

    try {
      passwordMatches = await argon2.verify(user.passwordHash, payload.password);
    } catch {
      passwordMatches = false;
    }

    if (!passwordMatches) {
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    return {
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
        status: user.status,
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
