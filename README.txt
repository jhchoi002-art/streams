STREAMS ONLINE 4.0 RC2

수정 사항:
- 재입장 오류 원인으로 보이는 scorePayloadFromBoard 누락을 보완
- 같은 이름 기록이 있으면 기존 보드/currentPlaced 복구를 최우선으로 처리
- 입장 시 board/currentPlaced를 덮어쓰지 않음
- 보드 보기 관련 파일은 건드리지 않음
- 방코드 복사 기능 유지

참고:
- 이번 RC2는 '재입장 안정화'를 우선하여 다른 기기 동일 이름 차단보다 기존 보드 복구를 우선합니다.
