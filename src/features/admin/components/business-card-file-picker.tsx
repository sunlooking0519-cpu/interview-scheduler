"use client";

type Props = {
  busy: boolean;
  file: File | null;
  onSelect: (file: File | null) => void;
};

const mimeByExtension: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function normalizeCameraFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type || mimeByExtension[extension];
  return type && type !== file.type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}

export function BusinessCardFilePicker({ busy, file, onSelect }: Props) {
  function selected(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.files?.[0] ?? null;
    // A user should be able to retry the same photo after a failed recognition.
    event.currentTarget.value = "";
    if (next) onSelect(normalizeCameraFile(next));
  }

  return <div>
    <div className="grid grid-cols-2 gap-2">
      <label className={`flex min-h-12 items-center justify-center rounded-xl bg-indigo-600 px-3 py-3 text-center text-sm font-semibold text-white ${busy ? "opacity-50" : "cursor-pointer"}`}>
        사진 촬영
        <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={selected} aria-label="명함 사진 촬영" className="sr-only" />
      </label>
      <label className={`flex min-h-12 items-center justify-center rounded-xl border border-indigo-300 bg-white px-3 py-3 text-center text-sm font-semibold text-indigo-700 ${busy ? "opacity-50" : "cursor-pointer"}`}>
        앨범에서 선택
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={selected} aria-label="앨범에서 명함 사진 선택" className="sr-only" />
      </label>
    </div>
    {file && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800" role="status">사진 선택됨: {file.name}. 아래에서 사진을 확인하고 글자 인식을 눌러 주세요.</p>}
  </div>;
}
