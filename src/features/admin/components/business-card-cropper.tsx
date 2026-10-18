"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { CardField } from "@/features/admin/recognize-business-card";

type Point = { x: number; y: number };
type Selection = { x: number; y: number; width: number; height: number };
type Drag = { pointerId: number; start: Point; initial: Selection | null; horizontal: "left" | "right" | null; vertical: "top" | "bottom" | null; mode: "create" | "move" | "resize" };

const MIN_SELECTION = 0.02;
const HANDLES = [
  { horizontal: "left", vertical: "top", left: "0%", top: "0%" },
  { horizontal: null, vertical: "top", left: "50%", top: "0%" },
  { horizontal: "right", vertical: "top", left: "100%", top: "0%" },
  { horizontal: "left", vertical: null, left: "0%", top: "50%" },
  { horizontal: "right", vertical: null, left: "100%", top: "50%" },
  { horizontal: "left", vertical: "bottom", left: "0%", top: "100%" },
  { horizontal: null, vertical: "bottom", left: "50%", top: "100%" },
  { horizontal: "right", vertical: "bottom", left: "100%", top: "100%" },
] as const;

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }

export function BusinessCardCropper({ file, busy, canRefine, onCrop }: {
  file: File;
  busy: boolean;
  canRefine: boolean;
  onCrop: (cropped: File, field?: CardField) => Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let active = true;
    queueMicrotask(() => { if (active) { setImageLoaded(false); setPreviewUrl(url); } });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  function point(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
  }

  function begin(event: PointerEvent<HTMLDivElement>) {
    if (busy || cropping || !selectionMode || dragRef.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    const start = point(event);
    const bounds = event.currentTarget.getBoundingClientRect();
    const hitX = Math.min(0.25, 22 / bounds.width);
    const hitY = Math.min(0.25, 22 / bounds.height);
    const handle = selection && HANDLES.find(({ horizontal, vertical }) => {
      const x = selection.x + (horizontal === "left" ? 0 : horizontal === "right" ? selection.width : selection.width / 2);
      const y = selection.y + (vertical === "top" ? 0 : vertical === "bottom" ? selection.height : selection.height / 2);
      return Math.abs(start.x - x) <= hitX && Math.abs(start.y - y) <= hitY;
    });
    const inside = selection && start.x >= selection.x && start.x <= selection.x + selection.width && start.y >= selection.y && start.y <= selection.y + selection.height;
    dragRef.current = {
      pointerId: event.pointerId, start, initial: selection,
      horizontal: handle?.horizontal ?? null, vertical: handle?.vertical ?? null,
      mode: handle ? "resize" : inside ? "move" : "create",
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (dragRef.current.mode === "create") setSelection({ ...start, width: 0, height: 0 });
    setError("");
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = point(event);
    const dx = current.x - drag.start.x;
    const dy = current.y - drag.start.y;
    if (drag.mode === "create") {
      setSelection({ x: Math.min(drag.start.x, current.x), y: Math.min(drag.start.y, current.y), width: Math.abs(dx), height: Math.abs(dy) });
      return;
    }
    const initial = drag.initial;
    if (!initial) return;
    if (drag.mode === "move") {
      setSelection({ ...initial, x: Math.max(0, Math.min(1 - initial.width, initial.x + dx)), y: Math.max(0, Math.min(1 - initial.height, initial.y + dy)) });
      return;
    }
    const left = drag.horizontal === "left" ? Math.max(0, Math.min(initial.x + initial.width - MIN_SELECTION, initial.x + dx)) : initial.x;
    const right = drag.horizontal === "right" ? Math.min(1, Math.max(initial.x + MIN_SELECTION, initial.x + initial.width + dx)) : initial.x + initial.width;
    const top = drag.vertical === "top" ? Math.max(0, Math.min(initial.y + initial.height - MIN_SELECTION, initial.y + dy)) : initial.y;
    const bottom = drag.vertical === "bottom" ? Math.min(1, Math.max(initial.y + MIN_SELECTION, initial.y + initial.height + dy)) : initial.y + initial.height;
    setSelection({ x: left, y: top, width: right - left, height: bottom - top });
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.mode === "create") setSelection((current) => current && current.width >= MIN_SELECTION && current.height >= MIN_SELECTION ? current : drag.initial);
  }

  async function cropAndRecognize(field?: CardField) {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) {
      setError("사진을 열 수 없습니다. JPG로 다시 촬영하거나 앨범에서 다른 사진을 선택해 주세요.");
      return;
    }
    if (busy || cropping) return;
    if (field && !selection) return;
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
      await onCrop(new File([blob], "business-card.jpg", { type: "image/jpeg" }), field);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "사진을 처리할 수 없습니다.");
    } finally {
      setCropping(false);
    }
  }

  return <div className="mt-3 space-y-2">
    <h4 className="font-semibold text-indigo-950">2. 사진 확인과 글자 인식</h4>
    <p className="text-sm text-slate-700">사진이 보이면 바로 글자 인식을 누르세요. 배경을 제외하려면 영역을 드래그해 선택하고, 선택한 박스의 위치와 크기를 조정할 수 있습니다.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void cropAndRecognize()} disabled={busy || cropping || !imageLoaded} className="min-h-12 flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy || cropping ? "인식 중…" : "이 사진 글자 인식"}</button>
      <button type="button" onClick={() => setSelectionMode((current) => !current)} disabled={busy || cropping || !imageLoaded} aria-pressed={selectionMode} className="min-h-12 rounded-lg border border-indigo-300 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 disabled:opacity-50">{selectionMode ? "영역 선택 종료" : "영역 선택"}</button>
    </div>
    {selectionMode && <p className="text-xs text-indigo-700">사진을 드래그해 영역을 만드세요. 박스 안을 드래그하면 이동하고, 흰색 조절점을 드래그하면 크기를 바꿀 수 있습니다.</p>}
    <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-2 text-center">
      <div onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className={`relative inline-block max-w-full align-top ${selectionMode ? "touch-none cursor-crosshair" : ""}`}>
        {/* The native image size is needed to map pointer coordinates to pixels accurately. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imageRef} src={previewUrl} alt="선택한 명함 사진 미리보기" draggable={false} onLoad={() => setImageLoaded(true)} onError={() => { setImageLoaded(false); setError("사진을 열 수 없습니다. JPG로 다시 촬영하거나 앨범에서 다른 사진을 선택해 주세요."); }} className="block max-h-80 max-w-full select-none" />
        {selection && <div className="pointer-events-none absolute border-2 border-indigo-600 bg-indigo-500/15" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }}>
          {selectionMode && HANDLES.map((handle, index) => <span key={index} className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-600 bg-white shadow-sm" style={{ left: handle.left, top: handle.top }} />)}
        </div>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {canRefine && <>
        <button type="button" onClick={() => void cropAndRecognize("organization")} disabled={busy || cropping || !selection} className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">선택한 기관명 다시 읽기</button>
        <button type="button" onClick={() => void cropAndRecognize("name")} disabled={busy || cropping || !selection} className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">선택한 이름 다시 읽기</button>
      </>}
      {selection && <button type="button" onClick={() => setSelection(null)} disabled={busy || cropping} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">전체 사진 선택</button>}
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
