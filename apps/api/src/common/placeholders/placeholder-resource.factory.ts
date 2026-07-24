/**
 * หน้าที่ไฟล์: ไฟล์นี้สร้างโมดูล placeholder แบบใช้ซ้ำได้ เพื่อ scaffold resource API หลายตัวใน Phase 2
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Type,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

type PlaceholderPayload = Record<string, unknown>;

interface PlaceholderModuleOptions {
  resourceName: string;
  route: string;
  description: string;
}

/**
 * หน้าที่: สร้างโมดูล placeholder แบบสำเร็จรูปเพื่อ reuse กับ resource scaffold หลายตัวใน Phase 2
 */
export function createPlaceholderResourceModule(
  options: PlaceholderModuleOptions,
): Type<unknown> {
  /**
   * หน้าที่: service นี้สร้าง response placeholder สำหรับ resource ที่ถูกส่งเข้ามาจาก factory
   */
  @Injectable()
  class PlaceholderResourceService {
    /**
     * หน้าที่: คืนรายการ placeholder ทั้งหมดของ resource นี้
     */
    findAll() {
      return {
        resource: options.resourceName,
        items: [],
        message: `${options.description} list placeholder`,
      };
    }

    /**
     * หน้าที่: คืนรายละเอียด placeholder ของ resource ตาม id ที่รับเข้ามา
     */
    findOne(id: string) {
      return {
        resource: options.resourceName,
        id,
        message: `${options.description} detail placeholder`,
      };
    }

    /**
     * หน้าที่: สร้าง response placeholder สำหรับการสร้างข้อมูลของ resource นี้
     */
    create(payload: PlaceholderPayload) {
      return {
        resource: options.resourceName,
        payload,
        message: `${options.description} create placeholder`,
      };
    }

    /**
     * หน้าที่: สร้าง response placeholder สำหรับการอัปเดตข้อมูลของ resource นี้
     */
    update(id: string, payload: PlaceholderPayload) {
      return {
        resource: options.resourceName,
        id,
        payload,
        message: `${options.description} update placeholder`,
      };
    }

    /**
     * หน้าที่: สร้าง response placeholder สำหรับการลบข้อมูลของ resource นี้
     */
    remove(id: string) {
      return {
        resource: options.resourceName,
        id,
        message: `${options.description} delete placeholder`,
      };
    }
  }

  /**
   * หน้าที่: controller นี้เปิด endpoint placeholder ของ resource ที่ถูกส่งเข้ามาจาก factory
   */
  @ApiTags(options.resourceName)
  @Controller(options.route)
  class PlaceholderResourceController {
    /**
     * หน้าที่: ประกอบ dependency ที่คลาสนี้ต้องใช้ระหว่างการทำงาน
     */
    constructor(
      private readonly placeholderResourceService: PlaceholderResourceService,
    ) {}

    /**
     * หน้าที่: เปิด endpoint สำหรับดูรายการ placeholder ของ resource นี้
     */
    @Get()
    @ApiOperation({ summary: `List ${options.resourceName}` })
    findAll() {
      return this.placeholderResourceService.findAll();
    }

    /**
     * หน้าที่: เปิด endpoint สำหรับดูรายละเอียด placeholder ของ resource นี้ตาม id
     */
    @Get(":id")
    @ApiOperation({ summary: `Get ${options.resourceName} by id` })
    findOne(@Param("id") id: string) {
      return this.placeholderResourceService.findOne(id);
    }

    /**
     * หน้าที่: เปิด endpoint สำหรับสร้างข้อมูล placeholder ของ resource นี้
     */
    @Post()
    @ApiOperation({ summary: `Create ${options.resourceName}` })
    create(@Body() payload: PlaceholderPayload) {
      return this.placeholderResourceService.create(payload);
    }

    /**
     * หน้าที่: เปิด endpoint สำหรับอัปเดตข้อมูล placeholder ของ resource นี้
     */
    @Patch(":id")
    @ApiOperation({ summary: `Update ${options.resourceName}` })
    update(
      @Param("id") id: string,
      @Body() payload: PlaceholderPayload,
    ) {
      return this.placeholderResourceService.update(id, payload);
    }

    /**
     * หน้าที่: เปิด endpoint สำหรับลบข้อมูล placeholder ของ resource นี้
     */
    @Delete(":id")
    @ApiOperation({ summary: `Delete ${options.resourceName}` })
    remove(@Param("id") id: string) {
      return this.placeholderResourceService.remove(id);
    }
  }

  /**
   * หน้าที่: โมดูลนี้จับคู่ controller และ service placeholder ของ resource ที่ถูกสร้างจาก factory
   */
  @Module({
    controllers: [PlaceholderResourceController],
    providers: [PlaceholderResourceService],
  })
  class PlaceholderResourceModule {}

  return PlaceholderResourceModule;
}
