const room=qs("room");
let displayData=null;
let displayTimer=null;
$("displayRoom").textContent=room||"-";

async function loadDisplay(){
  if(!room)return;
  const data=await fbGet("/streamsRooms/"+room);
  if(!data)return;
  displayData=data;
  renderDisplay();
}

function rankedStudents(){
  const students=displayData?.students||{};
  return Object.keys(students).map(k=>{
    const s=students[k]||{};
    const b=s.boardSimple||simpleBoard(s.board||Array(20).fill(null));
    const sc=(typeof s.score==="number"&&typeof s.run==="number")?{score:s.score,run:s.run}:scoreBoard(b);
    return {id:k,name:s.name||k,board:b,currentPlaced:s.currentPlaced,score:sc.score,run:sc.run};
  }).sort((a,b)=>b.score-a.score||b.run-a.run||a.name.localeCompare(b.name,"ko"));
}

function renderDisplay(){
  if(!displayData)return;
  const current=displayData.currentIndex??-1;
  const picked=Math.max(0,current+1);
  const students=displayData.students||{};
  const total=Object.keys(students).length;
  const done=current>=0?Object.keys(students).filter(k=>students[k].currentPlaced===current).length:0;

  $("displayNumber").textContent=displayData.currentValue||"-";
  $("displayStudents").textContent=`참여 학생 ${total}명 · 이번 턴 입력 ${done}/${total}명 · ${picked}/20`;

  const ranks=rankedStudents();
  $("displayRank").innerHTML=ranks.length?ranks.map((r,i)=>{
    const doneNow=current>=0&&r.currentPlaced===current;
    return `<div class="display-rank-row" data-id="${r.id}">
      <span>${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${i+1}. ${r.name} <span class="state">${doneNow?'🟢':'⚪'}</span></span>
      <span>${r.run}칸 / ${r.score}점</span>
    </div>`;
  }).join(""):"<div class='display-sub'>아직 학생 없음</div>";

  document.querySelectorAll(".display-rank-row").forEach(el=>el.onclick=()=>openDisplayBoard(el.dataset.id));
}

function openDisplayBoard(id){
  const s=(displayData?.students||{})[id];
  if(!s)return;
  const b=s.boardSimple||simpleBoard(s.board||Array(20).fill(null));
  const sc=(typeof s.score==="number"&&typeof s.run==="number")?{score:s.score,run:s.run}:scoreBoard(b);
  $("displayModal").classList.add("show");
  document.querySelector(".display-modal-box").classList.add("board-view");
  $("displayModalTitle").textContent=(s.name||id)+" 학생 보드";
  $("displayModalContent").innerHTML=`<div class="single-board-only">
    <div class="board-only-title">${s.name||id}</div>
    <div class="board-only-sub">오름차순 ${sc.run}칸 / ${sc.score}점</div>
    <div id="singleBoard"></div>
  </div>`;
  renderBoardOnly($("singleBoard"),{board:b,name:s.name||id,room,currentValue:displayData.currentValue||"-"});
}

function openTop3(){
  const top=rankedStudents().slice(0,3);
  if(!top.length)return;
  $("displayModal").classList.add("show");
  document.querySelector(".display-modal-box").classList.add("board-view");
  $("displayModalTitle").textContent="TOP3 보드 비교";
  $("displayModalContent").innerHTML=`<div class="top3-grid">${top.map((s,i)=>`<div class="top3-card">
    <h3>${i===0?'🥇':i===1?'🥈':'🥉'} ${s.name}<br>오름차순 ${s.run}칸 / ${s.score}점</h3>
    <div id="topBoard${i}"></div>
  </div>`).join("")}</div>`;
  top.forEach((s,i)=>renderBoardOnly($("topBoard"+i),{board:s.board,name:s.name,room,currentValue:displayData.currentValue||"-"}));
}

function closeDisplayModal(){
  $("displayModal").classList.remove("show");
  document.querySelector(".display-modal-box").classList.remove("board-view");
}

$("displayModalClose").onclick=closeDisplayModal;
$("displayModal").onclick=e=>{if(e.target.id==="displayModal")closeDisplayModal()};
$("top3Btn").onclick=openTop3;

if(room){
  loadDisplay();
  clearInterval(displayTimer);
  displayTimer=setInterval(loadDisplay,700);
}
