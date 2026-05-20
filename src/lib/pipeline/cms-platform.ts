/** Stable React key / dedupe id for a bridged dealer row. */
export function dealerRowKey(d: {
  client_id: string;
  dealer_name: string;
}): string {
  return `${d.client_id.trim()}::${d.dealer_name.trim().toLowerCase()}`;
}

/** Display label when `smart_hoot_config.website_platform` is null or blank. */
export const CMS_UNKNOWN_LABEL = "CMS Unknown";

/** Single canonical CMS name for filters and table display (trimmed). */
export function formatCmsPlatform(platform: string | null | undefined): string {
  const trimmed = (platform ?? "").trim();
  return trimmed || CMS_UNKNOWN_LABEL;
}

/** Exact match for CMS filter (after formatting both sides). */
export function cmsPlatformsMatch(
  rowPlatform: string | null | undefined,
  selected: string,
): boolean {
  if (!selected) return true;
  return formatCmsPlatform(rowPlatform) === selected;
}

export function collectCmsPlatformOptions(
  dealers: { website_platform: string | null }[],
): string[] {
  const seen = new Set<string>();
  for (const d of dealers) {
    seen.add(formatCmsPlatform(d.website_platform));
  }
  return [...seen].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/** Normalize dealer rows so platform labels are consistent end-to-end. */
export function withCanonicalCmsPlatform<T extends { website_platform: string | null }>(
  dealers: T[],
): T[] {
  return dealers.map((d) => ({
    ...d,
    website_platform: formatCmsPlatform(d.website_platform),
  }));
}
