let room=qs("room");
let sid=localStorage.getItem("streamsSid")||("s"+Math.random().toString(36).slice(2));
localStorage.setItem("streamsSid",sid);
let name=localStorage.getItem("streamsName")||"";
let roomData=null, board=Array(20).fill(null), resetToken="", unsubscribe=null;

$("roomInput").value=room;
$("nameInput").value=name;

$("joinBtn").onclick=join;

async function join(){
  room=$("roomInput").value.trim().toUpperCase();
  name=$("nameInput").value.trim();
  if(!room||!name)return $("joinMsg").textContent="방코드와 이름을 입력하세요.";
  const data=await fbGet("/streamsRooms/"+room);
  if(!data)return $("joinMsg").textContent="방을 찾을 수 없습니다.";
  localStorage.setItem("streamsName",name);
  const old=await fbGet("/streamsRooms/"+room+"/students/"+sid);
  board=old?.board||Array(20).fill(null);
  resetToken=String(data.resetToken||"");
  await saveStudent(-999);
  $("joinScreen").classList.add("hidden");
  $("gameScreen").classList.remove("hidden");
  history.replaceState(null,"","student.html?room="+room);
  listenRoom();
}
function listenRoom(){
  if(unsubscribe)unsubscribe();
  unsubscribe=fbListen("/streamsRooms/"+room, async data=>{
    if(!data)return;
    const newToken=String(data.resetToken||"");
    if(resetToken && newToken!==resetToken){board=Array(20).fill(null); await saveStudent(-999);}
    resetToken=newToken;
    roomData=data;
    render();
  });
}
function currentCell(){
  const idx=roomData?.currentIndex;
  if(idx==null||idx<0)return null;
  for(let i=0;i<20;i++) if(board[i]?.drawIndex===idx)return i;
  return null;
}
function render(){
  const idx=roomData?.currentIndex??-1;
  renderBoard($("gameScreen"),{
    board:simpleBoard(board), room, name, currentValue:roomData?.currentValue||"-",
    currentCell:currentCell(),
    status:idx>=0?"현재 숫자를 빈칸에 놓으세요. 다음 숫자가 나오기 전까지 이동할 수 있습니다.":"다음 숫자를 기다리는 중입니다.",
    onCell:place
  });
}
async function place(cell){
  if(!roomData||roomData.currentIndex<0)return;
  const idx=roomData.currentIndex, val=roomData.currentValue;
  if(board[cell]&&board[cell].drawIndex!==idx)return alert("이미 이전 숫자가 놓인 칸입니다.");
  board=board.map(x=>x&&x.drawIndex===idx?null:x);
  board[cell]={drawIndex:idx,value:val};
  render();
  await saveStudent(idx);
}
async function saveStudent(currentPlaced){
  await fbPatch("/streamsRooms/"+room+"/students/"+sid,{name,board,boardSimple:simpleBoard(board),currentPlaced,updated:Date.now(),joined:Date.now()});
}
if(room&&name) join();
