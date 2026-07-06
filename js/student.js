let room=qs("room");
let name="";
let key="";
let roomData=null;
let board=Array(20).fill(null);
let currentPlaced=-999;
let resetToken="";
let unsubscribe=null;
let onlineTimer=null;

let clientId=localStorage.getItem("streamsClientId")||("c_"+Math.random().toString(36).slice(2)+Date.now().toString(36));
localStorage.setItem("streamsClientId",clientId);

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

    if(existing && existing.board){
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

    await fbPatch(studentPath(),{
      name,
      online:true,
      clientId
    });

    localStorage.setItem("streamsName",name);
    localStorage.setItem("streamsRoom",room);

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

function startOnlineSignal(){
  clearInterval(onlineTimer);
  onlineTimer=setInterval(()=>{
    if(room&&key){
      fbPatch(studentPath(),{name,online:true,clientId});
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
    setJoinMsg("화면 표시 중 오류가 발생했습니다.");
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
