function cellStyle(i){
  const topX=65, topY=44, topGap=110;
  const vX=515, vY=105, vGap=46;
  const bottomX=610, bottomY=520, bottomGap=102;
  if(i<5)return{cls:"h",x:topX+i*topGap,y:topY};
  if(i<15)return{cls:"v",x:vX,y:vY+(i-5)*vGap};
  return{cls:"h",x:bottomX+(i-15)*bottomGap,y:bottomY};
}
function renderScoreTable(){
 return `<div class="scorebox"><div class="title">점수표</div><div class="score-columns">
 <table><tr><th>오름차순</th><th>점수</th></tr>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<tr><td>${n}칸</td><td>${SCORE_MAP[n]}</td></tr>`).join("")}</table>
 <table><tr><th>오름차순</th><th>점수</th></tr>${[11,12,13,14,15,16,17,18,19,20].map(n=>`<tr><td>${n}칸</td><td>+${SCORE_MAP[n]}</td></tr>`).join("")}</table>
 </div></div>`;
}
function renderBoard(container, opt={}){
 const board=opt.board||Array(20).fill(null), name=opt.name||"", room=opt.room||"", current=opt.currentValue||"-";
 const sc=scoreBoard(board), currentCell=opt.currentCell;
 container.innerHTML=`<div class="student-page"><header class="topbar"><div>방코드 : ${room}</div><div>현재 숫자 : <span class="yellow">${current}</span></div><div>${name}</div></header>
 <div class="board-stage"><div class="game-board">${renderScoreTable()}
 <div class="logo"><div class="en">STREAMS</div><div class="kr">스트림스</div></div>
 <div class="info"><div class="row"><div class="lab">이름</div><div class="val">${name}</div></div><div class="row"><div class="lab">점수</div><div class="val">${sc.score}점</div></div></div>
 <div class="rules"><div>1. 다음 숫자 뽑기<br>전에 꼭 쓰기</div><div>2. 이웃한 같은<br>숫자는 오름차순 OK</div><div>3. 다음 숫자가<br>나오면 수정 불가</div><div>1~10</div><div>11~19<br>11~19</div><div>20~30 ★</div></div>
 ${Array.from({length:20}).map((_,i)=>{const s=cellStyle(i), val=board[i]||""; return `<div class="cell ${s.cls} ${val?'filled':''} ${currentCell===i?'current':''}" data-idx="${i}" style="left:${s.x}px;top:${s.y}px"><div class="shape"></div>${val}</div>`}).join("")}
 </div></div><footer class="footer"><div>${opt.status||"다음 숫자를 기다리는 중입니다."}</div><div class="score">오름차순 ${sc.run}칸 / ${sc.score}점</div></footer></div>`;
 const b=container.querySelector(".game-board");
 function fit(){ if(!b)return; const scale=Math.min(1.02,(window.innerWidth-20)/1180,(window.innerHeight-150)/620); b.style.transform=`scale(${scale})`; }
 fit(); window.addEventListener("resize",fit);
 if(opt.onCell) container.querySelectorAll(".cell").forEach(el=>el.onclick=()=>opt.onCell(Number(el.dataset.idx)));
}

function renderBoardOnly(container, opt={}){
 const board=opt.board||Array(20).fill(null);
 const name=opt.name||"";
 const room=opt.room||"";
 const current=opt.currentValue||"-";
 const sc=scoreBoard(board);
 container.innerHTML=`<div class="board-only-wrap"><div class="board-only-scale"><div class="game-board">${renderScoreTable()}
 <div class="logo"><div class="en">STREAMS</div><div class="kr">스트림스</div></div>
 <div class="info"><div class="row"><div class="lab">이름</div><div class="val">${name}</div></div><div class="row"><div class="lab">점수</div><div class="val">${sc.score}점</div></div></div>
 <div class="rules"><div>1. 다음 숫자 뽑기<br>전에 꼭 쓰기</div><div>2. 이웃한 같은<br>숫자는 오름차순 OK</div><div>3. 다음 숫자가<br>나오면 수정 불가</div><div>1~10</div><div>11~19<br>11~19</div><div>20~30 ★</div></div>
 ${Array.from({length:20}).map((_,i)=>{const s=cellStyle(i), val=board[i]||""; return `<div class="cell ${s.cls} ${val?'filled':''}" style="left:${s.x}px;top:${s.y}px"><div class="shape"></div>${val}</div>`}).join("")}
 </div></div></div>`;
}


// STREAMS 4.1.3 SAFE SCORE HIGHLIGHT
// 기존 보드 렌더링은 그대로 두고, 렌더링 후 DOM에만 색상 클래스를 추가합니다.
function streamsSimpleValuesForHighlight(rawBoard){
  const arr = Array(20).fill(null);
  const src = Array.isArray(rawBoard) ? rawBoard : [];
  for(let i=0;i<20;i++){
    const v = src[i];
    if(v && typeof v === "object" && "value" in v) arr[i] = v.value;
    else if(v !== undefined) arr[i] = v;
  }
  return arr;
}

function streamsAnalyzeHighlight(rawBoard){
  const arr = streamsSimpleValuesForHighlight(rawBoard);
  const scored = Array(20).fill(false);
  const failed = Array(20).fill(false);

  function mark(start, end){
    if(start < 0 || end < start) return;
    const len = end - start + 1;
    const score = (typeof SCORE_MAP !== "undefined" ? SCORE_MAP[len] : 0) || 0;
    for(let i=start;i<=end;i++){
      if(arr[i] !== null && arr[i] !== undefined && arr[i] !== ""){
        if(score > 0) scored[i] = true;
        else failed[i] = true;
      }
    }
  }

  let start = -1;
  let last = -Infinity;

  for(let i=0;i<arr.length;i++){
    const v = arr[i];

    if(v === null || v === undefined || v === ""){
      mark(start, i-1);
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
      mark(start, i-1);
      start = -1;
      last = -Infinity;
      continue;
    }

    if(n < last){
      mark(start, i-1);
      start = i;
      last = n;
    }else{
      last = n;
    }
  }

  mark(start, arr.length-1);

  for(let i=0;i<20;i++){
    if(arr[i] !== null && arr[i] !== undefined && arr[i] !== "" && !scored[i]){
      failed[i] = true;
    }
  }

  return {scored, failed};
}

function streamsApplyHighlight(container, rawBoard){
  try{
    if(!container) return;
    const result = streamsAnalyzeHighlight(rawBoard);
    const cells = Array.from(container.querySelectorAll(".cell"));
    cells.forEach((cell, i)=>{
      cell.classList.remove("scored","failed");
      if(result.scored[i]) cell.classList.add("scored");
      else if(result.failed[i]) cell.classList.add("failed");
    });
    streamsApplyBreakLines(container, rawBoard);
  }catch(e){
    console.warn("highlight skipped", e);
  }
}

// 기존 renderBoard를 감싸되, 실패해도 기존 화면은 유지되게 합니다.
if(typeof renderBoard === "function" && !window.__streamsHighlightWrapped){
  window.__streamsHighlightWrapped = true;
  const __streamsOriginalRenderBoard = renderBoard;
  renderBoard = function(container, opt={}){
    __streamsOriginalRenderBoard(container, opt);
    streamsApplyHighlight(container, opt.board || Array(20).fill(null));
  };
}


// STREAMS 4.1.4: 오름차순이 끊긴 지점에 빨간 표시선을 추가
function streamsFindBreaksForHighlight(rawBoard){
  const arr = streamsSimpleValuesForHighlight(rawBoard);
  const breaks = [];

  let prevIndex = -1;
  let last = -Infinity;

  for(let i=0;i<arr.length;i++){
    const v = arr[i];

    if(v === null || v === undefined || v === ""){
      prevIndex = -1;
      last = -Infinity;
      continue;
    }

    if(v === "★"){
      prevIndex = i;
      continue;
    }

    const n = Number(v);
    if(Number.isNaN(n)){
      prevIndex = -1;
      last = -Infinity;
      continue;
    }

    if(prevIndex >= 0 && n < last){
      breaks.push({from: prevIndex, to: i});
    }

    prevIndex = i;
    last = n;
  }

  return breaks;
}

function streamsApplyBreakLines(container, rawBoard){
  try{
    if(!container) return;

    // 이전 표시 제거
    container.querySelectorAll(".break-mark").forEach(el=>el.remove());
    container.querySelectorAll(".cell.break-before-vertical,.cell.break-before-horizontal").forEach(el=>{
      el.classList.remove("break-before-vertical","break-before-horizontal");
    });

    const cells = Array.from(container.querySelectorAll(".cell"));
    const breaks = streamsFindBreaksForHighlight(rawBoard);

    breaks.forEach(b=>{
      const from = cells[b.from];
      const to = cells[b.to];
      if(!from || !to) return;

      // getBoundingClientRect 대신 offset 좌표를 사용합니다.
      // 모달/전자칠판에서 보드가 scale 되어도 위치가 틀어지지 않습니다.
      const dx = (to.offsetLeft || 0) - (from.offsetLeft || 0);
      const dy = (to.offsetTop || 0) - (from.offsetTop || 0);

      if(Math.abs(dx) >= Math.abs(dy)){
        // 좌우로 이어진 칸 사이가 끊긴 경우: 도착 칸 왼쪽/오른쪽에 세로 빨간선
        to.classList.add("break-before-vertical");
      }else{
        // 위아래로 이어진 칸 사이가 끊긴 경우: 도착 칸 위쪽에 가로 빨간선
        to.classList.add("break-before-horizontal");
      }
    });
  }catch(e){
    console.warn("break line skipped", e);
  }
}

(function(){
 if(window.__streamsLastMarker) return;
 window.__streamsLastMarker=true;
 const old=streamsApplyHighlight;
 streamsApplyHighlight=function(container,rawBoard){
   old(container,rawBoard);
   try{
     container.querySelectorAll('.last-scored').forEach(e=>e.classList.remove('last-scored'));
     const r=streamsAnalyzeHighlight(rawBoard);
     const cells=[...container.querySelectorAll('.cell')];
     let last=-1;
     r.scored.forEach((v,i)=>{if(v) last=i;});
     if(last>=0 && cells[last]) cells[last].classList.add('last-scored');
   }catch(e){}
 }
})();
