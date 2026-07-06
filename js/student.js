let room=qs("room");
let name="";
let key="";
let roomData=null;
let board=Array(20).fill(null);
let currentPlaced=-999;
let resetToken="";
let pollTimer=null;
let heartbeatTimer=null;
let joined=false;

// 같은 기기 판별용. 한 브라우저에는 계속 같은 clientId가 유지됩니다.
let clientId=localStorage.getItem("streamsClientId")||("c_"+Math.random().toString(36).slice(2)+Date.now().toString(36));
localStorage.setItem("streamsClientId",clientId);

// QR로 들어온 경우 방코드만 채우고, 이름은 자동 입력/자동 입장하지 않음
$("roomInput").value=room;
$("nameInput").value="";
$("joinBtn").onclick=join;

function studentPath(){
  return "/streamsRooms/"+room+"/students/"+key;
}

async function join(){
  room=$("roomInput").value.trim().toUpperCase();
  name=cleanName($("nameInput").value);

  if(!room||!name){
    $("joinMsg").textContent="방코드와 이름을 입력하세요.";
    return;
  }

  key=nameKey(name);

  const data=await fbGet("/streamsRooms/"+room);
  if(!data){
    $("joinMsg").textContent="방을 찾을 수 없습니다.";
    return;
  }

  roomData=data;
  resetToken=String(data.resetToken||"");

  // 같은 이름 기록이 있으면 기존 기록으로 이어서 진행
  const existing=await fbGet(studentPath());

  // 핵심 수정:
  // 1) 같은 기기(clientId 동일)면 무조건 이어서 진행
  // 2) 기존 기록에 clientId가 없으면 기존 버전 기록으로 보고 이어서 진행
  // 3) 다른 기기 clientId이고 online=true일 때만 입장 차단
  if(existing && existing.online===true && existing.clientId && existing.clientId!==clientId){
    $("joinMsg").textContent="이미 같은 이름으로 다른 기기에서 접속 중입니다. 다른 이름을 입력해주세요.";
    return;
  }

  if(existing&&existing.board){
    board=existing.board;
    currentPlaced=typeof existing.currentPlaced==="number"?existing.currentPlaced:-999;
  }else{
    board=Array(20).fill(null);
    currentPlaced=-999;
    const scoreInfo=scorePayloadFromBoard(board);
    await fbPatch(studentPath(),{
      name,
      board,
      boardSimple:scoreInfo.boardSimple,
      score:scoreInfo.score,
      run:scoreInfo.run,
      bestRun:scoreInfo.bestRun,
      currentPlaced:-999,
      joined:Date.now(),
      updated:Date.now(),
      online:true,
      clientId
    });
  }

  // 이름은 저장하되, 다음 QR 입장 때 자동입장은 하지 않음
  localStorage.setItem("streamsName",name);
  localStorage.setItem("streamsRoom",room);

  joined=true;

  // 입장 시에는 기존 board/currentPlaced를 절대 덮어쓰지 않고 접속 상태만 갱신
  await fbPatch(studentPath(),{
    name,
    online:true,
    clientId
  });

  $("joinScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  history.replaceState(null,"","student.html?room="+room);

  startPolling();
  startOnlineSignal();
  render();
}

async function pollRoom(){
  if(!joined||!room)return;
  const data=await fbGet("/streamsRooms/"+room);
  if(!data)return;

  const newToken=String(data.resetToken||"");

  // 교사가 초기화했을 때만 보드 삭제
  if(resetToken&&newToken!==resetToken){
    board=Array(20).fill(null);
    currentPlaced=-999;
    roomData=data;
    resetToken=newToken;
    await saveStudent();
    render();
    return;
  }

  resetToken=newToken;
  roomData=data;

  // 서버에 있는 내 보드가 있고, 로컬이 비어 있으면 복구
  const serverMe=data.students?.[key];
  if(serverMe&&serverMe.board){
    const serverHas=serverMe.board.some(x=>x);
    const localHas=board.some(x=>x);
    if(serverHas&&!localHas){
      board=serverMe.board;
      currentPlaced=typeof serverMe.currentPlaced==="number"?serverMe.currentPlaced:currentPlaced;
    }
  }

  render();
}

function startPolling(){
  clearInterval(pollTimer);
  pollTimer=setInterval(pollRoom,700);
  pollRoom();
}

// heartbeat 의존 최소화: 접속 중 표시만 유지하고, 시간 기준으로 자동 차단하지 않음
function startOnlineSignal(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&key){
      fbPatch(studentPath(),{
        name,
        online:true,
        clientId
      });
    }
  },5000);
}

function currentCell(){
  const idx=roomData?.currentIndex;
  if(idx==null||idx<0)return null;
  for(let i=0;i<20;i++){
    if(board[i]?.drawIndex===idx)return i;
  }
  return null;
}

function render(){
  const idx=roomData?.currentIndex??-1;
  renderBoard($("gameScreen"),{
    board:simpleBoard(board),
    room,
    name,
    currentValue:roomData?.currentValue||"-",
    currentCell:currentCell(),
    status:idx>=0
      ?"현재 숫자를 빈칸에 놓으세요. 다음 숫자가 나오기 전까지 이동할 수 있습니다."
      :"다음 숫자를 기다리는 중입니다.",
    onCell:place
  });
}

async function place(cell){
  if(!roomData||roomData.currentIndex<0)return;

  const idx=roomData.currentIndex;
  const val=roomData.currentValue;

  if(board[cell]&&board[cell].drawIndex!==idx){
    return alert("이미 이전 숫자가 놓인 칸입니다.");
  }

  board=board.map(x=>x&&x.drawIndex===idx?null:x);
  board[cell]={drawIndex:idx,value:val};
  currentPlaced=idx;

  render();
  await saveStudent();
}

async function saveStudent(){
  if(!room||!key)return;
  const updated=Date.now();
  const scoreInfo=scorePayloadFromBoard(board);

  await fbPatch(studentPath(),{
    name,
    board,
    boardSimple:scoreInfo.boardSimple,
    score:scoreInfo.score,
    run:scoreInfo.run,
    bestRun:scoreInfo.bestRun,
    currentPlaced,
    updated,
    online:true,
    clientId
  });
}

window.addEventListener("beforeunload",()=>{
  if(room&&key){
    try{
      fetch(DB_URL+studentPath()+".json",{
        method:"PATCH",
        keepalive:true,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({online:false,clientId})
      });
    }catch(e){}
  }
});

document.addEventListener("visibilitychange",()=>{
  // 탭을 완전히 떠난 건 아니므로 hidden만으로 offline 처리하지 않음
  // 다시 보이면 online 신호만 보냄
  if(!document.hidden && joined && room && key){
    fbPatch(studentPath(),{online:true,clientId,name});
  }
});

// 중요: 자동 join 없음. QR로 들어와도 반드시 이름 입력 후 입장
