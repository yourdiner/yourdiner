export const SOCIAL_LINK_KEYS = [
  "instagram",
  "facebook",
  "twitter",
  "whatsapp",
  "youtube",
  "website",
] as const;

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number];

export const SOCIAL_LINK_LABELS: Record<SocialLinkKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  website: "Website",
};

export function parseSocialLinks(raw: unknown): Record<SocialLinkKey, string> {
  const empty = Object.fromEntries(SOCIAL_LINK_KEYS.map((k) => [k, ""])) as Record<
    SocialLinkKey,
    string
  >;
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  for (const key of SOCIAL_LINK_KEYS) {
    const val = o[key];
    if (typeof val === "string") empty[key] = val;
  }
  return empty;
}

export function socialLinksToPayload(
  links: Partial<Record<SocialLinkKey, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of SOCIAL_LINK_KEYS) {
    const val = links[key]?.trim();
    if (val) out[key] = val;
  }
  return out;
}

export function hasSocialLinks(links: Record<string, string>): boolean {
  return Object.values(links).some((v) => v.trim().length > 0);
}
