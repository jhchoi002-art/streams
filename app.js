const DB='https://minority-stock-game-default-rtdb.asia-southeast1.firebasedatabase.app';
const MAX_TURNS=20;
const scoreMap={1:0,2:1,3:3,4:5,5:7,6:9,7:11,8:15,9:20,10:25,11:30,12:35,13:40,14:50,15:60,16:70,17:85,18:100,19:150,20:300};
function qs(k){return new URL(location.href).searchParams.get(k)||''}
function id(x){return document.getElementById(x)}
function code(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
function uid(){return localStorage.streamsUid||(localStorage.streamsUid='S'+Math.random().toString(36).slice(2)+Date.now().toString(36))}
function roomPath(room){return `${DB}/streamsRooms/${room}.json`}
async function getRoom(room){try{let r=await fetch(roomPath(room));return await r.json()}catch(e){return null}}
async function putRoom(room,data){return fetch(roomPath(room),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
async function patchRoom(room,data){return fetch(roomPath(room),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
async function putStudent(room,sid,data){return fetch(`${DB}/streamsRooms/${room}/students/${sid}.json`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
async function patchStudent(room,sid,data){return fetch(`${DB}/streamsRooms/${room}/students/${sid}.json`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
function makeDeck(){let d=[];for(let n=1;n<=10;n++)d.push(String(n));for(let n=11;n<=19;n++){d.push(String(n));d.push(String(n));}for(let n=20;n<=30;n++)d.push(String(n));d.push('★');return d}
function shuffle(arr){arr=[...arr];for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function calc(values){let best=0,cur=0,last=-Infinity;for(const v of values){if(!v){cur=0;last=-Infinity;continue}if(v==='★'){cur++;continue}let n=Number(v);if(n>=last){cur++;last=n}else{cur=1;last=n}best=Math.max(best,cur)}best=Math.max(best,cur);return {best,score:scoreMap[best]??0}}
function displayValue(v){return v||''}
function createBoard(container,opts={}){container.innerHTML=`<div class="board">
  <div class="path top" data-start="0"></div><div class="path vertical" data-start="5"></div><div class="path bottom" data-start="14"></div>
  <div class="score-card"><div class="score-title">점수표</div><div class="score-grid"><b>오름차순</b><b>점수</b><b>오름차순</b><b>점수</b>${[1,2,3,4,5,6,7,8,9,10].map((n,i)=>`<span>${n}칸</span><strong>${scoreMap[n]}</strong><span>${n+10}칸</span><strong>+${scoreMap[n+10]}</strong>`).join('')}</div></div>
  <div class="logo"><div>STREAMS</div><strong>스트림스</strong></div>
  <div class="namebox"><div>이름</div><div class="playerName"></div><div>점수</div><div class="playerScore">0점</div></div>
  <div class="rulebox"><div>1. 다음 숫자 뽑기<br>전에 꼭 쓰기</div><div>2. 이웃한 같은<br>숫자는 오름차순 OK</div><div>3. 다음 숫자가<br>나오면 수정 불가</div><strong>1~10</strong><strong>11~19<br>11~19</strong><strong>20~30 ★</strong></div>
</div>`;
 const top=container.querySelector('.top'), vert=container.querySelector('.vertical'), bot=container.querySelector('.bottom');
 for(let i=0;i<5;i++)top.appendChild(cell(i,'right'));
 for(let i=5;i<14;i++)vert.appendChild(cell(i,'down'));
 for(let i=14;i<20;i++)bot.appendChild(cell(i,'right'));
 function cell(i,dir){let d=document.createElement('button');d.className='cell '+dir;d.dataset.i=i;d.type='button';d.innerHTML='<span></span>';return d}
 return {
   setName(n){container.querySelector('.playerName').textContent=n||''},
   setScore(s){container.querySelector('.playerScore').textContent=(s||0)+'점'},
   setValues(vals=[]){container.querySelectorAll('.cell').forEach(c=>{let v=vals[+c.dataset.i];c.querySelector('span').textContent=displayValue(v&&v.value?v.value:v)})},
   onCell(fn){container.querySelectorAll('.cell').forEach(c=>c.onclick=()=>fn(+c.dataset.i,c))},
   markActive(turn){container.querySelectorAll('.cell').forEach(c=>c.classList.remove('active'));}
 }
}
