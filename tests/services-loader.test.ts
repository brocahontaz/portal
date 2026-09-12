import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultServices, loadServices } from "../src/config/services";
import { validateServices, type Service } from "../src/config/validate";
import { icons } from "../src/lib/icons";

/**
 * Focused tests for loadServices(): the mounted-config loader on top of the
 * baked-in defaultServices fallback. Fixtures are written to a temp dir and
 * cleaned up; nothing is committed.
 */

let tempDir = "";

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "portal-services-loader-"));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

/** Write raw fixture content and return its path. */
function writeFixture(name: string, content: string): string {
  const path = join(tempDir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

/** Write a JSON fixture (already stringified) and return its path. */
function writeJsonFixture(name: string, content: unknown): string {
  return writeFixture(name, `${JSON.stringify(content, null, 2)}\n`);
}

/** Run loadServices() and return the thrown error; fails the test if nothing throws. */
function loadError(path: string): Error {
  try {
    loadServices(path);
  } catch (error) {
    return error as Error;
  }
  throw new Error(`Expected loadServices(${JSON.stringify(path)}) to throw`);
}

/** A valid entry satisfying all validateServices() rules; tweak fields per test. */
function validService(overrides: Partial<Service> = {}): Service {
  return {
    id: "loader-live",
    name: "Loader Test Service",
    description: "Service used by the loader tests.",
    url: "https://loader.example.com",
    category: "Dashboards",
    status: "live",
    icon: "deck",
    ...overrides,
  };
}

describe("loadServices(): fallback to defaults", () => {
  it("returns defaultServices when the path is unset", () => {
    expect(loadServices()).toEqual(defaultServices);
  });

  it("returns defaultServices when the path is empty", () => {
    expect(loadServices("")).toEqual(defaultServices);
  });

  it("returns defaultServices when the file does not exist", () => {
    const path = join(tempDir, "does-not-exist.json");
    expect(loadServices(path)).toEqual(defaultServices);
  });
});

describe("loadServices(): valid file", () => {
  it("returns parsed and validated services instead of the defaults", () => {
    const path = writeJsonFixture("valid.json", [
      validService(),
      validService({
        id: "loader-planned",
        name: "Loader Planned Service",
        url: "",
        status: "planned",
        icon: "blueprint",
      }),
    ]);
    const loaded = loadServices(path);
    expect(loaded).not.toEqual(defaultServices);
    expect(loaded[0]).toEqual(validService());
    expect(loaded.map((service) => service.id)).toEqual(["loader-live", "loader-planned"]);
  });
});

describe("loadServices(): invalid JSON", () => {
  it("throws a descriptive error that includes the path", () => {
    const path = writeFixture("broken.json", "{ not valid json");
    const error = loadError(path);
    expect(error.message).toContain(path);
    expect(error.message).toContain("is not valid JSON");
  });
});

describe("loadServices(): structural errors", () => {
  it("reports a missing field by index, not as a raw TypeError", () => {
    const entry = validService() as unknown as Record<string, unknown>;
    delete entry.name;
    const path = writeJsonFixture("missing-name.json", [entry]);
    const error = loadError(path);
    expect(error.message).toContain('entry 0 (index-based) missing or invalid field "name"');
    expect(error.message).toContain("services config");
    expect(error.name).not.toBe("TypeError");
  });

  it("reports a non-string field by index", () => {
    const path = writeJsonFixture("nonstring-status.json", [
      { ...validService(), status: 3 },
    ]);
    expect(loadError(path).message).toContain(
      'entry 0 (index-based) missing or invalid field "status"',
    );
  });

  it("reports a non-object entry by index", () => {
    const path = writeJsonFixture("non-object-entry.json", [validService(), "just-a-string"]);
    expect(loadError(path).message).toContain("entry 1 (index-based) is not an object");
  });
});

describe("loadServices(): content errors (validateServices)", () => {
  it("throws for an unknown icon, referencing the path", () => {
    const path = writeJsonFixture("unknown-icon.json", [
      validService({ icon: "does-not-exist" }),
    ]);
    const error = loadError(path);
    expect(error.message).toContain('unknown icon "does-not-exist"');
    expect(error.message).toContain(path);
  });

  it("throws for an invalid status value, referencing the path", () => {
    const path = writeJsonFixture("invalid-status.json", [
      validService({ status: "retired" as Service["status"] }),
    ]);
    const error = loadError(path);
    expect(error.message).toContain('invalid status "retired"');
    expect(error.message).toContain(path);
  });

  it("throws for a duplicate id, referencing the path", () => {
    const original = validService();
    const path = writeJsonFixture("duplicate-id.json", [
      original,
      { ...original, name: "Loader Duplicate Name" },
    ]);
    const error = loadError(path);
    expect(error.message).toContain('duplicate service id "loader-live"');
    expect(error.message).toContain(path);
  });
});

describe("config/services.example.json", () => {
  const examplePath = fileURLToPath(
    new URL("../config/services.example.json", import.meta.url),
  );

  it("is a valid mounted-config example that loads through the loader", () => {
    const raw: unknown = JSON.parse(readFileSync(examplePath, "utf8"));
    expect(validateServices(raw as Service[], icons)).toEqual([]);
    // The example mirrors the baked-in registry, so loading it yields the
    // defaults — this pins the example file to the real schema and content.
    expect(loadServices(examplePath)).toEqual(defaultServices);
  });
});
