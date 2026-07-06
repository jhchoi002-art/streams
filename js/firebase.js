const DB_URL = "https://minority-stock-game-default-rtdb.asia-southeast1.firebasedatabase.app";

async function fbGet(path){
  const r = await fetch(DB_URL + path + ".json?t=" + Date.now());
  return await r.json();
}

async function fbPut(path, data){
  return fetch(DB_URL + path + ".json", {
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data)
  });
}

async function fbPatch(path, data){
  return fetch(DB_URL + path + ".json", {
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(data)
  });
}

// 호환용. 핵심 화면은 직접 폴링을 사용합니다.
function fbListen(path, cb){
  let closed=false;
  async function refresh(){
    if(closed)return;
    cb(await fbGet(path));
  }
  refresh();
  const timer=setInterval(refresh,700);
  return ()=>{closed=true;clearInterval(timer);};
}
