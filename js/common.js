const SCORE_MAP={1:0,2:1,3:3,4:5,5:7,6:9,7:11,8:15,9:20,10:25,11:30,12:35,13:40,14:50,15:60,16:70,17:85,18:100,19:150,20:300};
function $(id){return document.getElementById(id)}
function qs(name){return new URLSearchParams(location.search).get(name)||""}
function makeCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s}
function makeDeck(){const d=[];for(let i=1;i<=10;i++)d.push(String(i));for(let i=11;i<=19;i++){d.push(String(i));d.push(String(i))}for(let i=20;i<=30;i++)d.push(String(i));d.push("★");for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d}
function scoreBoard(board){
  const arr=(board||Array(20).fill(null)).map(v=>v||null);
  let totalScore=0;
  let totalRun=0;
  let bestRun=0;

  function val(v){
    if(v==="★") return null;
    const n=Number(v);
    return Number.isNaN(n) ? null : n;
  }

  function addRun(len){
    if(len<=0) return;
    totalRun += len;
    bestRun = Math.max(bestRun, len);
    totalScore += SCORE_MAP[len] ?? 0;
  }

  let runLen=0;
  let last=-Infinity;

  for(let i=0;i<arr.length;i++){
    const v=arr[i];

    // 빈칸이면 현재 오름차순 묶음 종료
    if(v===null){
      addRun(runLen);
      runLen=0;
      last=-Infinity;
      continue;
    }

    // 조커는 현재 묶음에 포함
    if(v==="★"){
      runLen++;
      continue;
    }

    const n=val(v);

    // 감소하면 이전 묶음을 점수화하고 새 묶음 시작
    if(runLen>0 && n<last){
      addRun(runLen);
      runLen=1;
      last=n;
    }else{
      runLen++;
      last=n;
    }
  }

  addRun(runLen);
  return {run:totalRun, bestRun, score:totalScore};
}
function simpleBoard(board){return (board||Array(20).fill(null)).map(x=>x?x.value:null)}

function cleanName(v){return (v||"").trim();}
function nameKey(name){
  const s=cleanName(name);
  // Firebase path-safe key. Korean names are encoded safely.
  return encodeURIComponent(s).replace(/\./g,"%2E").replace(/\$/g,"%24").replace(/\#/g,"%23").replace(/\[/g,"%5B").replace(/\]/g,"%5D").replace(/\//g,"%2F");
}
function studentArray(students){
  return Object.keys(students||{}).map(k=>({id:k,...students[k]}));
}

// ===== STREAMS 3.3 안정화용 이름 키 =====
// Firebase path 문제를 피하기 위해 학생 이름을 base64url key로 저장합니다.
function nameKey(name){
  const s=cleanName(name);
  const b64=btoa(unescape(encodeURIComponent(s)));
  return "n_" + b64.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function scorePayloadFromBoard(board){
  const b=simpleBoard(board||Array(20).fill(null));
  const sc=scoreBoard(b);
  return {boardSimple:b, score:sc.score, run:sc.run, bestRun:sc.bestRun||sc.run};
}


// ===== STREAMS 4.0 RC3: Firebase board 정규화 =====
// Firebase RTDB가 배열을 객체 {"0":..., "1":...} 형태로 돌려주는 경우가 있어
// 모든 화면에서 board를 반드시 길이 20 배열로 바꿔 사용합니다.
function normalizeBoard(board){
  const arr=Array(20).fill(null);
  if(!board) return arr;

  if(Array.isArray(board)){
    for(let i=0;i<20;i++){
      arr[i]=board[i]??null;
    }
    return arr;
  }

  if(typeof board==="object"){
    Object.keys(board).forEach(k=>{
      const i=Number(k);
      if(Number.isInteger(i)&&i>=0&&i<20){
        arr[i]=board[k]??null;
      }
    });
    return arr;
  }

  return arr;
}

function simpleBoard(board){
  return normalizeBoard(board).map(x=>{
    if(x&&typeof x==="object"&&"value" in x) return x.value;
    return x??null;
  });
}

function scoreBoard(board){
  const arr=simpleBoard(board);
  let totalScore=0;
  let totalRun=0;
  let bestRun=0;

  function addRun(len){
    if(len<=0)return;
    totalRun+=len;
    bestRun=Math.max(bestRun,len);
    totalScore+=SCORE_MAP[len]??0;
  }

  let runLen=0;
  let last=-Infinity;

  for(let i=0;i<arr.length;i++){
    const v=arr[i];

    if(v===null||v===undefined||v===""){
      addRun(runLen);
      runLen=0;
      last=-Infinity;
      continue;
    }

    if(v==="★"){
      runLen++;
      continue;
    }

    const n=Number(v);
    if(Number.isNaN(n)){
      addRun(runLen);
      runLen=0;
      last=-Infinity;
      continue;
    }

    if(runLen>0&&n<last){
      addRun(runLen);
      runLen=1;
      last=n;
    }else{
      runLen++;
      last=n;
    }
  }

  addRun(runLen);
  return {run:totalRun,bestRun,score:totalScore};
}

function scorePayloadFromBoard(board){
  const b=simpleBoard(board);
  const sc=scoreBoard(b);
  return {boardSimple:b,score:sc.score,run:sc.run,bestRun:sc.bestRun||sc.run};
}


// STREAMS 4.1.1: 점수 포함/미포함 구간 분석
// 기존 scoreBoard/simpleBoard 함수는 건드리지 않고, 별도 함수로만 사용합니다.
function streamsAnalyzeScoreRuns(board){
  const arr = simpleBoard(board || Array(20).fill(null));
  const scored = Array(20).fill(false);
  const failed = Array(20).fill(false);

  function markRun(start, end){
    if(start < 0 || end < start) return;
    const len = end - start + 1;
    const score = SCORE_MAP[len] ?? 0;
    for(let i=start;i<=end;i++){
      if(arr[i]!==null && arr[i]!==undefined && arr[i]!== ""){
        if(score > 0) scored[i] = true;
        else failed[i] = true;
      }
    }
  }

  let start = -1;
  let last = -Infinity;

  for(let i=0;i<arr.length;i++){
    const v = arr[i];

    if(v===null || v===undefined || v===""){
      markRun(start, i-1);
      start = -1;
      last = -Infinity;
      continue;
    }

    if(start < 0){
      start = i;
      if(v !== "★"){
        const n = Number(v);
        last = Number.isNaN(n) ? -Infinity : n;
      }
      continue;
    }

    if(v === "★") continue;

    const n = Number(v);
    if(Number.isNaN(n)){
      markRun(start, i-1);
      start = -1;
      last = -Infinity;
      continue;
    }

    if(n < last){
      markRun(start, i-1);
      start = i;
      last = n;
    }else{
      last = n;
    }
  }

  markRun(start, arr.length-1);

  for(let i=0;i<arr.length;i++){
    if(arr[i]!==null && arr[i]!==undefined && arr[i]!=="" && !scored[i]){
      failed[i] = true;
    }
  }

  return {scored, failed};
}
