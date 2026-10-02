import { randomUUID } from "node:crypto";
import { Body, Controller, Get, Header, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import type { Request } from "express";
import { AuthModule } from "../auth/auth.module";
import { AuthSessionService, SESSION_COOKIE } from "../auth/auth-session.service";
import { readCookie, requireWebOrigin } from "../auth/auth-http";
import { PrismaService } from "../prisma/prisma.service";

const OWNER_ROLE_NAME = "Owner";
// A stable ID prevents duplicate Owner roles during concurrent first-time creation.
const OWNER_ROLE_ID = "6426c563-47cc-4c54-a827-b307c10f7263";
const merchantSelect = { id: true, shopName: true, slug: true, status: true, businessCategory: true, operatingHours: true } as const;

export class CreateMerchantDto {
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  shopName!: string;
}

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  findForUser(userId: string) {
    return this.prisma.merchantUser.findMany({
      where: { userId, status: "ACTIVE" },
      select: { merchant: { select: merchantSelect }, role: { select: { name: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  findOwnedByUser(userId: string) {
    return this.prisma.merchantUser.findMany({
      where: { userId, status: "ACTIVE", role: { name: OWNER_ROLE_NAME } },
      select: { merchant: { select: merchantSelect } },
    });
  }

  findOwners(merchantId: string) {
    return this.prisma.merchantUser.findMany({
      where: { merchantId, status: "ACTIVE", role: { name: OWNER_ROLE_NAME } },
      select: { user: { select: { id: true, name: true } } },
    });
  }

  async findForMember(userId: string, merchantId: string) {
    const membership = await this.prisma.merchantUser.findUnique({
      where: { merchantId_userId: { merchantId, userId } },
      select: { status: true, merchant: { select: merchantSelect }, role: { select: { name: true } } },
    });
    if (!membership || membership.status !== "ACTIVE") throw new NotFoundException("Merchant not found");
    return { merchant: membership.merchant, role: membership.role, owners: await this.findOwners(merchantId) };
  }

  create(userId: string, shopName: string) {
    return this.prisma.$transaction((tx) => this.createWithTransaction(tx, userId, shopName));
  }

  createForOnboarding(userId: string, shopName: string) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize first-store requests for this user without adding an onboarding table.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const membership = await tx.merchantUser.findFirst({
        where: { userId, status: "ACTIVE" },
        select: { merchant: { select: merchantSelect } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return membership?.merchant ?? this.createWithTransaction(tx, userId, shopName);
    });
  }

  async createWithTransaction(tx: Prisma.TransactionClient, userId: string, shopName: string, information: Partial<Prisma.MerchantCreateInput> = {}) {
    const existingRole = await tx.role.findFirst({ where: { name: OWNER_ROLE_NAME }, orderBy: { id: "asc" } });
    const ownerRole = existingRole ?? await tx.role.upsert({
      where: { id: OWNER_ROLE_ID }, update: { name: OWNER_ROLE_NAME },
      create: { id: OWNER_ROLE_ID, name: OWNER_ROLE_NAME, status: "active" },
    });
    return tx.merchant.create({
      data: {
        ...information, shopName, slug: randomUUID(),
        merchantUsers: { create: { userId, roleId: ownerRole.id } },
      },
      select: merchantSelect,
    });
  }
}

@ApiTags("merchants")
@Controller("merchants")
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService, private readonly sessions: AuthSessionService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  async list(@Req() request: Request) {
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return { memberships: await this.merchants.findForUser(user.id) };
  }

  @Post()
  @Header("Cache-Control", "no-store")
  async create(@Req() request: Request, @Body() body: CreateMerchantDto) {
    requireWebOrigin(request);
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return { merchant: await this.merchants.create(user.id, body.shopName) };
  }

  @Get(":merchantId")
  @Header("Cache-Control", "no-store")
  async detail(@Req() request: Request, @Param("merchantId", ParseUUIDPipe) merchantId: string) {
    const { user } = await this.sessions.profile(readCookie(request, SESSION_COOKIE));
    return this.merchants.findForMember(user.id, merchantId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
