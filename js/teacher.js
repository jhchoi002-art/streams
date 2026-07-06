let room=localStorage.getItem("streamsTeacherRoom")||"";
let roomData=null;
let unsubscribe=null;

async function newRoom(){
  room=makeCode();
  localStorage.setItem("streamsTeacherRoom",room);
  await fbPut("/streamsRooms/"+room,{created:Date.now(),resetToken:Date.now(),currentIndex:-1,currentValue:"-",deck:makeDeck().slice(0,20),students:{},ended:false});
  listenRoom();
}
async function resetRoom(){
  if(!room)return newRoom();
  if(!confirm("방코드는 유지하고 게임만 초기화할까요?"))return;
  const old=await fbGet("/streamsRooms/"+room);
  const students={};
  Object.entries(old?.students||{}).forEach(([id,s])=>{
    students[id]={name:s.name||id,board:Array(20).fill(null),boardSimple:Array(20).fill(null),currentPlaced:-999,joined:s.joined||Date.now(),updated:Date.now()}
  });
  await fbPut("/streamsRooms/"+room,{created:Date.now(),resetToken:Date.now(),currentIndex:-1,currentValue:"-",deck:makeDeck().slice(0,20),students,ended:false});
}
function staticRender(){
  $("topRoom").textContent=room||"-"; $("roomCode").textContent=room||"-";
  const link=location.origin+location.pathname.replace("teacher.html","student.html")+"?room="+(room||"");
  $("joinLink").textContent=link;
  $("qr").src= room ? "https://api.qrserver.com/v1/create-qr-code/?size=230x230&data="+encodeURIComponent(link) : "";
  $("displayLink").href="display.html?room="+(room||"");
}
function render(){
  staticRender();
  if(!roomData)return;
  $("topCurrent").textContent=roomData.currentValue||"-";
  const students=roomData.students||{}, keys=Object.keys(students);
  const current=roomData.currentIndex??-1;
  const done=current>=0?keys.filter(k=>students[k].currentPlaced===current).length:0;
  $("turnCount").textContent=`${done} / ${keys.length}명`;
  $("turnFill").style.width=keys.length?`${Math.round(done/keys.length*100)}%`:"0%";
  $("turnMsg").style.display=(keys.length&&done===keys.length&&current>=0)?"block":"none";
  $("drawBtn").textContent=keys.length?`다음 숫자 뽑기 (${done}/${keys.length})`:"다음 숫자 뽑기";

  $("studentList").innerHTML=keys.length?keys.sort((a,b)=>(students[a].name||a).localeCompare(students[b].name||b,"ko")).map(k=>{
    const s=students[k], doneNow=current>=0&&s.currentPlaced===current, sc=scoreBoard(s.boardSimple||[]);
    return `<div class="student-card ${doneNow?'done':''}" data-id="${k}"><div>${doneNow?'🟢':'⚪'} ${s.name||k}</div><div class="small">${doneNow?'입력 완료':'미입력'} · ${sc.run}칸 / ${sc.score}점</div></div>`;
  }).join(""):"아직 학생 없음";
  document.querySelectorAll(".student-card").forEach(el=>el.onclick=()=>openStudent(el.dataset.id));

  const ranks=keys.map(k=>{const s=students[k], sc=scoreBoard(s.boardSimple||[]);return{name:s.name||k,score:sc.score,run:sc.run}}).sort((a,b)=>b.score-a.score||b.run-a.run);
  $("rankList").innerHTML=ranks.length?ranks.map((r,i)=>`<div class="rank-row"><span>${i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${i+1}. ${r.name}</span><span>${r.run}칸 / ${r.score}점</span></div>`).join(""):"아직 학생 없음";
}
function openStudent(id){
  const s=roomData?.students?.[id]; if(!s)return;
  $("modal").classList.remove("hidden"); $("modalTitle").textContent=(s.name||id)+" 학생 판";
  renderBoard($("modalBoard"),{board:s.boardSimple||Array(20).fill(null),name:s.name||"",room,currentValue:roomData.currentValue||"-"});
}
function listenRoom(){
  if(unsubscribe)unsubscribe();
  staticRender();
  if(!room)return newRoom();
  unsubscribe=fbListen("/streamsRooms/"+room, data=>{roomData=data; if(!roomData)newRoom(); else render();});
}
$("newRoomBtn").onclick=()=>{if(confirm("정말 새 방을 만들까요? 현재 방코드가 바뀝니다."))newRoom()};
$("resetBtn").onclick=resetRoom;
$("drawBtn").onclick=async()=>{
  if(!roomData)return;
  const ni=(roomData.currentIndex??-1)+1;
  if(ni>=20)return alert("20개를 모두 뽑았습니다.");
  await fbPatch("/streamsRooms/"+room,{currentIndex:ni,currentValue:roomData.deck[ni]});
};
$("endBtn").onclick=()=>fbPatch("/streamsRooms/"+room,{ended:true});
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").classList.add("hidden")};
listenRoom();
