package kr.wiseedu.cardocrtest;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.google.android.gms.tasks.Task;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;

public final class MainActivity extends ComponentActivity {
    private final ActivityResultLauncher<IntentSenderRequest> scannerLauncher = registerForActivityResult(
        new ActivityResultContracts.StartIntentSenderForResult(),
        result -> handleScanResult(result.getResultCode(), result.getData())
    );

    private final TextRecognizer koreanRecognizer = TextRecognition.getClient(
        new KoreanTextRecognizerOptions.Builder().build()
    );
    private final TextRecognizer latinRecognizer = TextRecognition.getClient(
        TextRecognizerOptions.DEFAULT_OPTIONS
    );

    private ImageView preview;
    private TextView status;
    private TextView koreanText;
    private TextView latinText;
    private TextView mergedText;
    private EditText organizationInput;
    private EditText nameInput;
    private EditText titleInput;
    private EditText phoneInput;
    private EditText mobileInput;
    private EditText emailInput;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        preview = findViewById(R.id.cardPreview);
        status = findViewById(R.id.statusText);
        koreanText = findViewById(R.id.koreanText);
        latinText = findViewById(R.id.latinText);
        mergedText = findViewById(R.id.mergedText);
        organizationInput = findViewById(R.id.organizationInput);
        nameInput = findViewById(R.id.nameInput);
        titleInput = findViewById(R.id.titleInput);
        phoneInput = findViewById(R.id.phoneInput);
        mobileInput = findViewById(R.id.mobileInput);
        emailInput = findViewById(R.id.emailInput);

        findViewById(R.id.scanButton).setOnClickListener(view -> startScan());
        findViewById(R.id.copyButton).setOnClickListener(view -> copyResult());
        findViewById(R.id.shareButton).setOnClickListener(view -> shareResult());
    }

    private void startScan() {
        status.setText(R.string.status_preparing);
        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(1)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build();
        GmsDocumentScanner scanner = GmsDocumentScanning.getClient(options);
        scanner.getStartScanIntent(this)
            .addOnSuccessListener(this::launchScanner)
            .addOnFailureListener(error -> status.setText(R.string.status_scanner_error));
    }

    private void launchScanner(android.content.IntentSender intentSender) {
        scannerLauncher.launch(new IntentSenderRequest.Builder(intentSender).build());
    }

    private void handleScanResult(int resultCode, Intent data) {
        if (resultCode != RESULT_OK || data == null) {
            status.setText(R.string.status_cancelled);
            return;
        }
        GmsDocumentScanningResult result = GmsDocumentScanningResult.fromActivityResultIntent(data);
        if (result == null || result.getPages() == null || result.getPages().isEmpty()) {
            status.setText(R.string.status_no_image);
            return;
        }
        Uri imageUri = result.getPages().get(0).getImageUri();
        preview.setImageURI(imageUri);
        recognize(imageUri);
    }

    private void recognize(Uri uri) {
        status.setText(R.string.status_recognizing);
        setButtonsEnabled(false);
        long startedAt = SystemClock.elapsedRealtime();
        String[] results = {"", ""};
        String[] errors = {"", ""};
        AtomicInteger remaining = new AtomicInteger(2);
        final InputImage image;
        try {
            image = InputImage.fromFilePath(this, uri);
        } catch (IOException error) {
            status.setText(R.string.status_image_error);
            setButtonsEnabled(true);
            return;
        }

        finishTask(koreanRecognizer.process(image), 0, results, errors, remaining, startedAt);
        finishTask(latinRecognizer.process(image), 1, results, errors, remaining, startedAt);
    }

    private void finishTask(Task<Text> task, int index, String[] results, String[] errors, AtomicInteger remaining, long startedAt) {
        task.addOnCompleteListener(completed -> {
            if (completed.isSuccessful() && completed.getResult() != null) {
                results[index] = completed.getResult().getText().trim();
            } else {
                errors[index] = completed.getException() == null ? getString(R.string.unknown_error) : String.valueOf(completed.getException().getMessage());
            }
            if (remaining.decrementAndGet() == 0) showResults(results, errors, startedAt);
        });
    }

    private void showResults(String[] results, String[] errors, long startedAt) {
        koreanText.setText(results[0].isEmpty() ? getString(R.string.no_result) : results[0]);
        latinText.setText(results[1].isEmpty() ? getString(R.string.no_result) : results[1]);
        String merged = CardFieldParser.mergeUniqueLines(results[0], results[1]);
        mergedText.setText(merged.isEmpty() ? getString(R.string.no_result) : merged);
        applyFields(CardFieldParser.parse(merged));
        long elapsed = SystemClock.elapsedRealtime() - startedAt;
        if (merged.isEmpty()) {
            status.setText(R.string.status_no_text);
        } else if (!errors[0].isEmpty() || !errors[1].isEmpty()) {
            status.setText(getString(R.string.status_partial, elapsed));
        } else {
            status.setText(getString(R.string.status_complete, elapsed));
        }
        setButtonsEnabled(true);
    }

    private void applyFields(CardFieldParser.Fields fields) {
        organizationInput.setText(fields.organization);
        nameInput.setText(fields.name);
        titleInput.setText(fields.title);
        phoneInput.setText(fields.phone);
        mobileInput.setText(fields.mobile);
        emailInput.setText(fields.email);
    }

    private String resultText() {
        return "기관: " + organizationInput.getText() + "\n"
            + "이름: " + nameInput.getText() + "\n"
            + "직책: " + titleInput.getText() + "\n"
            + "전화: " + phoneInput.getText() + "\n"
            + "휴대폰: " + mobileInput.getText() + "\n"
            + "이메일: " + emailInput.getText() + "\n\n"
            + "[통합 OCR]\n" + mergedText.getText() + "\n\n"
            + "[한국어 모델]\n" + koreanText.getText() + "\n\n"
            + "[영문 모델]\n" + latinText.getText();
    }

    private void copyResult() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.clipboard_label), resultText()));
        Toast.makeText(this, R.string.copied_message, Toast.LENGTH_SHORT).show();
    }

    private void shareResult() {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_SUBJECT, getString(R.string.share_subject));
        intent.putExtra(Intent.EXTRA_TEXT, resultText());
        startActivity(Intent.createChooser(intent, getString(R.string.share_chooser)));
    }

    private void setButtonsEnabled(boolean enabled) {
        Button scanButton = findViewById(R.id.scanButton);
        scanButton.setEnabled(enabled);
        findViewById(R.id.copyButton).setEnabled(enabled);
        findViewById(R.id.shareButton).setEnabled(enabled);
    }

    @Override
    protected void onDestroy() {
        koreanRecognizer.close();
        latinRecognizer.close();
        super.onDestroy();
    }
}
