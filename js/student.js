let room=qs("room");
let sid=localStorage.getItem("streamsSid")||("s"+Math.random().toString(36).slice(2));
localStorage.setItem("streamsSid",sid);

let clientId=localStorage.getItem("streamsClientId")||("c"+Math.random().toString(36).slice(2));
localStorage.setItem("streamsClientId",clientId);

let name=localStorage.getItem("streamsName")||"";
let roomData=null;
let board=Array(20).fill(null);
let resetToken="";
let unsubscribe=null;
let heartbeatTimer=null;

const ACTIVE_LIMIT_MS=5000;

$("roomInput").value=room;
$("nameInput").value=name;
$("joinBtn").onclick=join;

function cleanName(v){
  return (v||"").trim();
}

function now(){
  return Date.now();
}

function findSameName(students,targetName){
  const list=Object.entries(students||{}).filter(([id,s])=>cleanName(s.name)===targetName);
  if(!list.length)return null;

  // 내 기존 sid면 바로 이어서 하기
  const mine=list.find(([id])=>id===sid);
  if(mine)return {kind:"mine",id:mine[0],data:mine[1]};

  // 같은 기기/브라우저에서 만든 기록이면 sid가 달라도 이어서 하기
  const sameClient=list.find(([id,s])=>s.clientId&&s.clientId===clientId);
  if(sameClient)return {kind:"mine",id:sameClient[0],data:sameClient[1]};

  // 다른 기기에서 최근 heartbeat가 있으면 접속중으로 판단
  const active=list.find(([id,s])=>{
    const last=s.lastSeen||s.updated||s.joined||0;
    return now()-last<ACTIVE_LIMIT_MS;
  });
  if(active)return {kind:"active",id:active[0],data:active[1]};

  // 접속중이 아닌 같은 이름 기록 중 최신 것을 이어서 하기
  const latest=list.sort((a,b)=>(b[1].updated||0)-(a[1].updated||0))[0];
  return {kind:"resume",id:latest[0],data:latest[1]};
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

  const found=findSameName(data.students||{},name);

  if(found&&found.kind==="active"){
    $("joinMsg").textContent="이미 같은 이름으로 접속 중입니다. 다른 이름을 적어주세요.";
    return;
  }

  if(found&&(found.kind==="mine"||found.kind==="resume")){
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
    render();
  });
}

function startHeartbeat(){
  clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
    if(room&&sid){
      fbPatch("/streamsRooms/"+room+"/students/"+sid,{
        lastSeen:now(),
        clientId
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

  render();
  await saveStudent(idx);
}

async function saveStudent(currentPlaced){
  await fbPatch("/streamsRooms/"+room+"/students/"+sid,{
    name,
    board,
    boardSimple:simpleBoard(board),
    currentPlaced,
    updated:now(),
    joined:now(),
    lastSeen:now(),
    clientId
  });
}

window.addEventListener("beforeunload",()=>{
  if(room&&sid){
    try{
      fetch(DB_URL+"/streamsRooms/"+room+"/students/"+sid+".json",{
        method:"PATCH",
        keepalive:true,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lastSeen:0})
      });
    }catch(e){}
  }
});

if(room&&name) join();
