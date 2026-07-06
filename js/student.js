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

let clientId=localStorage.getItem("streamsClientId")||("c_"+Math.random().toString(36).slice(2)+Date.now().toString(36));
localStorage.setItem("streamsClientId",clientId);

// QR로 들어온 경우 방코드만 채우고, 이름은 자동 입력/자동 입장하지 않음
$("roomInput").value=room;
$("nameInput").value="";
$("joinBtn").onclick=join;

function studentPath(){
  return "/streamsRooms/"+room+"/students/"+key;
}

function joinMsg(msg){
  $("joinMsg").textContent=msg||"";
}

async function join(){
  try{
    joinMsg("");
    room=$("roomInput").value.trim().toUpperCase();
    name=cleanName($("nameInput").value);

    if(!room||!name){
      joinMsg("방코드와 이름을 입력하세요.");
      return;
    }

    key=nameKey(name);

    const data=await fbGet("/streamsRooms/"+room);
    if(!data){
      joinMsg("방을 찾을 수 없습니다.");
      return;
    }

    roomData=data;
    resetToken=String(data.resetToken||"");

    const existing=await fbGet(studentPath());

    // 다른 기기에서 같은 이름이 접속 중이면 차단
    // 같은 기기(clientId 동일), clientId가 없는 기존 기록, online=false 기록은 이어서 진행
    if(existing&&existing.online===true&&existing.clientId&&existing.clientId!==clientId){
      joinMsg("이미 같은 이름으로 다른 기기에서 접속 중입니다. 다른 이름을 입력해주세요.");
      return;
    }

    if(existing&&existing.board){
      board=normalizeBoard(existing.board);
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
        lastSeen:Date.now(),
        online:true,
        clientId
      });
    }

    localStorage.setItem("streamsName",name);
    localStorage.setItem("streamsRoom",room);

    joined=true;

    // 입장 시에는 기존 board/currentPlaced를 절대 덮어쓰지 않고 접속 상태만 갱신
    await fbPatch(studentPath(),{
      name,
      lastSeen:Date.now(),
      online:true,
      clientId
    });

    $("joinScreen").classList.add("hidden");
    $("gameScreen").classList.remove("hidden");
    history.replaceState(null,"","student.html?room="+room);

    startPolling();
    startHeartbeat();
    render();
  }catch(e){
    console.error(e);
    joinMsg("입장 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.");
  }
}

async function pollRoom(){
  if(!joined||!room)return;
  try{
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
      const serverBoard=normalizeBoard(serverMe.board);
      const serverHas=serverBoard.some(x=>x);
      const localHas=board.some(x=>x);
      if(serverHas&&!localHas){
        board=serverBoard;
        currentPlaced=typeof serverMe.currentPlaced==="number"?serverMe.currentPlaced:currentPlaced;
      }
    }

    render();
  }catch(e){
    console.error(e);
  }
}

function startPolling(){
  clearInterval(pollTimer);
  pollTimer=setInterval(pollRoom,700);
  pollRoom();
}

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&key){
      fbPatch(studentPath(),{
        name,
        lastSeen:Date.now(),
        online:true,
        clientId
      });
    }
  },2500);
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
  try{
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
  }catch(e){
    console.error(e);
    $("gameScreen").innerHTML='<div class="join-card"><h1>화면 표시 오류</h1><p class="warning">새로고침 후 다시 입장해주세요.</p></div>';
  }
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
    lastSeen:updated,
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
        body:JSON.stringify({lastSeen:0,online:false,clientId})
      });
    }catch(e){}
  }
});

// 자동 join 없음. QR로 들어와도 반드시 이름 입력 후 입장
