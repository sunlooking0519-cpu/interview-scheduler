export type SalesCardFields = { name: string; organization: string; title: string; phone: string; email: string };
export type SalesKind = "institution" | "school" | "other";

const schoolPattern = /학교|대학|학원|교육청|university|college|school|academy/i;
const institutionPattern = /기관|센터|연구소|연구원|협회|재단|공단|공사|복지관|병원|시청|구청|군청|관공서|institute|foundation|center|association|hospital/i;
const organizationPattern = /학교|대학|학원|교육청|기관|센터|연구소|연구원|협회|재단|공단|공사|복지관|병원|시청|구청|군청|회사|기업|주식회사|㈜|\(주\)|법인|university|college|school|academy|institute|foundation|center|association|hospital|corp|company|inc\.?|ltd\.?/i;
const titlePattern = /대표|이사|실장|팀장|과장|부장|차장|대리|사원|교수|교사|원장|담당|매니저|director|manager|professor|teacher/i;
const phonePattern = /(?:\+?82[- .]?)?0\d{1,2}[- .]?\d{3,4}[- .]?\d{4}/;
const emailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;

export function classifySalesCard(organization: string): SalesKind {
  if (schoolPattern.test(organization)) return "school";
  if (institutionPattern.test(organization)) return "institution";
  return "other";
}

export function guessSalesCardFields(text: string): SalesCardFields {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const candidates = lines.filter((line) => !emailPattern.test(line) && !phonePattern.test(line) && line.length <= 100);
  const organization = candidates.find((line) => organizationPattern.test(line)) ?? candidates.find((line) => line.length >= 5 && !titlePattern.test(line)) ?? "";
  const personLine = candidates.find((line) => line !== organization && /^[가-힣]{2,4}(?:\s+(?:[가-힣]{2,4}|[A-Za-z.]+)){0,2}$/.test(line) && !titlePattern.test(line));
  const titleLine = candidates.find((line) => line !== organization && titlePattern.test(line));
  const name = personLine ?? "";
  return {
    name,
    organization,
    title: titleLine?.replace(name, "").trim() ?? "",
    phone: text.match(phonePattern)?.[0] ?? "",
    email: text.match(emailPattern)?.[0] ?? "",
  };
}
