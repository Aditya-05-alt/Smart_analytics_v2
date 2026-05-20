/**
 * PostgREST table: public.smart_vdp_logic
 * All VDP Logics dashboard CRUD reads/writes this table only.
 */
export const SMART_VDP_LOGIC_TABLE = "smart_vdp_logic" as const;

/** Column list matches public.smart_vdp_logic (excludes serial id on insert). */
export const SMART_VDP_LOGIC_COLUMNS = [
  "id",
  "dealer_name",
  "dealer_id",
  "website_url",
  "cms",
  "data_source",
  "hoot_link",
  "scrap_link",
  "vdp_logic",
  "srp_logic",
  "home_page_logic",
  "others",
  "created_at",
  "updated_at",
] as const;

export const SMART_VDP_LOGIC_SELECT =
  SMART_VDP_LOGIC_COLUMNS.join(", ");
