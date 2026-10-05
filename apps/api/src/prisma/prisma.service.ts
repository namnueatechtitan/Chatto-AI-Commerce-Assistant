import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { RuntimeDatabaseRole, validateRuntimeDatabaseRole } from "./runtime-role";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.$connect();
      if (process.env.NODE_ENV === "production") {
        const roles = await this.$queryRawUnsafe<RuntimeDatabaseRole[]>(
          "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user",
        );
        validateRuntimeDatabaseRole(roles[0]);
      }
    } catch {
      await this.$disconnect();
      throw new Error("API database connection or runtime role policy is unavailable");
    }
  }
}
