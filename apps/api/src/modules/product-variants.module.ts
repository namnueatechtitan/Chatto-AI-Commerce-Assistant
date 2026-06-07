import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const ProductVariantsModule = createPlaceholderResourceModule({
  resourceName: "product-variants",
  route: "product-variants",
  description: "Product variant management",
});
