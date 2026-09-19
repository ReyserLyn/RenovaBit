/**
 * Boot-time assertions.
 *
 * Imported FIRST by the entrypoint: ESM evaluates the import graph depth-first
 * in source order, so this module runs before anything else touches the
 * database, Redis or the auth secret. A failure here produces one readable
 * error in the container logs instead of a confusing crash from deep inside a
 * dependency.
 */
import { validateEnv } from "@/utils/env";

validateEnv();
