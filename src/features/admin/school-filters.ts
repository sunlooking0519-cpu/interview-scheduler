export type SchoolFilters = {
  province: string; district: string; level: string; assignment: string; q: string;
};

export const schoolPageSize = 25;
export const schoolLevels = ["초등학교", "중학교", "고등학교"] as const;
export const schoolProvinces = ["광주광역시", "전라남도", "전북특별자치도"] as const;
export const schoolUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanSchoolFilters(input: Partial<SchoolFilters>): SchoolFilters {
  return {
    province: schoolProvinces.includes(input.province as (typeof schoolProvinces)[number]) ? input.province! : "",
    district: String(input.district ?? "").trim().slice(0, 80),
    level: schoolLevels.includes(input.level as (typeof schoolLevels)[number]) ? input.level! : "",
    assignment: String(input.assignment ?? "").trim().slice(0, 80),
    q: String(input.q ?? "").trim().slice(0, 100),
  };
}

export function schoolFiltersHref(filters: SchoolFilters, page = 1) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  return `/admin/schools${params.size ? `?${params}` : ""}`;
}
