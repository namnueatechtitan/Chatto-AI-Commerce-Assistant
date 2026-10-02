import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { StoreInformationModule } from "../store-information/store-information.module";
import { CatalogImportsController } from "./catalog-imports.controller";
import { CatalogImportsService } from "./catalog-imports.service";
@Module({ imports: [AuthModule, StoreInformationModule], controllers: [CatalogImportsController], providers: [CatalogImportsService] })
export class CatalogImportsModule {}
