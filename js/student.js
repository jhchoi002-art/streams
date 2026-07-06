let room=qs("room");
let name=localStorage.getItem("streamsName")||"";
let key="";
let roomData=null;
let board=Array(20).fill(null);
let resetToken="";
let unsubscribe=null;
let heartbeatTimer=null;
const ACTIVE_LIMIT_MS=8000;

$("roomInput").value=room;
$("nameInput").value=name;
$("joinBtn").onclick=join;

function isActive(s){
  return Date.now()-(s?.lastSeen||0)<ACTIVE_LIMIT_MS;
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

  // 같은 이름이 접속 중이면 새 접속 차단.
  // 단, 같은 브라우저가 새로고침/재접속하는 경우는 lastSeen만으로 구분이 어려우므로
  // 학생이 나갔다가 다시 들어오는 상황을 위해 기존 기록이 있으면 이어서 하기를 우선 허용합니다.
  // 다른 학생이 같은 이름으로 동시에 들어오면 교사용 목록에서 하나의 이름으로 합쳐지므로 이름 중복 방지 효과가 있습니다.
  if(existing && isActive(existing) && !confirm("같은 이름의 기록이 이미 있습니다.\n본인이라면 확인을 눌러 이어서 진행하세요.\n다른 학생이라면 취소 후 다른 이름을 적어주세요.")){
    $("joinMsg").textContent="다른 이름을 적어주세요.";
    return;
  }

  localStorage.setItem("streamsName",name);
  roomData=data;
  resetToken=String(data.resetToken||"");

  if(existing&&existing.board){
    board=existing.board;
  }else{
    board=Array(20).fill(null);
  }

  await saveStudent(currentCell()!==null?roomData.currentIndex:-999);

  $("joinScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  history.replaceState(null,"","student.html?room="+room);
  listenRoom();
  startHeartbeat();
}

function listenRoom(){
  if(unsubscribe)unsubscribe();
  unsubscribe=fbListen("/streamsRooms/"+room,async data=>{
    if(!data)return;
    const newToken=String(data.resetToken||"");

    if(resetToken&&newToken!==resetToken){
      board=Array(20).fill(null);
      roomData=data;
      resetToken=newToken;
      await saveStudent(-999);
      render();
      return;
    }

    resetToken=newToken;
    roomData=data;

    // 서버에 내 기록이 있고, 내 로컬 보드보다 최신인 경우만 동기화
    const serverMe=data.students?.[key];
    if(serverMe&&serverMe.board&&serverMe.updated && serverMe.updated>(Number(localStorage.getItem("streamsLastLocalUpdate_"+room+"_"+key)||0)+1000)){
      board=serverMe.board;
    }

    render();
  });
}

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&key){
      fbPatch("/streamsRooms/"+room+"/students/"+key,{lastSeen:Date.now(),name});
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

  render();
  await saveStudent(idx);
}

async function saveStudent(currentPlaced){
  const updated=Date.now();
  localStorage.setItem("streamsLastLocalUpdate_"+room+"_"+key,String(updated));
  await fbPatch("/streamsRooms/"+room+"/students/"+key,{
    name,
    board,
    boardSimple:simpleBoard(board),
    currentPlaced,
    updated,
    joined:updated,
    lastSeen:updated
  });
}

window.addEventListener("beforeunload",()=>{
  if(room&&key){
    try{
      fetch(DB_URL+"/streamsRooms/"+room+"/students/"+key+".json",{
        method:"PATCH",
        keepalive:true,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lastSeen:0})
      });
    }catch(e){}
  }
});

if(room&&name) join();
