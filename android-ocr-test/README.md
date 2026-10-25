# 명함 OCR 테스트 앱

안드로이드 기기에서 Google ML Kit의 문서 스캐너와 한국어·영문 Text Recognition을 비교하는 독립형 프로토타입입니다. 이미지나 OCR 결과를 서버로 전송하지 않습니다.

## 기능

- 카메라 촬영 또는 앨범 이미지 선택
- 자동 테두리 감지, 회전, 자르기, 필터 보정
- 한국어 모델과 영문 모델을 각각 실행
- 중복 줄을 제거한 통합 OCR 텍스트
- 기관명, 이름, 직책, 전화, 휴대폰, 이메일 후보 추출 및 직접 수정
- 여러 번호가 한 줄에 있을 때 전화·휴대폰·팩스를 구분하고, 띄어 쓴 이름과 `O`로 오인된 번호를 보정
- 전체 결과 클립보드 복사 또는 공유
- OCR 처리 시간 표시

인식이 완료되기 전에는 결과 복사·공유 버튼을 사용할 수 없습니다. 손글씨에서 원문 자체가 잘못 읽힌 글자와 숫자는 사진을 대조해 직접 수정해야 합니다.

## 실행

Android Studio에서 `android-ocr-test` 폴더를 열고 `app` 구성을 안드로이드 기기에서 실행합니다. 최소 Android 6(API 23)이며 Google Play 서비스가 필요합니다.

명령줄 빌드:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\jaspe\AppData\Local\Android\Sdk'
.\gradlew.bat assembleDebug
```

APK는 `app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다.

## 권장 비교 방법

인쇄 명함 10장, 인쇄·손글씨 혼합 10장, 손글씨 메모 10장을 같은 조건으로 촬영합니다. 각 이미지마다 기관명·이름·전화·이메일의 정확 여부, 직접 수정한 필드 수, 표시된 OCR 시간을 기록합니다.
