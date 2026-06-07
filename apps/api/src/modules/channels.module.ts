import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const ChannelsModule = createPlaceholderResourceModule({
  resourceName: "channels",
  route: "channels",
  description: "Channel management",
});
