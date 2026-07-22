// genereic placeholder resource module for frontend development, to be replaced with actual implementation later.
/* GET    /resource
GET    /resource/:id
POST   /resource
PATCH  /resource/:id
DELETE /resource/:id */


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

export function createPlaceholderResourceModule(
  options: PlaceholderModuleOptions,
): Type<unknown> {
  @Injectable()
  class PlaceholderResourceService {
    findAll() {
      return {
        resource: options.resourceName,
        items: [],
        message: `${options.description} list placeholder`,
      };
    }

    findOne(id: string) {
      return {
        resource: options.resourceName,
        id,
        message: `${options.description} detail placeholder`,
      };
    }

    create(payload: PlaceholderPayload) {
      return {
        resource: options.resourceName,
        payload,
        message: `${options.description} create placeholder`,
      };
    }

    update(id: string, payload: PlaceholderPayload) {
      return {
        resource: options.resourceName,
        id,
        payload,
        message: `${options.description} update placeholder`,
      };
    }

    remove(id: string) {
      return {
        resource: options.resourceName,
        id,
        message: `${options.description} delete placeholder`,
      };
    }
  }

  @ApiTags(options.resourceName)
  @Controller(options.route)
  class PlaceholderResourceController {
    constructor(
      private readonly placeholderResourceService: PlaceholderResourceService,
    ) {}

    @Get()
    @ApiOperation({ summary: `List ${options.resourceName}` })
    findAll() {
      return this.placeholderResourceService.findAll();
    }

    @Get(":id")
    @ApiOperation({ summary: `Get ${options.resourceName} by id` })
    findOne(@Param("id") id: string) {
      return this.placeholderResourceService.findOne(id);
    }

    @Post()
    @ApiOperation({ summary: `Create ${options.resourceName}` })
    create(@Body() payload: PlaceholderPayload) {
      return this.placeholderResourceService.create(payload);
    }

    @Patch(":id")
    @ApiOperation({ summary: `Update ${options.resourceName}` })
    update(
      @Param("id") id: string,
      @Body() payload: PlaceholderPayload,
    ) {
      return this.placeholderResourceService.update(id, payload);
    }

    @Delete(":id")
    @ApiOperation({ summary: `Delete ${options.resourceName}` })
    remove(@Param("id") id: string) {
      return this.placeholderResourceService.remove(id);
    }
  }

  @Module({
    controllers: [PlaceholderResourceController],
    providers: [PlaceholderResourceService],
  })
  class PlaceholderResourceModule {}

  return PlaceholderResourceModule;
}
