let room=qs("room");
let name=localStorage.getItem("streamsName")||"";
let key="";
let roomData=null;
let board=Array(20).fill(null);
let currentPlaced=-999;
let resetToken="";
let pollTimer=null;
let heartbeatTimer=null;
let joined=false;

$("roomInput").value=room;
$("nameInput").value=name;
$("joinBtn").onclick=join;

function studentPath(){
  return "/streamsRooms/"+room+"/students/"+key;
}

function activeStudent(s){
  return Date.now()-(s?.lastSeen||0)<9000;
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

  const existing=(data.students||{})[key];

  // 기존 기록이 있으면 무조건 그 기록으로 이어서 한다. 절대 빈 board로 덮어쓰지 않는다.
  if(existing){
    board=existing.board||Array(20).fill(null);
    currentPlaced=typeof existing.currentPlaced==="number"?existing.currentPlaced:-999;
  }else{
    board=Array(20).fill(null);
    currentPlaced=-999;
    await fbPatch(studentPath(),{
      name,
      board,
      boardSimple:simpleBoard(board),
      currentPlaced:-999,
      joined:Date.now(),
      updated:Date.now(),
      lastSeen:Date.now(),
      online:true
    });
  }

  localStorage.setItem("streamsName",name);
  roomData=data;
  resetToken=String(data.resetToken||"");
  joined=true;

  // 입장 시에는 board/currentPlaced를 저장하지 않고 접속 상태만 저장한다.
  // 이게 기존 보드가 날아가던 핵심 원인이었음.
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

  // 교사가 초기화했을 때만 보드를 삭제
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

  // 서버에 있는 내 데이터를 읽어와서 재입장/다른 탭 상태를 반영.
  // 단, 이미 조작 중인 현재 로컬이 비어있지 않은데 서버가 비어있으면 덮어쓰지 않음.
  const serverMe=data.students?.[key];
  if(serverMe&&serverMe.board){
    const serverHas = serverMe.board.some(x=>x);
    const localHas = board.some(x=>x);
    if(serverHas || !localHas){
      board=serverMe.board;
      currentPlaced=typeof serverMe.currentPlaced==="number"?serverMe.currentPlaced:currentPlaced;
    }
  }

  render();
}

function startPolling(){
  clearInterval(pollTimer);
  pollTimer=setInterval(pollRoom,500);
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
  await fbPatch(studentPath(),{
    name,
    board,
    boardSimple:simpleBoard(board),
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

if(room&&name) join();
