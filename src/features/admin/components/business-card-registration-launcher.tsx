"use client";

import { useState } from "react";

const appUrl = "wisecardocr://new-card";
const releaseUrl = "https://github.com/sunlooking0519-cpu/interview-scheduler/releases/latest";

export function BusinessCardRegistrationLauncher({ compact = false, label }: { compact?: boolean; label?: string }) {
  const [showGuide, setShowGuide] = useState(false);
  const [androidDevice, setAndroidDevice] = useState(false);

  function openRegistration() {
    setShowGuide(true);
    const android = /Android/i.test(navigator.userAgent);
    setAndroidDevice(android);
    if (android) window.location.href = appUrl;
  }

  return <>
    <button type="button" onClick={openRegistration} className={compact
      ? "mt-3 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
      : "rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-indigo-800 shadow-sm"}>
      {label ?? (compact ? "첫 명함 등록" : "새 명함 등록")}
    </button>
    {showGuide && <div role="dialog" aria-modal="true" aria-labelledby="card-app-guide-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left text-slate-900 shadow-2xl">
        <h2 id="card-app-guide-title" className="text-xl font-bold">명함은 모바일 앱에서 등록합니다</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">안드로이드 휴대폰에서 명함 OCR 앱을 열어 사진을 촬영하고, 내용을 확인한 뒤 <strong>명함 등록</strong>을 눌러 주세요. 저장된 명함은 이 목록에 표시됩니다.</p>
        <p className="mt-2 text-sm text-slate-600">휴대폰에서 앱이 열리지 않으면 최신 앱을 설치하거나 업데이트해 주세요.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {androidDevice && <a href={appUrl} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">앱 열기</a>}
          <a href={releaseUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">앱 다운로드</a>
          <button type="button" onClick={() => setShowGuide(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">닫기</button>
        </div>
      </div>
    </div>}
  </>;
}
