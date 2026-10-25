package kr.wiseedu.cardocrtest;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

final class CropSelectionView extends View {
    private Bitmap bitmap;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF imageRect = new RectF();
    private final RectF selection = new RectF();
    private float startX;
    private float startY;

    CropSelectionView(Context context) { super(context); }
    CropSelectionView(Context context, AttributeSet attrs) { super(context, attrs); }

    void setBitmap(Bitmap value) { bitmap = value; invalidate(); }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (bitmap == null) return;
        float scale = Math.min((float) getWidth() / bitmap.getWidth(), (float) getHeight() / bitmap.getHeight());
        float width = bitmap.getWidth() * scale;
        float height = bitmap.getHeight() * scale;
        imageRect.set((getWidth() - width) / 2, (getHeight() - height) / 2, (getWidth() + width) / 2, (getHeight() + height) / 2);
        paint.setStyle(Paint.Style.FILL);
        canvas.drawBitmap(bitmap, null, imageRect, paint);
        if (selection.width() > 0 && selection.height() > 0) {
            paint.setColor(Color.rgb(79, 70, 229));
            paint.setStrokeWidth(5);
            paint.setStyle(Paint.Style.STROKE);
            canvas.drawRect(selection, paint);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.WHITE);
        }
    }

    @Override public boolean onTouchEvent(MotionEvent event) {
        if (bitmap == null) return false;
        float x = Math.max(imageRect.left, Math.min(imageRect.right, event.getX()));
        float y = Math.max(imageRect.top, Math.min(imageRect.bottom, event.getY()));
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            startX = x; startY = y; selection.set(x, y, x, y); invalidate(); return true;
        }
        if (event.getAction() == MotionEvent.ACTION_MOVE || event.getAction() == MotionEvent.ACTION_UP) {
            selection.set(Math.min(startX, x), Math.min(startY, y), Math.max(startX, x), Math.max(startY, y));
            invalidate(); return true;
        }
        return false;
    }

    Bitmap crop() {
        if (bitmap == null || selection.width() < 20 || selection.height() < 20 || imageRect.width() <= 0) return null;
        int left = Math.max(0, Math.round((selection.left - imageRect.left) * bitmap.getWidth() / imageRect.width()));
        int top = Math.max(0, Math.round((selection.top - imageRect.top) * bitmap.getHeight() / imageRect.height()));
        int right = Math.min(bitmap.getWidth(), Math.round((selection.right - imageRect.left) * bitmap.getWidth() / imageRect.width()));
        int bottom = Math.min(bitmap.getHeight(), Math.round((selection.bottom - imageRect.top) * bitmap.getHeight() / imageRect.height()));
        return right > left && bottom > top ? Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top) : null;
    }
}
