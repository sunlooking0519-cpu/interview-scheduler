package kr.wiseedu.cardocrtest;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.Button;
import android.widget.ArrayAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;

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
import java.io.InputStream;
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
    private TextView saveStatus;
    private TextView accountStatus;
    private LinearLayout loginPanel;
    private EditText organizationInput;
    private EditText nameInput;
    private EditText titleInput;
    private EditText phoneInput;
    private EditText mobileInput;
    private EditText emailInput;
    private Uri scannedImage;
    private MobileApi mobileApi;
    private boolean busy;
    private boolean accountChecking = true;
    private UpdateManager updateManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        preview = findViewById(R.id.cardPreview);
        status = findViewById(R.id.statusText);
        koreanText = findViewById(R.id.koreanText);
        latinText = findViewById(R.id.latinText);
        mergedText = findViewById(R.id.mergedText);
        saveStatus = findViewById(R.id.saveStatusText);
        organizationInput = findViewById(R.id.organizationInput);
        nameInput = findViewById(R.id.nameInput);
        titleInput = findViewById(R.id.titleInput);
        phoneInput = findViewById(R.id.phoneInput);
        mobileInput = findViewById(R.id.mobileInput);
        emailInput = findViewById(R.id.emailInput);
        accountStatus = findViewById(R.id.accountStatusText);
        loginPanel = findViewById(R.id.loginPanel);
        mobileApi = new MobileApi(this);

        findViewById(R.id.scanButton).setOnClickListener(view -> startScan());
        findViewById(R.id.loginButton).setOnClickListener(view -> login());
        findViewById(R.id.retryAccountButton).setOnClickListener(view -> retryAccount());
        findViewById(R.id.logoutButton).setOnClickListener(view -> logout());
        findViewById(R.id.saveButton).setOnClickListener(view -> saveCard());
        findViewById(R.id.webListButton).setOnClickListener(view -> startActivity(
            new Intent(Intent.ACTION_VIEW, Uri.parse(MobileApi.SITE + "/admin/sales/cards"))));
        findViewById(R.id.retryRegionButton).setOnClickListener(view -> retryRegion());
        setButtonsEnabled(true);
        mobileApi.restore(error -> {
            accountChecking = false;
            showAccountState();
            if (!error.isEmpty()) status.setText(error);
            setButtonsEnabled(true);
        });
        updateManager = new UpdateManager(this, findViewById(R.id.updateStatusText));
        findViewById(R.id.checkUpdateButton).setOnClickListener(view -> updateManager.check());
        updateManager.check();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (updateManager != null) updateManager.continueInstallation();
    }

    private void startScan() {
        status.setText(R.string.status_preparing);
        showSaveMessage(getString(R.string.save_ready), false);
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
        scannedImage = imageUri;
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

    private void login() {
        String email = ((EditText) findViewById(R.id.loginEmailInput)).getText().toString().trim();
        String password = ((EditText) findViewById(R.id.loginPasswordInput)).getText().toString();
        if (email.isEmpty() || password.isEmpty()) { status.setText(R.string.login_required); return; }
        busy = true;
        setButtonsEnabled(false);
        status.setText(R.string.login_working);
        mobileApi.login(email, password, error -> {
            busy = false;
            ((EditText) findViewById(R.id.loginPasswordInput)).setText("");
            status.setText(error.isEmpty() ? getString(R.string.login_complete) : error);
            showAccountState();
            setButtonsEnabled(true);
        });
    }

    private void retryAccount() {
        busy = true;
        accountChecking = true;
        accountStatus.setText(R.string.login_restoring);
        setButtonsEnabled(false);
        mobileApi.restore(error -> {
            busy = false;
            accountChecking = false;
            showAccountState();
            if (!error.isEmpty()) status.setText(error);
            setButtonsEnabled(true);
        });
    }

    private void logout() {
        busy = true;
        setButtonsEnabled(false);
        mobileApi.logout(error -> {
            busy = false;
            status.setText(error.isEmpty() ? getString(R.string.logout_complete)
                : getString(R.string.logout_complete) + " " + error);
            showAccountState();
            setButtonsEnabled(true);
        });
    }

    private void showAccountState() {
        boolean loggedIn = mobileApi.isLoggedIn();
        boolean saved = mobileApi.hasSavedSession();
        accountStatus.setText(loggedIn ? getString(R.string.login_signed_in, mobileApi.accountEmail())
            : getString(saved ? R.string.login_restore_failed : R.string.login_signed_out));
        loginPanel.setVisibility(loggedIn ? View.GONE : View.VISIBLE);
        findViewById(R.id.retryAccountButton).setVisibility(!loggedIn && saved ? View.VISIBLE : View.GONE);
        findViewById(R.id.logoutButton).setVisibility(loggedIn ? View.VISIBLE : View.GONE);
    }

    private void saveCard() {
        if (scannedImage == null) { showSaveMessage(getString(R.string.save_image_required), true); return; }
        if (!mobileApi.hasSavedSession()) { showSaveMessage(getString(R.string.login_required), true); return; }
        String organization = organizationInput.getText().toString().trim();
        String name = nameInput.getText().toString().trim();
        if (organization.isEmpty() || name.isEmpty()) { showSaveMessage(getString(R.string.save_fields_required), true); return; }
        String[] kinds = { "institution", "school", "other" };
        int kindIndex = ((Spinner) findViewById(R.id.kindInput)).getSelectedItemPosition();
        busy = true;
        setButtonsEnabled(false);
        showSaveMessage(getString(R.string.save_working), false);
        mobileApi.save(scannedImage, organization, kinds[kindIndex], name, titleInput.getText().toString().trim(),
            phoneInput.getText().toString().trim(), mobileInput.getText().toString().trim(),
            emailInput.getText().toString().trim(), mergedText.getText().toString(), new MobileApi.SaveCallback() {
                @Override public void progress(int messageId) { showSaveMessage(getString(messageId), false); }
                @Override public void done(String error, String cardId) {
                    busy = false;
                    if (error.isEmpty()) {
                        showSaveMessage(getString(R.string.save_confirmed,
                            cardId.length() > 8 ? cardId.substring(0, 8) : cardId), false);
                        scannedImage = null;
                    } else {
                        showSaveMessage(getString(R.string.save_failed, error), true);
                    }
                    showAccountState();
                    setButtonsEnabled(true);
                }
            });
    }

    private void showSaveMessage(String message, boolean failure) {
        saveStatus.setText(message);
        saveStatus.setTextColor(failure ? Color.rgb(185, 28, 28) : Color.rgb(49, 46, 129));
    }

    private void retryRegion() {
        if (scannedImage == null) { status.setText(R.string.save_image_required); return; }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream source = getContentResolver().openInputStream(scannedImage)) {
            BitmapFactory.decodeStream(source, null, bounds);
        } catch (IOException error) { status.setText(R.string.status_image_error); return; }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = 1;
        while (Math.max(bounds.outWidth / options.inSampleSize, bounds.outHeight / options.inSampleSize) > 2000) options.inSampleSize *= 2;
        final Bitmap bitmap;
        try (InputStream source = getContentResolver().openInputStream(scannedImage)) {
            bitmap = BitmapFactory.decodeStream(source, null, options);
        } catch (IOException error) { status.setText(R.string.status_image_error); return; }
        if (bitmap == null) { status.setText(R.string.status_image_error); return; }

        String[] labels = {"기관", "이름", "직책", "전화", "휴대폰", "이메일"};
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(16, 8, 16, 0);
        Spinner target = new Spinner(this);
        target.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels));
        content.addView(target);
        TextView help = new TextView(this);
        help.setText(R.string.retry_region_help);
        content.addView(help);
        CropSelectionView selection = new CropSelectionView(this);
        selection.setBitmap(bitmap);
        content.addView(selection, new LinearLayout.LayoutParams(-1, Math.round(getResources().getDisplayMetrics().density * 420)));
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(R.string.retry_region_title).setView(content)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.retry_region_apply, null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            Bitmap crop = selection.crop();
            if (crop == null) { status.setText(R.string.retry_region_empty); return; }
            int fieldIndex = target.getSelectedItemPosition();
            dialog.dismiss();
            recognizeRegion(crop, fieldIndex);
        }));
        dialog.show();
    }

    private void recognizeRegion(Bitmap crop, int fieldIndex) {
        status.setText(R.string.status_recognizing);
        String[] result = {"", ""};
        AtomicInteger remaining = new AtomicInteger(2);
        InputImage image = InputImage.fromBitmap(crop, 0);
        koreanRecognizer.process(image).addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) result[0] = task.getResult().getText().trim();
            if (remaining.decrementAndGet() == 0) showRegionResult(result, fieldIndex);
        });
        latinRecognizer.process(image).addOnCompleteListener(task -> {
            if (task.isSuccessful() && task.getResult() != null) result[1] = task.getResult().getText().trim();
            if (remaining.decrementAndGet() == 0) showRegionResult(result, fieldIndex);
        });
    }

    private void showRegionResult(String[] result, int fieldIndex) {
        String raw = CardFieldParser.mergeUniqueLines(result[0], result[1]);
        CardFieldParser.Fields parsed = CardFieldParser.parse(raw);
        String[] candidates = { parsed.organization, parsed.name, parsed.title, parsed.phone, parsed.mobile, parsed.email };
        String candidate = candidates[fieldIndex];
        if (candidate.isEmpty()) candidate = raw.replace('\n', ' ').trim();
        EditText value = new EditText(this);
        value.setSingleLine(false);
        value.setText(candidate);
        EditText[] fields = { organizationInput, nameInput, titleInput, phoneInput, mobileInput, emailInput };
        new AlertDialog.Builder(this).setTitle(R.string.retry_region_result)
            .setMessage(raw.isEmpty() ? getString(R.string.retry_region_no_text) : raw)
            .setView(value).setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(android.R.string.ok, (dialog, which) -> fields[fieldIndex].setText(value.getText().toString().trim()))
            .show();
        status.setText(R.string.retry_region_result);
    }

    private void setButtonsEnabled(boolean enabled) {
        Button scanButton = findViewById(R.id.scanButton);
        scanButton.setEnabled(enabled && !busy);
        findViewById(R.id.loginButton).setEnabled(enabled && !busy);
        findViewById(R.id.retryAccountButton).setEnabled(enabled && !busy);
        findViewById(R.id.logoutButton).setEnabled(enabled && !busy);
        Button saveButton = findViewById(R.id.saveButton);
        saveButton.setEnabled(enabled && !busy && !accountChecking && scannedImage != null);
        saveButton.setText(busy ? R.string.save_working : R.string.save_button);
        findViewById(R.id.retryRegionButton).setEnabled(enabled && !busy && scannedImage != null);
    }

    @Override
    protected void onDestroy() {
        if (updateManager != null) updateManager.close();
        if (mobileApi != null) mobileApi.close();
        koreanRecognizer.close();
        latinRecognizer.close();
        super.onDestroy();
    }
}
