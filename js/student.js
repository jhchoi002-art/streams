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
      lastSeen:Date.now(),
      online:true
    });
  }

  // 이름은 저장하되, 다음 QR 입장 때 자동입장은 하지 않음
  localStorage.setItem("streamsName",name);
  localStorage.setItem("streamsRoom",room);

  joined=true;

  // 입장 시에는 기존 board/currentPlaced를 절대 덮어쓰지 않고 접속 상태만 갱신
  await fbPatch(studentPath(),{
    name,
    lastSeen:Date.now(),
    online:true
  });

  $("joinScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  history.replaceState(null,"","student.html?room="+room);

  startPolling();
  startHeartbeat();
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

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&key){
      fbPatch(studentPath(),{
        name,
        lastSeen:Date.now(),
        online:true
      });
    }
  },2000);
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
    lastSeen:updated,
    online:true
  });
}

window.addEventListener("beforeunload",()=>{
  if(room&&key){
    try{
      fetch(DB_URL+studentPath()+".json",{
        method:"PATCH",
        keepalive:true,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lastSeen:0,online:false})
      });
    }catch(e){}
  }
});

// 중요: 자동 join 제거
// QR로 들어와도 반드시 이름 입력 후 입장하게 함
