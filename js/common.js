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

  function isAscending(seq){
    let last=-Infinity;
    for(const v of seq){
      if(v==="★") continue;
      const n=Number(v);
      if(Number.isNaN(n)) continue;
      if(n<last) return false;
      last=n;
    }
    return true;
  }

  let i=0;
  while(i<arr.length){
    if(arr[i]===null){ i++; continue; }

    const seq=[];
    while(i<arr.length && arr[i]!==null){
      seq.push(arr[i]);
      i++;
    }

    if(isAscending(seq)){
      const len=seq.length;
      totalRun += len;
      bestRun = Math.max(bestRun,len);
      totalScore += SCORE_MAP[len] ?? 0;
    }
  }

  return {run:totalRun, bestRun, score:totalScore};
}
function simpleBoard(board){return (board||Array(20).fill(null)).map(x=>x?x.value:null)}
