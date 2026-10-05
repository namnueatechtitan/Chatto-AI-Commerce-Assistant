import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const LineWebhookEventsModule = createPlaceholderResourceModule({
  resourceName: "line-webhook-events",
  route: "line-webhook-events",
  description: "LINE webhook event management",
});
