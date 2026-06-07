import { createPlaceholderResourceModule } from "../common/placeholders/placeholder-resource.factory";

export const PromptVersionsModule = createPlaceholderResourceModule({
  resourceName: "prompt-versions",
  route: "prompt-versions",
  description: "Prompt version management",
});
