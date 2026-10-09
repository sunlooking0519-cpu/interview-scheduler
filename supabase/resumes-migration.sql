-- Supabase SQL Editor에서 전체 실행. 공개 URL을 아는 사람은 파일을 읽을 수 있습니다.
begin;
alter table scheduler.interviews add column if not exists resume_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', true, 5242880, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- 파일 업로드·삭제는 서버가 발급한 signed upload URL 및 service role로만 처리합니다.
-- anon/authenticated용 INSERT/UPDATE/DELETE 정책을 추가하지 않습니다.
commit;
