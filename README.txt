STREAMS ONLINE 4.1.1 Score Highlight Fix

기준:
- 정상 작동 확인된 4.0 RC4/RC3 기반입니다.

수정:
- 4.1에서 학생 입장 시 화면 표시 오류가 나던 문제 수정
- 기존 simpleBoard / scoreBoard 함수는 건드리지 않음
- 별도 분석 함수 streamsAnalyzeScoreRuns만 추가

추가:
- 점수에 포함된 오름차순 칸: 초록색 표시
- 점수에 포함되지 못한 칸: 빨간색 표시

기존 기능 유지:
- 재입장
- 실시간 순위
- TOP3 비교
- 학생 보드 보기
- 방코드 복사
