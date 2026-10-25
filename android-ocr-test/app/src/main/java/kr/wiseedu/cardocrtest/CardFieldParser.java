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
    private static final Pattern NUMBER = Pattern.compile("(?<!\\d)(?:(?:\\+82[- .]?(?:1[016789]|2|[3-9]\\d))|(?:0(?:1[016789]|2|[3-9]\\d)))[- .]?\\d{3,4}[- .]?\\d{4}(?!\\d)");
    private static final Pattern TITLE = Pattern.compile("대표이사|대표|위원장|회장|부회장|이사장|이사|국장|실장|팀장|과장|부장|차장|대리|사원|교수|교사|원장|담당|매니저|CEO|director|manager|professor|teacher", Pattern.CASE_INSENSITIVE);
    private static final Pattern ORGANIZATION = Pattern.compile("(?:\\(주\\)|㈜\\s*)?[가-힣][가-힣0-9·()\\s]{1,70}?(?:대학교|대학|학교|교육청|도서관|연구소|연구원|협회|재단|공단|공사|복지관|병원|시청|구청|군청|의회|추진단|센터|그룹|교육|주식회사|회사|법인)");
    private static final Pattern KOREAN_NAME = Pattern.compile("^[김이박최정강조윤장임한오서신권황안송류홍고문양손배백허유남심노하곽성차주][가-힣]{1,3}$");

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
        Matcher email = EMAIL.matcher(text);
        if (email.find()) fields.email = email.group();

        for (String line : lines) {
            Matcher number = NUMBER.matcher(line);
            while (number.find()) {
                String value = number.group();
                String digits = value.replaceAll("\\D", "");
                boolean mobile = digits.startsWith("01") || digits.startsWith("821");
                String before = line.substring(0, number.start()).toLowerCase(Locale.ROOT);
                if (before.matches(".*(?:fax|facsimile|팩스|\\bf[.: ]).*$")) continue;
                if (mobile && fields.mobile.isEmpty()) fields.mobile = value;
                if (!mobile && fields.phone.isEmpty()) fields.phone = value;
            }
            if (fields.organization.isEmpty()) {
                Matcher organization = ORGANIZATION.matcher(line);
                if (organization.find()) fields.organization = organization.group().trim();
            }
            if (fields.title.isEmpty()) {
                Matcher title = TITLE.matcher(line);
                if (title.find()) fields.title = title.group();
            }
        }

        for (String line : lines) {
            String withoutTitle = TITLE.matcher(line).replaceAll(" ");
            for (String token : withoutTitle.split("[^가-힣]+")) {
                if (KOREAN_NAME.matcher(token).matches()) {
                    fields.name = token;
                    break;
                }
            }
            if (!fields.name.isEmpty()) break;
        }
        return fields;
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
