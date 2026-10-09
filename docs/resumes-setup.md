# 이력서 업로드 설정

배포 전에 Supabase SQL Editor에서 `supabase/resumes-migration.sql` 전체를 실행합니다. `scheduler.interviews.resume_url` nullable 컬럼과 Public `resumes` 버킷을 생성합니다. 기존 예약은 파일 없이 유지됩니다. 파일 첨부는 선택입니다.

초기 버전 SQL을 이미 실행했다면 아래 권한 쿼리를 추가로 실행하세요. 기존 관리자 인증 SQL은 컬럼별 INSERT 권한을 사용하므로 새 컬럼에도 권한이 필요합니다.

```sql
grant insert (resume_url) on scheduler.interviews to anon, authenticated;
```

버킷은 최대 5MB(5,242,880바이트), PDF 및 Word MIME 형식을 허용합니다. Storage의 프로젝트 전역 파일 크기 제한도 5MB 이상이어야 합니다. 이미 `resumes` 버킷이 있으면 이 SQL은 해당 버킷을 공개로 변경합니다. 공개 URL을 아는 사람은 로그인 없이 파일에 접근할 수 있습니다.

Vercel에는 기존 서버 환경 변수 `SUPABASE_SECRET_KEY`(또는 `SUPABASE_SERVICE_ROLE_KEY`)가 필요합니다. 프런트엔드에는 기존 public URL과 anon/publishable key만 사용합니다. 추가 패키지나 환경 변수는 필요하지 않습니다.

예약 확정 시 서버에서 제한된 업로드 URL을 발급하고 브라우저가 Supabase로 직접 파일을 전송합니다. 서버는 지원자 이름·전화번호에 연결된 서명 티켓을 검증하고 저장된 파일의 크기·내용 형식을 확인한 뒤 공개 URL을 예약에 저장합니다. 파일명은 무작위 UUID입니다. PDF와 DOC의 헤더, DOCX의 ZIP/word 디렉터리를 검사하며 악성코드 검사 기능은 포함하지 않습니다.

파일 업로드 후 예약 저장이 실패하면, 예약에서 참조되지 않는 파일을 삭제합니다. 브라우저 종료나 네트워크 단절로 예약 요청 자체가 전달되지 않은 파일은 남을 수 있으므로 정기적으로 Storage에서 예약의 resume_url에 없는 오래된 파일을 확인해 정리하세요. 예약 취소 시 이력서는 유지됩니다. 보존 기간에 따른 삭제는 운영자가 관리합니다.

관리자 모바일 카드와 PC 표에 이력서 버튼이 표시됩니다. PDF는 브라우저에서 열리고 Word는 기기 설정에 따라 다운로드되거나 연결 앱에서 열립니다.

검증: PDF/DOC/DOCX 업로드 → 예약 저장 → 관리자 버튼 확인. 5MB 초과 및 허용하지 않은 형식은 차단되어야 합니다. 첨부 없이 예약 및 기존 예약 변경·취소도 확인하세요.

[Supabase 공개 URL 안내](https://supabase.com/docs/reference/javascript/file-buckets-getpublicurl), [파일 제한 설정](https://supabase.com/docs/guides/storage/uploads/file-limits).
