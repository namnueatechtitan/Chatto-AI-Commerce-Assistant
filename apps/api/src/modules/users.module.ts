import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const UsersModule = createPlaceholderResourceModule({
  resourceName: "users",
  route: "users",
  description: "User management",
});
