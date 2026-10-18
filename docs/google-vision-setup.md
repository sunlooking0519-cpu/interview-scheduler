# Google Vision 명함 인식 설정

1. [Google Cloud 콘솔](https://console.cloud.google.com/)에서 이 앱에 사용할 프로젝트를 선택합니다. Google Calendar OAuth 프로젝트를 재사용해도 됩니다.
2. **API 및 서비스 → 라이브러리**에서 **Cloud Vision API**를 찾아 사용 설정합니다. 결제 계정과 할당량을 확인합니다. [공식 요금표](https://cloud.google.com/vision/pricing)의 Document Text Detection은 월 첫 1,000단위가 무료이며 이후 사용량에 따라 과금됩니다. 명함을 다시 인식할 때마다 한 번 더 호출됩니다.
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**에서 명함 OCR 전용 키를 만듭니다. 기존 Gemini API 키나 OAuth 클라이언트 보안 비밀번호를 재사용하지 않습니다.
4. 새 키의 **API 제한**을 **Cloud Vision API**로 지정합니다. 키를 브라우저나 Git 저장소에 넣지 않습니다. Vercel 서버에서 호출하므로 브라우저 HTTP 리퍼러 제한을 적용하지 않습니다. 고정 송신 IP가 있는 서버를 사용한다면 IP 제한도 설정할 수 있습니다. 시험 단계에서는 Google Cloud에서 Vision API 할당량도 낮게 설정해 예상 밖의 호출을 제한하세요.
5. Vercel 프로젝트 **Settings → Environment Variables**에서 `GOOGLE_VISION_API_KEY`를 **Production** 서버 환경 변수로 추가하고 재배포합니다. 로컬 테스트에는 `.env.local`에 같은 이름으로 설정합니다.
6. `/admin/sales`에서 명함을 촬영해 **Google Vision 인식 완료** 메시지와 추출된 텍스트를 확인합니다. 설정이 없거나 호출에 실패하면 기존 브라우저 OCR로 재시도하며, 그 사실을 화면에 표시합니다. 이름·기관·전화번호를 확인하고 수정한 뒤 등록합니다.

명함 원본은 임시로 비공개 `sales-cards` 버킷에 올린 뒤 관리자 인증을 통과한 서버가 다운로드하여 Vision API로 전송합니다. OCR 요청 후 임시 파일을 삭제합니다. 등록을 확정한 명함은 기존 방식대로 비공개 버킷에 보관됩니다. Google Vision API 키는 서버에서만 읽습니다.

Vercel 함수의 요청 본문 제한을 피하기 위해 사진은 함수에 직접 전송하지 않습니다. 별도 DB 마이그레이션은 없습니다. API 키 설정 후 실제 명함 여러 장으로 인식 정확도를 확인하고, 글자가 작은 사진은 명함이 화면 대부분을 차지하도록 다시 촬영하세요.
