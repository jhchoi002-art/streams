let room=localStorage.getItem("streamsTeacherRoom")||"";
let roomData=null;
let unsubscribe=null;
let lastRankSignature="";
let lastDoneMap={};

async function newRoom(){
  room=makeCode();
  localStorage.setItem("streamsTeacherRoom",room);
  await fbPut("/streamsRooms/"+room,{
    created:Date.now(),
    resetToken:Date.now(),
    currentIndex:-1,
    currentValue:"-",
    deck:makeDeck().slice(0,20),
    students:{},
    ended:false
  });
  listenRoom();
}

async function resetRoom(){
  if(!room)return newRoom();
  if(!confirm("방코드는 유지하고 게임만 초기화할까요?\n학생들은 같은 QR로 계속 접속할 수 있습니다."))return;
  const old=await fbGet("/streamsRooms/"+room);
  const students={};
  Object.entries(old?.students||{}).forEach(([id,s])=>{
    students[id]={
      name:s.name||id,
      board:Array(20).fill(null),
      boardSimple:Array(20).fill(null),
      currentPlaced:-999,
      joined:s.joined||Date.now(),
      updated:Date.now()
    };
  });
  await fbPut("/streamsRooms/"+room,{
    created:Date.now(),
    resetToken:Date.now(),
    currentIndex:-1,
    currentValue:"-",
    deck:makeDeck().slice(0,20),
    students,
    ended:false
  });
  lastDoneMap={};
}

function pickedCount(){
  return Math.max(0,(roomData?.currentIndex??-1)+1);
}

function staticRender(){
  $("topRoom").textContent=room||"-";
  $("roomCode").textContent=room||"-";
  const link=location.origin+location.pathname.replace("teacher.html","student.html")+"?room="+(room||"");
  $("joinLink").textContent=link;
  $("qr").src= room ? "https://api.qrserver.com/v1/create-qr-code/?size=230x230&data="+encodeURIComponent(link) : "";
  $("displayLink").href="display.html?room="+(room||"");
}

function getStudentKeys(){
  return Object.keys(roomData?.students||{});
}

function getDoneKeys(){
  const students=roomData?.students||{};
  const current=roomData?.currentIndex??-1;
  if(current<0)return [];
  return Object.keys(students).filter(k=>students[k].currentPlaced===current);
}

function getMissingStudents(){
  const students=roomData?.students||{};
  const current=roomData?.currentIndex??-1;
  if(current<0)return [];
  return Object.keys(students)
    .filter(k=>students[k].currentPlaced!==current)
    .map(k=>students[k].name||k)
    .sort((a,b)=>a.localeCompare(b,"ko"));
}

function renderProgress(){
  const keys=getStudentKeys();
  const done=getDoneKeys();
  $("turnCount").textContent=`${done.length} / ${keys.length}명`;
  $("turnFill").style.width=keys.length?`${Math.round(done.length/keys.length*100)}%`:"0%";
  $("turnMsg").style.display=(keys.length>0&&done.length===keys.length&&(roomData?.currentIndex??-1)>=0)?"block":"none";

  const count=pickedCount();
  if(count>=20){
    $("drawBtn").textContent=`모든 숫자를 뽑았습니다 (20/20)`;
    $("drawBtn").disabled=true;
  }else{
    $("drawBtn").disabled=false;
    $("drawBtn").textContent=`다음 숫자 뽑기 (${count}/20)`;
  }
}

