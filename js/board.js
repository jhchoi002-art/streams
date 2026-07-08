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
