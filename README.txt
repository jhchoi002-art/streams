STREAMS ONLINE 3.1 Release Sync Resume Fix

수정 사항:
- 교사용 순위 점수 실시간 동기화 안정화 강화
- teacher.js에서 0.5초 직접 갱신
- 순위와 학생 목록 모두 최신 boardSimple 기준으로 다시 계산
- 같은 이름 재입장 이어서 하기 수정
  · 같은 브라우저/기기면 즉시 이어서 하기
  · 접속 중이 아닌 같은 이름 기록이면 이어서 하기
  · 다른 기기에서 같은 이름이 접속 중이면 입장 차단
- 접속 상태 heartbeat와 clientId 추가
