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

// 3.1 Beta Fix:
// Firebase REST Streaming이 브라우저/학교망에서 가끔 이벤트를 놓치는 경우가 있어서
// SSE와 짧은 폴링을 함께 사용해 교사용/전자칠판 반영을 안정화합니다.
function fbListen(path, cb){
  let closed=false;
  let es=null;
  let lastJson=null;

  async function refresh(){
    if(closed) return;
    const data = await fbGet(path);
    const json = JSON.stringify(data);
    if(json !== lastJson){
      lastJson = json;
      cb(data);
    }
  }

  try{
    es = new EventSource(DB_URL + path + ".json");
    es.addEventListener("put", refresh);
    es.addEventListener("patch", refresh);
    es.onerror = () => {};
  }catch(e){}

  refresh();
  const timer = setInterval(refresh, 700);

  return ()=>{
    closed=true;
    clearInterval(timer);
    if(es) es.close();
  };
}
