"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { organizationCategoryOptions, salesRegionOptions } from "../sales-organization-list";

type Filters = { query: string; category: string; region: string; contact: string };

export function SalesOrganizationFilters({ query, category, region, contact }: Filters) {
  const router = useRouter();
  const hasFilters = Boolean(query.trim() || category || region || contact.trim());
  const inputClass = "min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["category", "region", "q", "contact"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    router.push(params.size ? `/admin/sales?${params}` : "/admin/sales", { scroll: false });
  };
  return <form action="/admin/sales#organizations" onSubmit={apply} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(130px,1fr)_minmax(130px,1fr)_minmax(150px,1.2fr)_minmax(150px,1.2fr)_auto_auto] lg:items-end">
    <label className="grid gap-1 text-xs font-semibold text-slate-600">기관 유형<select name="category" defaultValue={category} className={inputClass}><option value="">전체 유형</option>{organizationCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">지역<select name="region" defaultValue={region} className={inputClass}><option value="">전체 지역</option>{salesRegionOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">기관명<input name="q" defaultValue={query} placeholder="기관명 검색" className={inputClass}/></label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">담당자<input name="contact" defaultValue={contact} placeholder="담당자 이름 검색" className={inputClass}/></label>
    <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">적용</button>
    {hasFilters && <button type="button" onClick={() => router.push("/admin/sales", { scroll: false })} className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700">초기화</button>}
  </form>;
}
