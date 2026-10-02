import { parentPort, workerData } from "node:worker_threads";
import { parseCatalog } from "./catalog-parser";
import type { CatalogFormat } from "./catalog-types";
const input = workerData as { path: string; format: CatalogFormat };
void parseCatalog(input.path, input.format).then(
  (preview) => parentPort?.postMessage({ preview }),
  (error: unknown) => parentPort?.postMessage({ error: error instanceof Error && !/^(ENOENT|EACCES|EPERM)/.test(error.message) ? error.message.slice(0, 500) : "Catalog could not be read. Upload the file again to retry." }),
);
