export interface RuntimeDatabaseRole { rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean }
export function validateRuntimeDatabaseRole(role: RuntimeDatabaseRole | undefined, environment = process.env.NODE_ENV): void {
  if (environment === "production" && (!role || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole))
    throw new Error("Production API requires a restricted database role");
}
