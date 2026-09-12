import type { Service } from "./validate";

/**
 * The service registry — the single source of truth for the portal homepage.
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
export const services: Service[] = [
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
