const rows = [
  ["샘플 지원자 A", "프론트엔드 개발", "10.12 · 10:00", "확정"],
  ["샘플 지원자 B", "프로덕트 디자인", "10.13 · 14:00", "확정"],
  ["샘플 지원자 C", "백엔드 개발", "일정 선택 전", "대기"],
];

export function BookingTable() {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full whitespace-nowrap text-left text-sm"><caption className="p-6 text-left text-lg font-bold">지원자 예약 현황 <span className="text-xs font-normal text-slate-500">· 예시 데이터</span></caption><thead className="border-y border-slate-100 bg-slate-50 text-slate-500"><tr>{["지원자", "지원 직무", "면접 일정 (2026년 / KST)", "상태"].map(label => <th scope="col" key={label} className="px-6 py-4 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[0]} className="border-b border-slate-100 last:border-0">{row.map((cell, index) => <td key={index} className="px-6 py-5">{index === 3 ? <span className={`rounded-full px-3 py-1 text-xs ${cell === "확정" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div>;
}
