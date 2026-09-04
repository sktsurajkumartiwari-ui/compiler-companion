import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve from this module so both tsx (src/) and compiled Node (dist/) load the workspace .env.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
