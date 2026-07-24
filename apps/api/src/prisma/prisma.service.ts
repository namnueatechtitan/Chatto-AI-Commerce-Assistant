/**
 * หน้าที่ไฟล์: ไฟล์นี้เก็บ Prisma service ที่ดูแลการเชื่อมต่อฐานข้อมูลของ NestJS API
 */

import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * หน้าที่: service นี้ห่อ PrismaClient เพื่อให้ NestJS ใช้งานฐานข้อมูลร่วมกันได้สะดวก
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /**
   * หน้าที่: เมธอดนี้จัดการ on Module Init ภายในคลาส Prisma Service
   */
  async onModuleInit() {
    await this.$connect();
  }
}
