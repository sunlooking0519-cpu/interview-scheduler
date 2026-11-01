export type HiredCandidate = { id: string | number; name: string; phone: string; email: string | null; hired_at: string | null };

export function matchingHiredCandidate(candidates: HiredCandidate[], name: string, phone: string, email: string) {
  const digits = (value: string) => value.replace(/\D/g, "");
  const matches = candidates.filter((candidate) => candidate.hired_at && candidate.name.trim() === name && digits(candidate.phone) === digits(phone) && (!candidate.email || candidate.email.trim().toLowerCase() === email));
  return matches.length === 1 ? matches[0] : null;
}
