import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const RolesModule = createPlaceholderResourceModule({
  resourceName: "roles",
  route: "roles",
  description: "Role management",
});
