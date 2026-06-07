import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const ProductsModule = createPlaceholderResourceModule({
  resourceName: "products",
  route: "products",
  description: "Product management",
});
