# 서버 구현 영역

현재 서버 API와 데이터베이스는 연결되지 않았습니다.

- auth.ts: 초대 토큰/세션 검증과 HR 권한 검사
- db.ts: 데이터베이스 연결
- services/availability.ts: 면접관 가용 시간 조회
- services/bookings.ts: 트랜잭션과 고유 제약을 통한 중복 예약 방지

서버 전용 모듈에는 `server-only` 경계 적용을 권장합니다. 실제 API 구현 시 각 엔드포인트에서도 인증 및 권한을 검증해야 합니다.
