import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const MerchantsModule = createPlaceholderResourceModule({
  resourceName: "merchants",
  route: "merchants",
  description: "Merchant management",
});
