let room=localStorage.getItem("streamsTeacherRoom")||"";
let roomData=null;
let unsubscribe=null;
let pollTimer=null;
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
    ended:false,
    dataVersion:"3.2-name-based"
  });
  listenRoom();
}

async function resetRoom(){
  if(!room)return newRoom();
  if(!confirm("방코드는 유지하고 게임만 초기화할까요?\n학생들은 같은 QR로 계속 접속할 수 있습니다."))return;

  const old=await fbGet("/streamsRooms/"+room);
  const students={};
  Object.entries(old?.students||{}).forEach(([key,s])=>{
    students[key]={
      name:s.name||key,
      board:Array(20).fill(null),
      boardSimple:Array(20).fill(null),
      currentPlaced:-999,
      joined:s.joined||Date.now(),
      updated:Date.now(),
      lastSeen:s.lastSeen||0,
      online:false
    };
  });

  await fbPut("/streamsRooms/"+room,{
    created:Date.now(),
    resetToken:Date.now(),
    currentIndex:-1,
    currentValue:"-",
    deck:makeDeck().slice(0,20),
    students,
    ended:false,
    dataVersion:"3.2-name-based"
  });
  lastDoneMap={};
  await refreshRoom();
}

function pickedCount(){
  return Math.max(0,(roomData?.currentIndex??-1)+1);
}

function staticRender(){
  $("topRoom").textContent=room||"-";
  $("roomCode").textContent=room||"-";
  const link=location.origin+location.pathname.replace("teacher.html","student.html")+"?room="+(room||"");
  $("joinLink").textContent=link;
  $("qr").src=room?"https://api.qrserver.com/v1/create-qr-code/?size=230x230&data="+encodeURIComponent(link):"";
  $("displayLink").href="display.html?room="+(room||"");
}

function studentsObj(){return roomData?.students||{};}
function getStudentKeys(){return Object.keys(studentsObj());}
function currentTurn(){return roomData?.currentIndex??-1;}

function isDone(k){
  const s=studentsObj()[k];
  return currentTurn()>=0 && s && s.currentPlaced===currentTurn();
}

function getDoneKeys(){
  if(currentTurn()<0)return [];
  return getStudentKeys().filter(k=>isDone(k));
}

function getMissingStudents(){
  if(currentTurn()<0)return [];
  return getStudentKeys()
    .filter(k=>!isDone(k))
    .map(k=>studentsObj()[k].name||k)
    .sort((a,b)=>a.localeCompare(b,"ko"));
}

function renderProgress(){
  const keys=getStudentKeys();
  const done=getDoneKeys();

  $("turnCount").textContent=`${done.length} / ${keys.length}명`;
  $("turnFill").style.width=keys.length?`${Math.round(done.length/keys.length*100)}%`:"0%";
  $("turnMsg").style.display=(keys.length>0&&done.length===keys.length&&currentTurn()>=0)?"block":"none";

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
  const students=studentsObj();
  const keys=Object.keys(students).sort((a,b)=>(students[a].name||a).localeCompare(students[b].name||b,"ko"));

  $("studentList").innerHTML=keys.length?keys.map(k=>{
    const s=students[k]||{};
    const done=isDone(k);
    const wasDone=lastDoneMap[k]===true;
    const flash=done&&!wasDone?' flash':'';
    const sc=scoreBoard(s.boardSimple||[]);
    const online=(Date.now()-(s.lastSeen||0)<8000);
    return `<div class="student-card ${done?'done':'pending'}${flash}" data-id="${k}">
      <div>${done?'🟢':'⚪'} ${s.name||k} ${online?'':'<span class="small">(오프라인)</span>'}</div>
      <div class="small">${done?'입력 완료':'미입력'} · ${sc.run}칸 / ${sc.score}점</div>
    </div>`;
  }).join(""):"아직 학생 없음";

  const nextMap={};
  keys.forEach(k=>{nextMap[k]=isDone(k);});
  lastDoneMap=nextMap;

  document.querySelectorAll(".student-card").forEach(el=>el.onclick=()=>openStudent(el.dataset.id));
}

function renderRank(){
  const students=studentsObj();
  const keys=Object.keys(students);

  const ranks=keys.map(k=>{
    const s=students[k]||{};
    const sc=scoreBoard(s.boardSimple||[]);
    return {id:k,name:s.name||k,score:sc.score,run:sc.run};
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
  renderStudents();
  renderRank();
}

function openStudent(key){
  const s=studentsObj()[key];
  if(!s)return;
  $("modal").classList.remove("hidden");
  $("modalTitle").textContent=(s.name||key)+" 학생 판";
  renderBoard($("modalBoard"),{
    board:s.boardSimple||Array(20).fill(null),
    name:s.name||"",
    room,
    currentValue:roomData.currentValue||"-"
  });
}

async function refreshRoom(){
  if(!room)return;
  const data=await fbGet("/streamsRooms/"+room);
  if(!data){
    await newRoom();
    return;
  }
  roomData=data;
  render();
}

function listenRoom(){
  if(unsubscribe)unsubscribe();
  clearInterval(pollTimer);
  staticRender();

  if(!room)return newRoom();

  unsubscribe=fbListen("/streamsRooms/"+room,data=>{
    if(data){
      roomData=data;
      render();
    }
  });

  refreshRoom();
  pollTimer=setInterval(refreshRoom,500);
}

$("newRoomBtn").onclick=()=>{if(confirm("정말 새 방을 만들까요? 현재 방코드가 바뀝니다."))newRoom()};
$("resetBtn").onclick=resetRoom;

$("drawBtn").onclick=async()=>{
  if(!roomData)return;
  const ni=currentTurn()+1;
  if(ni>=20)return alert("20개를 모두 뽑았습니다.");

  const keys=getStudentKeys();
  const done=getDoneKeys();
  if(currentTurn()>=0&&keys.length>0&&done.length<keys.length){
    const missing=getMissingStudents();
    const preview=missing.slice(0,12).map(n=>"• "+n).join("\n");
    const more=missing.length>12?`\n외 ${missing.length-12}명`:"";
    const ok=confirm(`아직 입력하지 않은 학생이 있습니다.\n\n입력 완료: ${done.length} / ${keys.length}명\n\n미입력 학생\n${preview}${more}\n\n정말 다음 숫자를 뽑으시겠습니까?`);
    if(!ok)return;
  }

  await fbPatch("/streamsRooms/"+room,{currentIndex:ni,currentValue:roomData.deck[ni]});
  await refreshRoom();
};

$("endBtn").onclick=async()=>{
  await fbPatch("/streamsRooms/"+room,{ended:true});
  await refreshRoom();
};

$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").classList.add("hidden")};

listenRoom();
