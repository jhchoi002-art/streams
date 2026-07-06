const DB_URL = "https://minority-stock-game-default-rtdb.asia-southeast1.firebasedatabase.app";
async function fbGet(path){
  const r = await fetch(DB_URL + path + ".json?t=" + Date.now());
  return await r.json();
}
async function fbPut(path, data){
  return fetch(DB_URL + path + ".json", {
    method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
  });
}
async function fbPatch(path, data){
  return fetch(DB_URL + path + ".json", {
    method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)
  });
}
function fbListen(path, cb){
  const url = DB_URL + path + ".json";
  const es = new EventSource(url);
  es.addEventListener("put", e=>{ try{ cb(JSON.parse(e.data).data); }catch(err){} });
  es.addEventListener("patch", e=>{ refresh(); });
  async function refresh(){ cb(await fbGet(path)); }
  refresh();
  return ()=>es.close();
}
