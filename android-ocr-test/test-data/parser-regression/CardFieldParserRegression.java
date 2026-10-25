package kr.wiseedu.cardocrtest;

import java.nio.file.Files;
import java.nio.file.Path;

public final class CardFieldParserRegression {
    public static void main(String[] args) throws Exception {
        Path results = Path.of(args[0]);
        CardFieldParser.Fields card = CardFieldParser.parse(Files.readString(results.resolve("retest-card-03.txt")));
        require("010.7396.1676".equals(card.mobile), "Split mobile digits were not joined: " + card.mobile);
        require("061.659.5218".equals(card.phone), "Tel/Fax separation regressed: " + card.phone);
        CardFieldParser.Fields handwriting = CardFieldParser.parse(Files.readString(results.resolve("retest-handwriting-01.txt")));
        require("062- 601-2521".equals(handwriting.phone), "Handwritten phone was lost: " + handwriting.phone);
        require(handwriting.email.isEmpty(), "An absent handwritten email must not be invented");
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
