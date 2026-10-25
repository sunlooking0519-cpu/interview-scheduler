package kr.wiseedu.cardocrtest;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class CardFieldParser {
    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}");
    private static final Pattern NUMBER = Pattern.compile("(?<!\\d)0[1-9]\\d?\\)?[- .]*\\d{3,4}[- .]*(?:\\d{4}|\\d{2} \\d{2})(?!\\d)");
    private static final Pattern TITLE = Pattern.compile("대표이사|대표|위원장|의원|회장|부회장|이사장|이사|국장|실장|팀장|과장|부장|차장|대리|사원|주무관|교수|교사|원장|담당|매니저|Youth\\s+Worker|CEO|director|manager|professor|teacher", Pattern.CASE_INSENSITIVE);
    private static final Pattern ORGANIZATION = Pattern.compile("[가-힣][가-힣0-9·()\\s]{1,70}?(?:대학교|대학|학교|교육청|도서관|연구소|연구원|협회|재단|공단|공사|복지관|병원|시청|구청|군청|의회|추진단|센터|그룹|교육|주식회사|회사|법인)");
    private static final Pattern CITY = Pattern.compile("[가-힣]{2,6}(?:특별시|광역시|시|군|구)");
    private static final Pattern ENGLISH_ORGANIZATION = Pattern.compile("[A-Z][A-Z0-9& ]{2,50}\\b(?:GROUP|COMPANY|CORP|INC)\\b");
    private static final Pattern KOREAN_NAME = Pattern.compile("(?<![가-힣])[김이박최정강조윤장임한오서신권황안송류홍고문양손배백허유남심노하곽성차주](?:\\s?[가-힣]){1,3}(?![가-힣])");
    private static final Pattern NAME_ONLY = Pattern.compile("[김이박최정강조윤장임한오서신권황안송류홍고문양손배백허유남심노하곽성차주][가-힣]{1,3}");

    private CardFieldParser() {}

    static String mergeUniqueLines(String korean, String latin) {
        Set<String> seen = new LinkedHashSet<>();
        addLines(seen, korean);
        addLines(seen, latin);
        return String.join("\n", seen);
    }

    private static void addLines(Set<String> target, String text) {
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.replaceAll("\\s+", " ").trim();
            if (!line.isEmpty()) target.add(line);
        }
    }

    static Fields parse(String text) {
        List<String> lines = new ArrayList<>();
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.replaceAll("\\s+", " ").trim();
            if (!line.isEmpty()) lines.add(line);
        }
        Fields fields = new Fields();
        int bestOrganizationScore = Integer.MIN_VALUE;
        int bestNameScore = Integer.MIN_VALUE;
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (fields.email.isEmpty()) fields.email = findEmail(line);
            findNumbers(line, fields);
            if (fields.title.isEmpty()) {
                Matcher title = TITLE.matcher(line);
                if (title.find()) fields.title = title.group();
            }

            OrganizationCandidate organization = findOrganization(line, i);
            if (organization.score > bestOrganizationScore) {
                bestOrganizationScore = organization.score;
                fields.organization = organization.value;
            }
            NameCandidate name = findName(lines, i);
            if (name.score > bestNameScore) {
                bestNameScore = name.score;
                fields.name = name.value;
            }
        }
        return fields;
    }

    private static String findEmail(String line) {
        Matcher match = EMAIL.matcher(line);
        if (!match.find()) return "";
        String email = match.group();
        if (email.matches("(?i)^e\\.[\\w.+-]+@.+") && line.substring(0, match.start()).trim().isEmpty()) {
            return email.substring(2);
        }
        return email;
    }

    private static void findNumbers(String line, Fields fields) {
        String normalized = line.replaceAll("(?i)(?<![A-Za-z])o(?=\\d)", "0");
        Matcher match = NUMBER.matcher(normalized);
        int previousEnd = 0;
        while (match.find()) {
            String label = normalized.substring(previousEnd, match.start()).toLowerCase(Locale.ROOT);
            previousEnd = match.end();
            if (label.matches("(?s).*(?:fax|팩스|(?:^|\\s)f[.: ]).*$")) continue;
            String value = match.group().trim();
            String digits = value.replaceAll("\\D", "");
            if (digits.length() < 9 || digits.length() > 11) continue;
            if (digits.startsWith("01")) {
                if (fields.mobile.isEmpty()) fields.mobile = value;
            } else if (fields.phone.isEmpty()) {
                fields.phone = value;
            }
        }
    }

    private static OrganizationCandidate findOrganization(String rawLine, int index) {
        String line = rawLine.replaceFirst("^[가-힣]\\s+(?=[가-힣]{2,})", "")
            .replaceFirst("^[^가-힣A-Z]*(?=[가-힣A-Z])", "");
        int separator = line.indexOf(" x ");
        if (separator < 0) separator = line.indexOf(" × ");
        if (separator >= 0) line = line.substring(0, separator);
        OrganizationCandidate best = new OrganizationCandidate("", Integer.MIN_VALUE);
        Matcher match = ORGANIZATION.matcher(line);
        while (match.find()) {
            String value = match.group().trim();
            if (value.matches(".*(?:교육과|교육팀|교육위원회|위원회|유치원|어린이집)$")) continue;
            int score = 60;
            if (value.endsWith("의회") || value.endsWith("추진단") || value.endsWith("센터")) score = 90;
            else if (value.endsWith("도서관") || value.endsWith("학교")) score = 85;
            if (line.matches(".*(?:주\\)|㈜|주식회사).*")) score += 25;
            if (value.contains(" ")) score += 2;
            if (index < 3) score += 5;
            if (score > best.score) best = new OrganizationCandidate(value, score);
        }
        Matcher english = ENGLISH_ORGANIZATION.matcher(line);
        if (english.find() && best.score < 70) best = new OrganizationCandidate(english.group().trim(), 70);
        Matcher city = CITY.matcher(line);
        if (index < 3 && !line.matches(".*\\d.*") && city.find() && best.score < 65) {
            best = new OrganizationCandidate(city.group(), 65);
        }
        if (best.score < 50 && line.matches(".*[가-힣]\\s+코리아.*")) {
            best = new OrganizationCandidate(line.trim(), 50);
        }
        return best;
    }

    private static NameCandidate findName(List<String> lines, int index) {
        String line = lines.get(index);
        boolean hasTitle = TITLE.matcher(line).find();
        String withoutTitle = TITLE.matcher(line).replaceAll(" ");
        boolean organizationLike = ORGANIZATION.matcher(line).find()
            || line.matches(".*(?:어린이집|유치원|교육과|교육팀|위원회|광역시|특별시|진로체험|연구소|코리아|GROUP).*")
            || line.matches(".*\\d.*");
        NameCandidate best = new NameCandidate("", Integer.MIN_VALUE);
        Matcher match = KOREAN_NAME.matcher(withoutTitle);
        while (match.find()) {
            String candidate = match.group().replace(" ", "");
            if (!NAME_ONLY.matcher(candidate).matches() || candidate.equals("주무관")) continue;
            int score = hasTitle ? 100 : 45;
            if (line.matches(".*[|_].*") && !organizationLike) score += 15;
            if (line.replaceAll("[^가-힣]", "").equals(candidate)) score += 15;
            if (index > 0 && TITLE.matcher(lines.get(index - 1)).find()) score += 35;
            if (organizationLike) score -= 90;
            if (score > best.score) best = new NameCandidate(candidate, score);
        }
        if (hasTitle) {
            StringBuilder separated = new StringBuilder();
            for (int next = index + 1; next < Math.min(lines.size(), index + 7); next++) {
                String word = lines.get(next);
                if (word.matches("[가-힣]")) separated.append(word);
                if (separated.length() == 3) break;
            }
            String candidate = separated.toString();
            if (NAME_ONLY.matcher(candidate).matches() && best.score < 95) {
                best = new NameCandidate(candidate, 95);
            }
        }
        return best;
    }

    private static final class OrganizationCandidate {
        final String value;
        final int score;

        OrganizationCandidate(String value, int score) {
            this.value = value;
            this.score = score;
        }
    }

    private static final class NameCandidate {
        final String value;
        final int score;

        NameCandidate(String value, int score) {
            this.value = value;
            this.score = score;
        }
    }

    static final class Fields {
        String organization = "";
        String name = "";
        String title = "";
        String phone = "";
        String mobile = "";
        String email = "";
    }
}
