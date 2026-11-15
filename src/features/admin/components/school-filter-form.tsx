"use client";

import { useState } from "react";
import { schoolLevels, schoolProvinces, type SchoolFilters } from "@/features/admin/school-filters";
import type { SchoolAssignee } from "./school-table";

export function SchoolFilterForm({ filters, locations, assignees, admin, currentUserId }: {
  filters: SchoolFilters; locations: { province: string; district: string }[];
  assignees: SchoolAssignee[]; admin: boolean; currentUserId: string;
}) {
  const [province, setProvince] = useState(filters.province);
  const [district, setDistrict] = useState(filters.district);
  const districts = [...new Set(locations.filter((item) => !province || item.province === province).map((item) => item.district))]
    .sort((a, b) => a.localeCompare(b, "ko"));
  return <form method="get" action="/admin/schools#school-list" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <label className="text-sm font-medium text-slate-700">광역지역<select name="province" value={province} onChange={(event) => { setProvince(event.target.value); setDistrict(""); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="">전체</option>{schoolProvinces.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="text-sm font-medium text-slate-700">지역<select name="district" value={district} onChange={(event) => setDistrict(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="">전체</option>{districts.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    <label className="text-sm font-medium text-slate-700">학교급<select name="level" defaultValue={filters.level} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="">전체</option>{schoolLevels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
    {admin && <label className="text-sm font-medium text-slate-700">배정 상태<select name="assignment" defaultValue={filters.assignment} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3"><option value="">전체</option><option value="unassigned">미배정</option><option value="mine">내 담당</option>{assignees.filter((person) => person.id !== currentUserId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
    <label className="text-sm font-medium text-slate-700">학교명 검색<input name="q" defaultValue={filters.q} placeholder="학교명 입력" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3" /></label>
    <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white xl:col-start-5">적용</button>
  </form>;
}
