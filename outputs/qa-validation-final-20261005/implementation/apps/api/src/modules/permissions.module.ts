import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const PermissionsModule = createPlaceholderResourceModule({
  resourceName: "permissions",
  route: "permissions",
  description: "Permission management",
});
