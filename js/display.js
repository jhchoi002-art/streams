const room=qs("room");
let displayData=null;
$("displayRoom").textContent=room||"-";

function rankedStudents(){
  const students=displayData?.students||{};
  return Object.keys(students).map(k=>{
    const s=students[k], sc=scoreBoard(s.boardSimple||[]);
    return {id:k,name:s.name||k,board:s.boardSimple||Array(20).fill(null),currentPlaced:s.currentPlaced,score:sc.score,run:sc.run};
  }).sort((a,b)=>b.score-a.score||b.run-a.run||a.name.localeCompare(b.name,"ko"));
}

function renderDisplay(){
  if(!displayData)return;
  $("displayNumber").textContent=displayData.currentValue||"-";
  const students=displayData.students||{};
  $("displayStudents").textContent="참여 학생 "+Object.keys(students).length+"명";

  const current=displayData.currentIndex??-1;
  const ranks=rankedStudents();
  $("displayRank").innerHTML=ranks.length?ranks.map((r,i)=>{
    const done=current>=0&&r.currentPlaced===current;
    return `<div class="display-rank-row" data-id="${r.id}">
      <span>${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${i+1}. ${r.name} <span class="state">${done?'🟢':'⚪'}</span></span>
      <span>${r.run}칸 / ${r.score}점</span>
    </div>`;
  }).join(""):"<div class='display-sub'>아직 학생 없음</div>";
  document.querySelectorAll(".display-rank-row").forEach(el=>el.onclick=()=>openDisplayBoard(el.dataset.id));
}

function openDisplayBoard(id){
  const s=(displayData.students||{})[id]; if(!s)return;
  $("displayModal").classList.add("show");
  $("displayModalTitle").textContent=(s.name||id)+" 학생 보드";
  $("displayModalContent").innerHTML=`<div class="display-board-scale" id="singleBoard"></div>`;
  renderBoard($("singleBoard"),{board:s.boardSimple||Array(20).fill(null),name:s.name||"",room,currentValue:displayData.currentValue||"-"});
}

function openTop3(){
  const top=rankedStudents().slice(0,3);
  if(!top.length)return;
  $("displayModal").classList.add("show");
  $("displayModalTitle").textContent="TOP3 보드 비교";
  $("displayModalContent").innerHTML=`<div class="top3-grid">${top.map((s,i)=>`<div class="top3-card"><h3>${i===0?'🥇':i===1?'🥈':'🥉'} ${s.name}<br>${s.run}칸 / ${s.score}점</h3><div class="display-board-scale" id="topBoard${i}"></div></div>`).join("")}</div>`;
  top.forEach((s,i)=>renderBoard($("topBoard"+i),{board:s.board,name:s.name,room,currentValue:displayData.currentValue||"-"}));
}

$("displayModalClose").onclick=()=>$("displayModal").classList.remove("show");
$("displayModal").onclick=e=>{if(e.target.id==="displayModal")$("displayModal").classList.remove("show")};
$("top3Btn").onclick=openTop3;

if(room){
  fbListen("/streamsRooms/"+room, data=>{
    if(!data)return;
    displayData=data;
    renderDisplay();
  });
}
