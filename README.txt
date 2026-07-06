STREAMS ONLINE 3.3.1 Join Fix

수정 사항:
- QR로 학생 화면에 들어왔을 때 이름 입력 화면을 반드시 먼저 보여주도록 수정
- 이전 이름이 localStorage에 있어도 자동 입장하지 않음
- 같은 이름 재입장 가능
- 같은 이름으로 들어오면 기존 board/currentPlaced를 읽어 이어서 진행
- 입장 시 기존 board/currentPlaced를 덮어쓰지 않음
- 학생 점수/순위 실시간 반영 구조는 3.3 유지
