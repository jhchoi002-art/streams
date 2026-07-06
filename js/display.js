const room=qs("room");
$("displayRoom").textContent=room||"-";
if(room){
  fbListen("/streamsRooms/"+room, data=>{
    if(!data)return;
    $("displayNumber").textContent=data.currentValue||"-";
    $("displayStudents").textContent="참여 학생 "+Object.keys(data.students||{}).length+"명";
  });
}
