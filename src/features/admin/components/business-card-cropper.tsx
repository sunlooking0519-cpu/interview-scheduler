"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type Point = { x: number; y: number };
type Selection = { x: number; y: number; width: number; height: number };

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }

export function BusinessCardCropper({ file, busy, onCrop }: {
  file: File;
  busy: boolean;
  onCrop: (cropped: File) => Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const startRef = useRef<Point | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let active = true;
    queueMicrotask(() => { if (active) setPreviewUrl(url); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  function point(event: PointerEvent<HTMLImageElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
  }

  function begin(event: PointerEvent<HTMLImageElement>) {
    if (busy || cropping) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = point(event);
    setSelection(null);
    setError("");
  }

  function move(event: PointerEvent<HTMLImageElement>) {
    if (!startRef.current) return;
    const end = point(event);
    const start = startRef.current;
    setSelection({
      x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y),
    });
  }

  function end() {
    startRef.current = null;
    setSelection((current) => current && current.width >= 0.05 && current.height >= 0.05 ? current : null);
  }

  async function cropAndRecognize() {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight || busy || cropping) return;
    setCropping(true);
    setError("");
    try {
      const area = selection ?? { x: 0, y: 0, width: 1, height: 1 };
      const sourceWidth = Math.max(1, Math.round(area.width * image.naturalWidth));
      const sourceHeight = Math.max(1, Math.round(area.height * image.naturalHeight));
      const scale = Math.min(2, 2400 / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("사진을 처리할 수 없습니다.");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, Math.round(area.x * image.naturalWidth), Math.round(area.y * image.naturalHeight), sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("사진을 처리할 수 없습니다.")), "image/jpeg", 0.92));
      await onCrop(new File([blob], "business-card.jpg", { type: "image/jpeg" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "사진을 처리할 수 없습니다.");
    } finally {
      setCropping(false);
    }
  }

  return <div className="mt-3 space-y-2">
    <p className="text-sm text-slate-700">사진에서 명함의 양 끝을 손가락이나 마우스로 드래그해 영역을 지정하세요. 선택하지 않으면 사진 전체를 인식합니다.</p>
    <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2 text-center">
      <div className="relative inline-block max-w-full align-top">
        {/* The native image size is needed to map pointer coordinates to pixels accurately. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imageRef} src={previewUrl} alt="명함 영역 선택" draggable={false} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="block max-h-80 max-w-full cursor-crosshair touch-none select-none" />
        {selection && <div className="pointer-events-none absolute border-2 border-indigo-600 bg-indigo-500/15" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }} />}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void cropAndRecognize()} disabled={busy || cropping || !previewUrl} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy || cropping ? "인식 중…" : "선택 영역 글자 인식"}</button>
      {selection && <button type="button" onClick={() => setSelection(null)} disabled={busy || cropping} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">전체 사진 선택</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