function renderStudents(){
  const students=roomData?.students||{};
  const current=roomData?.currentIndex??-1;
  const keys=Object.keys(students).sort((a,b)=>(students[a].name||a).localeCompare(students[b].name||b,"ko"));

  $("studentList").innerHTML=keys.length?keys.map(k=>{
    const s=students[k];
    const done=current>=0&&s.currentPlaced===current;
    const wasDone=lastDoneMap[k]===true;
    const flash=done&&!wasDone?' flash':'';
    const sc=scoreBoard(s.boardSimple||[]);
    return `<div class="student-card ${done?'done':'pending'}${flash}" data-id="${k}">
      <div>${done?'🟢':'⚪'} ${s.name||k}</div>
      <div class="small">${done?'입력 완료':'미입력'} · ${sc.run}칸 / ${sc.score}점</div>
    </div>`;
  }).join(""):"아직 학생 없음";

  const nextMap={};
  keys.forEach(k=>{nextMap[k]=current>=0&&students[k].currentPlaced===current;});
  lastDoneMap=nextMap;

  document.querySelectorAll(".student-card").forEach(el=>el.onclick=()=>openStudent(el.dataset.id));
}

function renderRank(){
  const students=roomData?.students||{};
  const keys=Object.keys(students);
  const sig=keys.map(k=>{
    const s=students[k], sc=scoreBoard(s.boardSimple||[]);
    return `${k}:${s.name}:${sc.run}:${sc.score}`;
  }).sort().join("|");
  if(sig===lastRankSignature)return;
  lastRankSignature=sig;

  const ranks=keys.map(k=>{
    const s=students[k], sc=scoreBoard(s.boardSimple||[]);
    return {name:s.name||k,score:sc.score,run:sc.run};
  }).sort((a,b)=>b.score-a.score||b.run-a.run||a.name.localeCompare(b.name,"ko"));

  $("rankList").innerHTML=ranks.length?ranks.map((r,i)=>`<div class="rank-row">
    <span>${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${i+1}. ${r.name}</span>
    <span>${r.run}칸 / ${r.score}점</span>
  </div>`).join(""):"아직 학생 없음";
}

function render(){
  staticRender();
  if(!roomData)return;
  $("topCurrent").textContent=roomData.currentValue||"-";
  renderProgress();
  renderStudents(); // Beta: 학생 목록은 항상 최신으로 다시 그림
  renderRank();     // 순위는 점수 변화 시에만 다시 그림
}

function openStudent(id){
  const s=roomData?.students?.[id]; if(!s)return;
  $("modal").classList.remove("hidden");
  $("modalTitle").textContent=(s.name||id)+" 학생 판";
  renderBoard($("modalBoard"),{board:s.boardSimple||Array(20).fill(null),name:s.name||"",room,currentValue:roomData.currentValue||"-"});
}

function listenRoom(){
  if(unsubscribe)unsubscribe();
  staticRender();
  if(!room)return newRoom();
  unsubscribe=fbListen("/streamsRooms/"+room, data=>{
    roomData=data;
    if(!roomData)newRoom();
    else render();
  });
}

$("newRoomBtn").onclick=()=>{if(confirm("정말 새 방을 만들까요? 현재 방코드가 바뀝니다."))newRoom()};
$("resetBtn").onclick=resetRoom;
$("drawBtn").onclick=async()=>{
  if(!roomData)return;
  const ni=(roomData.currentIndex??-1)+1;
  if(ni>=20)return alert("20개를 모두 뽑았습니다.");

  const keys=getStudentKeys();
  const done=getDoneKeys();
  if((roomData.currentIndex??-1)>=0 && keys.length>0 && done.length<keys.length){
    const missing=getMissingStudents();
    const preview=missing.slice(0,12).map(n=>"• "+n).join("\n");
    const more=missing.length>12?`\n외 ${missing.length-12}명`: "";
    const ok=confirm(`아직 입력하지 않은 학생이 있습니다.\n\n입력 완료: ${done.length} / ${keys.length}명\n\n미입력 학생\n${preview}${more}\n\n정말 다음 숫자를 뽑으시겠습니까?`);
    if(!ok)return;
  }
  await fbPatch("/streamsRooms/"+room,{currentIndex:ni,currentValue:roomData.deck[ni]});
};
$("endBtn").onclick=()=>fbPatch("/streamsRooms/"+room,{ended:true});
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").classList.add("hidden")};
listenRoom();
