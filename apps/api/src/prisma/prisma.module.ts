/**
 * หน้าที่ไฟล์: ไฟล์นี้ประกาศ Prisma module เพื่อให้ service อื่น ๆ inject PrismaService ไปใช้งานได้
 */

import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * หน้าที่: โมดูลนี้รวบรวม dependency ของ Prisma
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
