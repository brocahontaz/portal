import { describe, expect, it } from "vitest";
import { site } from "../src/config/site";
import { services } from "../src/config/services";
import {
  SERVICE_STATUSES,
  validateServices,
  type Service,
} from "../src/config/validate";
import { icons } from "../src/lib/icons";

/** Expected registry shape pinned by the spec: exact set, exact order. */
const EXPECTED_IDS = [
  "circuitdeck",
  "microbin",
  "factorio-blueprint-tools",
  "qr-forge",
  "status-page",
];

function serviceById(id: string): Service {
  const found = services.find((service) => service.id === id);
  if (!found) {
    throw new Error(`Expected a service with id "${id}" in the registry`);
  }
  return found;
}

describe("service registry: required fields", () => {
  it("every service has non-empty id, name, description, category, and icon", () => {
    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      expect(service.id.trim(), `id of ${JSON.stringify(service)}`).not.toBe("");
      expect(service.name.trim(), `name of ${service.id}`).not.toBe("");
      expect(service.description.trim(), `description of ${service.id}`).not.toBe("");
      expect(service.category.trim(), `category of ${service.id}`).not.toBe("");
      expect(service.icon.trim(), `icon of ${service.id}`).not.toBe("");
    }
  });

  it("has unique ids", () => {
    const ids = services.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique names", () => {
    const names = services.map((service) => service.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("only uses valid status values", () => {
    for (const service of services) {
      expect(SERVICE_STATUSES).toContain(service.status);
    }
  });
});

describe("service registry: urls", () => {
  it("live and beta services have well-formed https:// URLs", () => {
    for (const service of services) {
      if (service.status === "live" || service.status === "beta") {
        let parsed: URL;
        expect(() => {
          parsed = new URL(service.url);
        }, `url of ${service.id}`).not.toThrow();
        expect(parsed!.protocol).toBe("https:");
      }
    }
  });

  it("planned services have an empty url", () => {
    for (const service of services) {
      if (service.status === "planned") {
        expect(service.url, `url of ${service.id}`).toBe("");
      }
    }
  });
});

describe("service registry: icons", () => {
  it("all service icons resolve in the icon registry", () => {
    for (const service of services) {
      expect(icons[service.icon], `icon "${service.icon}" of ${service.id}`).toBeTruthy();
    }
  });
});

describe("service registry: shape and order", () => {
  it("contains exactly the expected services in the expected order", () => {
    expect(services.map((service) => service.id)).toEqual(EXPECTED_IDS);
  });

  it("keeps category sections in order of first appearance", () => {
    const categories: string[] = [];
    for (const service of services) {
      if (!categories.includes(service.category)) {
        categories.push(service.category);
      }
    }
    expect(categories).toEqual(["Dashboards", "Tools", "Platform"]);
  });
});

describe("validateServices()", () => {
  it("accepts the shipped registry (default icon registry)", () => {
    expect(validateServices(services)).toEqual([]);
  });

  it("accepts the shipped registry (explicit icon registry)", () => {
    expect(validateServices(services, icons)).toEqual([]);
  });

  it("flags an unknown icon", () => {
    const broken: Service[] = [{ ...serviceById("circuitdeck"), icon: "does-not-exist" }];
    expect(validateServices(broken, icons)).toContain(
      'circuitdeck: unknown icon "does-not-exist"',
    );
  });

  it("flags duplicate ids and duplicate names", () => {
    const duplicate = serviceById("microbin");
    const broken: Service[] = [duplicate, { ...duplicate }];
    const errors = validateServices(broken, icons);
    expect(errors.some((error) => error.includes("duplicate service id"))).toBe(true);
    expect(errors.some((error) => error.includes("duplicate service name"))).toBe(true);
  });

  it("flags an invalid status", () => {
    const broken: Service[] = [
      { ...serviceById("status-page"), status: "retired" as Service["status"] },
    ];
    const errors = validateServices(broken, icons);
    expect(errors.some((error) => error.includes('invalid status "retired"'))).toBe(true);
  });

  it("flags a planned service with a non-empty url", () => {
    const broken: Service[] = [{ ...serviceById("qr-forge"), url: "https://qr.example.com" }];
    const errors = validateServices(broken, icons);
    expect(
      errors.some((error) => error.includes("planned services must have an empty url")),
    ).toBe(true);
  });

  it("flags a live service with a non-https or malformed url", () => {
    const http: Service[] = [{ ...serviceById("circuitdeck"), url: "http://circuitdeck.example.com" }];
    expect(validateServices(http, icons).some((error) => error.includes("https://"))).toBe(true);

    const malformed: Service[] = [{ ...serviceById("circuitdeck"), url: "not-a-url" }];
    expect(
      validateServices(malformed, icons).some((error) =>
        error.includes("well-formed https:// URL"),
      ),
    ).toBe(true);
  });
});

describe("site config", () => {
  it("has non-empty title, description, and tagline", () => {
    expect(site.title.trim()).not.toBe("");
    expect(site.description.trim()).not.toBe("");
    expect(site.tagline.trim()).not.toBe("");
  });
});
