import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const MessagesModule = createPlaceholderResourceModule({
  resourceName: "messages",
  route: "messages",
  description: "Message management",
});
