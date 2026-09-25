import { describe, expect, it } from "vitest";
import { defaultServices } from "../src/config/services";
import { icons } from "../src/lib/icons";

/**
 * Expected registry shape: the 5 original icons first, in their original
 * order, followed by the 32 expanded icons grouped by section.
 */
const EXPECTED_KEYS = [
  // Original five.
  "deck",
  "paste",
  "blueprint",
  "qrcode",
  "activity",
  // Deployed services.
  "regex",
  "tools",
  "palette",
  "svg",
  "fish",
  "gamepad",
  // Developer tools.
  "terminal",
  "code",
  "git",
  "wiki",
  "note",
  // Media & content.
  "chat",
  "mail",
  "rss",
  "calendar",
  "music",
  "photo",
  "film",
  // Infrastructure.
  "server",
  "database",
  "container",
  "cloud",
  "download",
  "key",
  "shield",
  // General.
  "folder",
  "chart",
  "home",
  "search",
  "link",
  "bell",
  "clock",
];

/** Attributes every icon's svg root must carry, verbatim. */
const REQUIRED_ATTRS = [
  'viewBox="0 0 24 24"',
  'fill="none"',
  'stroke="currentColor"',
  'stroke-width="1.6"',
  'stroke-linecap="round"',
  'stroke-linejoin="round"',
];

describe("icon registry: keys", () => {
  it("has exactly the expected keys, original icons first", () => {
    expect(Object.keys(icons), "icon registry keys").toEqual(EXPECTED_KEYS);
  });

  it("has kebab-case keys", () => {
    for (const [name] of Object.entries(icons)) {
      expect(name, `key "${name}" in the icon registry`).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});

describe("icon registry: values", () => {
  it("every value is a non-empty <svg>...</svg> string", () => {
    for (const [name, svg] of Object.entries(icons)) {
      expect(svg.trim(), `icon "${name}"`).toMatch(/^<svg[\s\S]*<\/svg>$/);
    }
  });

  it("every svg root carries the shared 24x24 stroke attributes", () => {
    for (const [name, svg] of Object.entries(icons)) {
      for (const attr of REQUIRED_ATTRS) {
        expect(svg.includes(attr), `icon "${name}" contains ${attr}`).toBe(true);
      }
    }
  });

  it("never uses inline styles, scripts, event handlers, or hardcoded colors", () => {
    for (const [name, svg] of Object.entries(icons)) {
      expect(svg, `icon "${name}" must not use style=`).not.toMatch(/style\s*=/i);
      expect(svg, `icon "${name}" must not embed scripts`).not.toMatch(/<script/i);
      expect(svg, `icon "${name}" must not use on* event handlers`).not.toMatch(/\son[a-z]+\s*=/i);
      expect(svg, `icon "${name}" must not hardcode colors`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it('never uses a fill attribute other than exactly fill="none"', () => {
    for (const [name, svg] of Object.entries(icons)) {
      const fills = svg.match(/fill\s*=\s*("[^"]*"|'[^']*')/gi) ?? [];
      expect(fills.length, `icon "${name}" has no fill attribute at all`).toBeGreaterThan(0);
      for (const fill of fills) {
        expect(
          fill.replace(/\s+/g, ""),
          `icon "${name}" fill must be exactly fill="none"`,
        ).toBe('fill="none"');
      }
    }
  });

  it("has balanced tags in every value", () => {
    for (const [name, svg] of Object.entries(icons)) {
      const opening = (svg.match(/<[a-z]/gi) ?? []).length;
      const closing = (svg.match(/<\//g) ?? []).length;
      const selfClosing = (svg.match(/\/>/g) ?? []).length;
      expect(
        opening,
        `icon "${name}": ${opening} opening tags vs ${closing} closings + ${selfClosing} self-closings`,
      ).toBe(closing + selfClosing);
    }
  });
});

describe("icon registry: service wiring", () => {
  it("every icon used by defaultServices resolves to a defined non-empty value", () => {
    expect(defaultServices.length).toBeGreaterThan(0);
    for (const service of defaultServices) {
      expect(icons[service.icon], `icon "${service.icon}" of ${service.id}`).toBeTruthy();
    }
  });
});
