import { existsSync, readFileSync } from "node:fs";
import { validateServices, type Service } from "./validate";

/**
 * The baked-in service registry fallback — the single source of truth for
 * the portal homepage when no override config is provided (see
 * `loadServices()`).
 *
 * No service data may be hardcoded in components; everything on the page is
 * derived from this array.
 *
 * Order matters:
 * - Array order is the display order within a category.
 * - Category sections appear in order of first appearance here, so
 *   reordering this array reorders the page.
 *
 * `status: "planned"` services must have `url: ""` and render as
 * non-link cards with a "Planned" badge; live/beta services render as links.
 */
export const defaultServices: Service[] = [
  {
    id: "circuitdeck",
    name: "CircuitDeck",
    description: "Factorio server dashboard: live map, players, and production stats.",
    // TODO: replace with the real public URL
    url: "https://circuitdeck.example.com",
    category: "Dashboards",
    status: "live",
    icon: "deck",
  },
  {
    id: "microbin",
    name: "MicroBin",
    description: "Self-hosted paste service, used until replaced by our own.",
    // TODO: replace with the real public URL
    url: "https://microbin.example.com",
    category: "Tools",
    status: "beta",
    icon: "paste",
  },
  {
    id: "factorio-blueprint-tools",
    name: "Factorio Blueprint Tools",
    description: "Search and manage Factorio blueprints.",
    url: "",
    category: "Tools",
    status: "planned",
    icon: "blueprint",
  },
  {
    id: "qr-forge",
    name: "QR Forge",
    description: "Generate QR codes for links, Wi-Fi credentials, and plain text.",
    url: "",
    category: "Tools",
    status: "planned",
    icon: "qrcode",
  },
  {
    id: "status-page",
    name: "Status Page",
    description: "Custom status page for all Fjällbark services.",
    url: "",
    category: "Platform",
    status: "planned",
    icon: "activity",
  },
];

/** Fields every JSON entry must have, all as strings (see `Service`). */
const SERVICE_FIELDS = [
  "id",
  "name",
  "description",
  "url",
  "category",
  "status",
  "icon",
] as const;

/**
 * Load the service registry from an optional mounted JSON config file.
 *
 * Behavior (fail-fast, so a bad override config can never silently change
 * what the portal serves):
 * - `path` unset/empty, or the file does not exist → return
 *   `defaultServices`. A missing file is a normal, non-error case.
 * - File exists → read and `JSON.parse`; parse failures throw a descriptive
 *   Error that includes the path.
 * - Entries pass a light structural check (plain objects with all string
 *   fields) BEFORE `validateServices()`, so bad shapes produce indexed,
 *   descriptive errors instead of raw TypeErrors from validator internals.
 *   JSON entries lacking a field are reported by index, since there is no
 *   id to name.
 * - Content validation is delegated to the pure `validateServices()`; its
 *   failures are surfaced joined, with the path referenced.
 * - A file that exists but is invalid ALWAYS throws — never falls back to
 *   the defaults.
 *
 * The mounted-config path is provided via the `PORTAL_SERVICES_PATH`
 * environment variable (consumed by the Docker entrypoint).
 */
export function loadServices(path?: string): Service[] {
  if (!path) {
    return defaultServices;
  }
  if (!existsSync(path)) {
    return defaultServices;
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`services config: failed to read "${path}": ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`services config: "${path}" is not valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`services config: "${path}" must contain a JSON array of services`);
  }

  const structuralErrors: string[] = [];
  for (const [index, entry] of parsed.entries()) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      structuralErrors.push(`services config: entry ${index} (index-based) is not an object`);
      continue;
    }
    const record = entry as Record<string, unknown>;
    for (const field of SERVICE_FIELDS) {
      if (typeof record[field] !== "string") {
        structuralErrors.push(
          `services config: entry ${index} (index-based) missing or invalid field "${field}"`,
        );
      }
    }
  }
  if (structuralErrors.length > 0) {
    throw new Error(structuralErrors.join("\n"));
  }

  const candidate = parsed as Service[];
  const errors = validateServices(candidate);
  if (errors.length > 0) {
    throw new Error(`services config: "${path}" is invalid:\n${errors.join("\n")}`);
  }
  return candidate;
}

/**
 * The service registry used by the portal page: the mounted config at
 * `PORTAL_SERVICES_PATH` when provided and valid, otherwise
 * `defaultServices`.
 */
export const services: Service[] = loadServices(process.env.PORTAL_SERVICES_PATH);
