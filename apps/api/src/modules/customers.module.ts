import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const CustomersModule = createPlaceholderResourceModule({
  resourceName: "customers",
  route: "customers",
  description: "Customer management",
});
