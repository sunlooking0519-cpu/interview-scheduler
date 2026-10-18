export type SalesCardFields = { name: string; organization: string; title: string; phone: string; mobile: string; email: string };
export type SalesKind = "institution" | "school" | "other";

const schoolPattern = /학교|대학|학원|교육청|university|college|school|academy/i;
const institutionPattern = /기관|센터|연구소|연구원|협회|재단|공단|공사|복지관|병원|시청|구청|군청|관공서|의회|추진단|institute|foundation|center|association|hospital/i;
const koreanOrganizationPattern = /(?:\(주\)|㈜\s*)?[가-힣][가-힣0-9·()\s]{1,70}?(?:대학교|대학|학교|교육청|연구소|연구원|협회|재단|공단|공사|복지관|병원|시청|구청|군청|의회|추진단|센터|그룹|교육|주식회사|회사|법인)/;
const englishOrganizationPattern = /[A-Za-z][A-Za-z0-9&.'-]*(?:\s+[A-Za-z][A-Za-z0-9&.'-]*){0,5}\s+(?:group|corp(?:oration)?|company|inc\.?|ltd\.?|university|college|school|academy|institute|foundation|center|association|hospital)\b/i;
const titlePattern = /대표이사|대표|위원장|회장|부회장|이사장|이사|국장|실장|팀장|과장|부장|차장|대리|사원|교수|교사|원장|담당|매니저|CEO|director|manager|professor|teacher/i;
const contactNumberPattern = /(?<!\d)(?:(?:\+82[- .]?(?:1[016789]|2|[3-9]\d))|(?:0(?:1[016789]|2|[3-9]\d)))[- .]?\d{3,4}[- .]?\d{4}(?!\d)/g;
const contactLabelPattern = /(?:^|[\s|,])(?:Tel(?:ephone)?|T|Phone|대표전화|전화(?:번호)?|Mobile|Mob|M|H\.?P|Cell|휴대폰|핸드폰|Fax|Facsimile|F|팩스)\s*[:.]?/gi;
const emailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const namePattern = /(?:^|[^가-힣A-Za-z])([가-힣](?:\s*[가-힣]){2,3})(?=$|[^가-힣A-Za-z])/g;
const departmentEnding = /(?:처|팀|과|실|부|국|원|단)$/;
// Short Korean words on a card are often slogans or departments, not people's names.
// A conservative surname check leaves uncertain OCR results for the administrator to review.
const commonSurname = /^[김이박최정강조윤장임한오서신권황안송류홍고문양손배백허유남심노하곽성차주]/;
const nonPersonEnding = /(?:위원회|사업|교육|인증|혁명|추진단|연구소|대학교|학교|기관|센터)$/;

export function plausibleKoreanName(value: string) {
  const compact = value.replace(/\s/g, "");
  return /^[가-힣]{2,4}$/.test(compact) && commonSurname.test(compact) &&
    !nonPersonEnding.test(compact) && !titlePattern.test(compact) && !departmentEnding.test(compact);
}

function linesOf(text: string) {
  return text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function findOrganization(lines: string[]) {
  for (const line of lines) {
    const korean = line.match(koreanOrganizationPattern)?.[0]?.trim();
    if (korean) return korean;
    const english = line.match(englishOrganizationPattern)?.[0]?.trim();
    if (english) return english;
  }
  // A slogan or a noisy OCR line is not enough evidence for an organization name.
  return "";
}

function findName(lines: string[], organization: string) {
  const usable = lines.filter((line) =>
    line.length <= 36 && !line.includes("@") && ![...line.matchAll(contactNumberPattern)].length &&
    !koreanOrganizationPattern.test(line) && !englishOrganizationPattern.test(line) &&
    !(organization && line.includes(organization))
  );

  // A standalone name is safer than a three-syllable fragment of a slogan.
  for (const line of usable) {
    if (/^[가-힣](?:\s*[가-힣]){2,3}$/.test(line)) {
      const candidate = line.replace(/\s/g, "");
      if (plausibleKoreanName(candidate)) return candidate;
    }
  }

  // On mixed lines, require an adjacent job title before suggesting a name.
  for (const line of usable) {
    if (!titlePattern.test(line)) continue;
    const personText = line.replace(titlePattern, " ");
    for (const match of personText.matchAll(namePattern)) {
      const candidate = match[1].replace(/\s/g, "");
      if (plausibleKoreanName(candidate)) return candidate;
    }
  }
  return "";
}

function numberKind(number: string): "phone" | "mobile" {
  const digits = number.replace(/\D/g, "");
  return /^(?:01[016789]|821[016789])/.test(digits) ? "mobile" : "phone";
}

function labelKind(label: string): "phone" | "mobile" | "fax" {
  const normalized = label.replace(/[\s.:,|]/g, "").toLowerCase();
  if (/^(?:fax|facsimile|f|팩스)$/.test(normalized)) return "fax";
  if (/^(?:mobile|mob|m|hp|cell|휴대폰|핸드폰)$/.test(normalized)) return "mobile";
  return "phone";
}

function findContactNumbers(lines: string[]) {
  const labelled: { phone: string; mobile: string } = { phone: "", mobile: "" };
  const unlabelled: { phone: string; mobile: string } = { phone: "", mobile: "" };
  for (const line of lines) {
    const labels = [...line.matchAll(contactLabelPattern)].map((match) => ({
      index: match.index ?? 0,
      kind: labelKind(match[0]),
    }));
    for (const match of line.matchAll(contactNumberPattern)) {
      const index = match.index ?? 0;
      const label = labels.filter((item) => item.index < index).at(-1);
      if (label?.kind === "fax") continue;
      const kind = label?.kind ?? numberKind(match[0]);
      const target = label ? labelled : unlabelled;
      if (!target[kind]) target[kind] = match[0];
    }
  }
  return { phone: labelled.phone || unlabelled.phone, mobile: labelled.mobile || unlabelled.mobile };
}

export function classifySalesCard(organization: string): SalesKind {
  if (schoolPattern.test(organization)) return "school";
  if (institutionPattern.test(organization)) return "institution";
  return "other";
}

export function guessSalesCardFields(text: string, identityText = ""): SalesCardFields {
  const lines = linesOf(text);
  const identityLines = linesOf(identityText);
  const organization = findOrganization(lines) || findOrganization(identityLines);
  const title = [...lines, ...identityLines].map((line) => line.match(titlePattern)?.[0]).find(Boolean) ?? "";
  const numbers = findContactNumbers(lines);
  return {
    name: findName(lines, organization) || findName(identityLines, organization),
    organization,
    title,
    phone: numbers.phone,
    mobile: numbers.mobile,
    email: text.match(emailPattern)?.[0] ?? "",
  };
}
