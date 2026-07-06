let room=qs("room");
let name=localStorage.getItem("streamsName")||"";
let key="";
let roomData=null;
let board=Array(20).fill(null);
let currentPlaced=-999;
let resetToken="";
let unsubscribe=null;
let heartbeatTimer=null;

$("roomInput").value=room;
$("nameInput").value=name;
$("joinBtn").onclick=join;

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

  const existing=(data.students||{})[key];

  if(existing){
    // 핵심: 같은 이름 기록이 있으면 기존 board/currentPlaced를 절대 초기화하지 않음
    board=existing.board||Array(20).fill(null);
    currentPlaced=typeof existing.currentPlaced==="number" ? existing.currentPlaced : -999;
    await fbPatch("/streamsRooms/"+room+"/students/"+key,{
      name,
      lastSeen:Date.now(),
      updated:existing.updated||Date.now(),
      online:true
    });
  }else{
    board=Array(20).fill(null);
    currentPlaced=-999;
    await fbPatch("/streamsRooms/"+room+"/students/"+key,{
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
  localStorage.setItem("streamsRoom",room);

  $("joinScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  history.replaceState(null,"","student.html?room="+room);

  listenRoom();
  startHeartbeat();
  render();
}

function listenRoom(){
  if(unsubscribe)unsubscribe();

  unsubscribe=fbListen("/streamsRooms/"+room,async data=>{
    if(!data)return;

    const newToken=String(data.resetToken||"");

    // 교사가 초기화한 경우에만 학생 보드 삭제
    if(resetToken && newToken!==resetToken){
      board=Array(20).fill(null);
      currentPlaced=-999;
      roomData=data;
      resetToken=newToken;
      await fbPatch("/streamsRooms/"+room+"/students/"+key,{
        name,
        board,
        boardSimple:simpleBoard(board),
        currentPlaced:-999,
        updated:Date.now(),
        lastSeen:Date.now(),
        online:true
      });
      render();
      return;
    }

    resetToken=newToken;
    roomData=data;

    // 서버에 저장된 내 보드가 있으면, 내 로컬과 병합하지 말고 서버 최신 상태를 그대로 사용
    // 재입장/새로고침 시 기존 진행상황 복구를 확실히 하기 위한 처리
    const serverMe=data.students?.[key];
    if(serverMe&&serverMe.board){
      board=serverMe.board;
      currentPlaced=typeof serverMe.currentPlaced==="number" ? serverMe.currentPlaced : currentPlaced;
    }

    render();
  });
}

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&key){
      fbPatch("/streamsRooms/"+room+"/students/"+key,{
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
  const updated=Date.now();
  await fbPatch("/streamsRooms/"+room+"/students/"+key,{
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
      fetch(DB_URL+"/streamsRooms/"+room+"/students/"+key+".json",{
        method:"PATCH",
        keepalive:true,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lastSeen:0,online:false})
      });
    }catch(e){}
  }
});

if(room&&name) join();
