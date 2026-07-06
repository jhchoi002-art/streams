let room=qs("room");
let name="";
let key="";
let roomData=null;
let board=Array(20).fill(null);
let currentPlaced=-999;
let resetToken="";
let unsubscribe=null;
let heartbeatTimer=null;

// 같은 브라우저/기기 판별용 ID
let clientId=localStorage.getItem("streamsClientId")||("c_"+Math.random().toString(36).slice(2)+Date.now().toString(36));
localStorage.setItem("streamsClientId",clientId);

// QR로 들어온 경우 방코드만 채우고, 이름은 자동 입력/자동 입장하지 않음
$("roomInput").value=room;
$("nameInput").value="";
$("joinBtn").onclick=join;

function studentPath(){
  return "/streamsRooms/"+room+"/students/"+key;
}

function setJoinMsg(msg){
  $("joinMsg").textContent=msg||"";
}

async function join(){
  try{
    setJoinMsg("");

    room=$("roomInput").value.trim().toUpperCase();
    name=cleanName($("nameInput").value);

    if(!room||!name){
      setJoinMsg("방코드와 이름을 입력하세요.");
      return;
    }

    key=nameKey(name);

    const data=await fbGet("/streamsRooms/"+room);
    if(!data){
      setJoinMsg("방을 찾을 수 없습니다.");
      return;
    }

    roomData=data;
    resetToken=String(data.resetToken||"");

    const existing=await fbGet(studentPath());

    // 최종 규칙:
    // - 같은 기기(clientId 동일): 이어서 진행
    // - 기존 기록에 clientId가 없음: 예전 기록으로 보고 이어서 진행
    // - online=true + 다른 clientId: 다른 기기에서 접속 중으로 보고 차단
    // - online=false: 이어서 진행
    if(existing && existing.online===true && existing.clientId && existing.clientId!==clientId){
      setJoinMsg("이미 같은 이름으로 다른 기기에서 접속 중입니다. 다른 이름을 입력해주세요.");
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

    localStorage.setItem("streamsName",name);
    localStorage.setItem("streamsRoom",room);

    // 입장 시 기존 board/currentPlaced는 절대 덮어쓰지 않고 접속 상태만 갱신
    await fbPatch(studentPath(),{
      name,
      online:true,
      clientId
    });

    $("joinScreen").classList.add("hidden");
    $("gameScreen").classList.remove("hidden");
    history.replaceState(null,"","student.html?room="+room);

    listenRoom();
    startOnlineSignal();
    render();
  }catch(e){
    console.error(e);
    setJoinMsg("입장 중 오류가 발생했습니다. 새로고침 후 다시 시도해주세요.");
  }
}

function listenRoom(){
  if(unsubscribe)unsubscribe();

  unsubscribe=fbListen("/streamsRooms/"+room,async data=>{
    if(!data)return;

    const newToken=String(data.resetToken||"");

    // 교사가 초기화한 경우에만 학생 보드 삭제
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

    // 서버에 내 기록이 있고, 로컬 보드가 비어 있으면 복구
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
  });
}

// heartbeat 의존 최소화: online/clientId만 유지
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
      ? "현재 숫자를 빈칸에 놓으세요. 다음 숫자가 나오기 전까지 이동할 수 있습니다."
      : "다음 숫자를 기다리는 중입니다.",
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
  if(!document.hidden && room && key){
    fbPatch(studentPath(),{name,online:true,clientId});
  }
});

// 자동 join 없음. QR로 들어와도 반드시 이름 입력 후 입장.
