import { requireAdmin } from "@/server/admin-auth";
import { createServiceClient } from "../../../../lib/supabase/service";
import { setInstructorAccess } from "./actions";

export const dynamic = "force-dynamic";

type Member = { id: string; email: string; name: string; createdAt: string; confirmed: boolean; approved: boolean };
const messages: Record<string, string> = {
  approved: "강사 권한을 부여했습니다. 해당 강사는 로그인 후 면접관리 화면을 사용할 수 있습니다.",
  revoked: "강사 권한을 해제했습니다.", invalid: "가입 요청 정보를 확인해 주세요.",
  protected: "관리자 계정의 권한은 이 화면에서 변경할 수 없습니다.",
  unconfirmed: "이메일 확인을 마친 계정만 승인할 수 있습니다.",
  setup: "강사 권한을 부여하기 전에 Supabase에 instructor-hiring-migration.sql을 적용해 주세요.",
  error: "멤버 정보를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  await requireAdmin();
  const { result = "" } = await searchParams;
  const members: Member[] = [];
  let loadError = "";
  try {
    const service = createServiceClient();
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const user of data.users) {
        if (user.user_metadata.requested_role !== "instructor" && user.app_metadata.role !== "instructor") continue;
        members.push({ id: user.id, email: user.email ?? "", name: String(user.user_metadata.full_name ?? ""), createdAt: user.created_at, confirmed: !!user.email_confirmed_at, approved: user.app_metadata.role === "instructor" });
      }
      if (data.users.length < 200) break;
    }
  } catch {
    loadError = "멤버 목록을 불러오지 못했습니다. Supabase 서버 키와 Auth 권한을 확인해 주세요.";
  }
  members.sort((a, b) => Number(a.approved) - Number(b.approved) || b.createdAt.localeCompare(a.createdAt));
  return <div className="space-y-6"><header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8"><p className="text-xs font-bold tracking-[0.2em] text-indigo-300">MEMBER MANAGEMENT</p><h1 className="mt-3 text-3xl font-bold">강사 멤버 관리</h1><p className="mt-3 text-sm text-slate-200">강사 가입 요청을 확인하고 면접관리 접근 권한을 부여합니다. 강사는 영업관리와 멤버 관리에 접근할 수 없습니다.</p></header>
    {result && messages[result] && <p role={result === "approved" || result === "revoked" ? "status" : "alert"} className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800">{messages[result]}</p>}
    {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-xl font-bold">가입 요청과 승인된 강사 <span className="text-indigo-700">{members.length}</span></h2><p className="mt-1 text-sm text-slate-500">강사는 가입 페이지에서 신청하고 이메일 확인을 마친 뒤 승인할 수 있습니다.</p><div className="mt-5 space-y-3">{members.map((member) => <article key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><div className="flex flex-wrap items-center gap-2"><strong>{member.name || "이름 미입력"}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${member.approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{member.approved ? "강사 승인" : "승인 대기"}</span></div><p className="mt-1 text-sm text-slate-600">{member.email}</p><p className="mt-1 text-xs text-slate-500">{member.confirmed ? "이메일 확인 완료" : "이메일 확인 대기"}</p></div><form action={setInstructorAccess}><input type="hidden" name="id" value={member.id}/><input type="hidden" name="action" value={member.approved ? "revoke" : "approve"}/><button disabled={!member.approved && !member.confirmed} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${member.approved ? "border border-rose-200 text-rose-700" : "bg-indigo-600 text-white"}`}>{member.approved ? "권한 해제" : "강사 승인"}</button></form></article>)}</div>{!loadError && members.length === 0 && <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">아직 강사 가입 요청이 없습니다.</p>}</section>
  </div>;
}
