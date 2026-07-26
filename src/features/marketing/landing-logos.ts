/**
 * Restaurant logos for the homepage marquee.
 * Add entries with `src` pointing to files in /public (e.g. /logos/cafe-name.svg).
 * Until src is set, the name is shown as a text placeholder.
 */
export type LandingLogo = {
  id: string;
  name: string;
  /** Path under /public, e.g. "/logos/nova.svg" */
  src?: string;
};

export const LANDING_LOGOS: LandingLogo[] = [
  { id: "logo-1", name: "Partner Cafe" },
  { id: "logo-2", name: "Partner Bistro" },
  { id: "logo-3", name: "Partner Kitchen" },
  { id: "logo-4", name: "Partner House" },
  { id: "logo-5", name: "Partner Grill" },
  { id: "logo-6", name: "Partner Bar" },
  { id: "logo-7", name: "Partner Diner" },
  { id: "logo-8", name: "Partner Lounge" },
];
