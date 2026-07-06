let room=qs("room");
let sid=localStorage.getItem("streamsSid")||("s"+Math.random().toString(36).slice(2));
localStorage.setItem("streamsSid",sid);

let name=localStorage.getItem("streamsName")||"";
let roomData=null, board=Array(20).fill(null), resetToken="", unsubscribe=null;
let heartbeatTimer=null;
const ACTIVE_LIMIT_MS = 12000; // 12초 안에 접속 기록이 있으면 접속 중으로 판단

$("roomInput").value=room;
$("nameInput").value=name;
$("joinBtn").onclick=join;

function cleanName(v){
  return (v||"").trim();
}

function findSameNameStudent(students, targetName){
  const now=Date.now();
  const same=Object.entries(students||{}).filter(([id,s])=>cleanName(s.name)===targetName);
  const sameSid=same.find(([id])=>id===sid);
  if(sameSid) return {type:"mine", id:sameSid[0], data:sameSid[1]};

  const active=same.find(([id,s])=>now-(s.lastSeen||s.updated||s.joined||0)<ACTIVE_LIMIT_MS);
  if(active) return {type:"active", id:active[0], data:active[1]};

  const old=same.sort((a,b)=>(b[1].updated||0)-(a[1].updated||0))[0];
  if(old) return {type:"resume", id:old[0], data:old[1]};

  return null;
}

async function join(){
  room=$("roomInput").value.trim().toUpperCase();
  name=cleanName($("nameInput").value);

  if(!room||!name){
    $("joinMsg").textContent="방코드와 이름을 입력하세요.";
    return;
  }

  const data=await fbGet("/streamsRooms/"+room);
  if(!data){
    $("joinMsg").textContent="방을 찾을 수 없습니다.";
    return;
  }

  const found=findSameNameStudent(data.students||{}, name);

  if(found && found.type==="active"){
    $("joinMsg").textContent="이미 같은 이름으로 접속 중입니다. 다른 이름을 적어주세요.";
    return;
  }

  // 같은 이름의 이전 기록이 있으면 그 기록으로 이어서 하기
  if(found && (found.type==="resume" || found.type==="mine")){
    sid=found.id;
    localStorage.setItem("streamsSid",sid);
    board=found.data.board||Array(20).fill(null);
  }else{
    const old=await fbGet("/streamsRooms/"+room+"/students/"+sid);
    board=old?.board||Array(20).fill(null);
  }

  localStorage.setItem("streamsName",name);
  roomData=data;
  resetToken=String(data.resetToken||"");

  await saveStudent(currentCell()!==null ? roomData.currentIndex : -999);
  $("joinScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  history.replaceState(null,"","student.html?room="+room);
  listenRoom();
  startHeartbeat();
}

function listenRoom(){
  if(unsubscribe)unsubscribe();
  unsubscribe=fbListen("/streamsRooms/"+room, async data=>{
    if(!data)return;
    const newToken=String(data.resetToken||"");

    if(resetToken && newToken!==resetToken){
      board=Array(20).fill(null);
      await saveStudent(-999);
    }

    resetToken=newToken;
    roomData=data;
    render();
  });
}

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&sid){
      fbPatch("/streamsRooms/"+room+"/students/"+sid,{lastSeen:Date.now()});
    }
  },3000);
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

  render();
  await saveStudent(idx);
}

async function saveStudent(currentPlaced){
  await fbPatch("/streamsRooms/"+room+"/students/"+sid,{
    name,
    board,
    boardSimple:simpleBoard(board),
    currentPlaced,
    updated:Date.now(),
    joined:Date.now(),
    lastSeen:Date.now()
  });
}

window.addEventListener("beforeunload",()=>{
  if(room&&sid){
    try{
      const url=DB_URL+"/streamsRooms/"+room+"/students/"+sid+".json";
      const blob=new Blob([JSON.stringify({lastSeen:0})],{type:"application/json"});
      navigator.sendBeacon(url+"?x="+Date.now(), blob);
    }catch(e){}
  }
});

if(room&&name) join();
