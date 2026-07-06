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
