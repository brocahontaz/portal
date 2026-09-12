import { icons } from "../lib/icons";

/** Lifecycle status of a service. */
export type ServiceStatus = "live" | "beta" | "planned";

export const SERVICE_STATUSES = ["live", "beta", "planned"] as const;

/** One entry in the service registry (src/config/services.ts). */
export interface Service {
  /** Stable slug identifier; must be unique. */
  id: string;
  /** Display name; must be unique. */
  name: string;
  /** Short one-line description shown on the card. */
  description: string;
  /**
   * Public URL of the service. Must be an https:// URL for live/beta
   * services; must be an empty string for planned services.
   */
  url: string;
  /** Category name; cards are grouped under category sections. */
  category: string;
  status: ServiceStatus;
  /** Key into the icon registry (src/lib/icons.ts). */
  icon: string;
}

/**
 * Pure config validator for the service registry. Returns a list of
 * human-readable error strings; an empty list means the registry is valid.
 *
 * Accepts an optional known-icons map (defaults to the real icon registry)
 * so the function stays pure and easy to test.
 */
export function validateServices(
  services: readonly Service[],
  knownIcons: Readonly<Record<string, string>> = icons,
): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const service of services) {
    const label = service.id.trim() !== "" ? service.id : "(missing id)";

    for (const field of ["id", "name", "description", "category", "icon"] as const) {
      if (service[field].trim() === "") {
        errors.push(`${label}: "${field}" must be a non-empty string`);
      }
    }

    if (seenIds.has(service.id)) {
      errors.push(`${label}: duplicate service id "${service.id}"`);
    }
    if (seenNames.has(service.name)) {
      errors.push(`${label}: duplicate service name "${service.name}"`);
    }
    seenIds.add(service.id);
    seenNames.add(service.name);

    if (!(SERVICE_STATUSES as readonly string[]).includes(service.status)) {
      errors.push(
        `${label}: invalid status "${service.status}" (expected one of: ${SERVICE_STATUSES.join(", ")})`,
      );
    }

    if (service.status === "planned") {
      if (service.url !== "") {
        errors.push(`${label}: planned services must have an empty url`);
      }
    } else {
      let parsed: URL;
      try {
        parsed = new URL(service.url);
      } catch {
        errors.push(`${label}: url must be a well-formed https:// URL`);
        continue;
      }
      if (parsed.protocol !== "https:") {
        errors.push(`${label}: url must use https://`);
      }
    }

    if (!(service.icon in knownIcons)) {
      errors.push(`${label}: unknown icon "${service.icon}"`);
    }
  }

  return errors;
}
