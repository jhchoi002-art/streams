STREAMS ONLINE 4.1.5 Break Line Position Fix

기준:
- 4.1.4 Break Lines 기반입니다.

수정:
- 모달/학생 보드 보기에서 빨간 끊김 표시가 엉뚱한 위치에 나타나는 문제 수정
- getBoundingClientRect overlay 방식 대신 셀 자체에 break-before 클래스를 붙이는 방식으로 변경
- 27과 26처럼 실제 끊어진 두 칸 사이에 표시가 안정적으로 나타나도록 수정

기존 기능 유지:
- 점수 포함/미포함 색상 표시
- 재입장
- 실시간 순위
- TOP3 비교
- 학생 보드 보기
- 방코드 복사
