// ═══════════════════════════════════════════════════════════════
// PICKLE FRIENDS — app.js
// Courts: A=top, B, C, D... (bottom)
// Players: auto-numbered #1, #2, #3...
// ═══════════════════════════════════════════════════════════════

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b};
const fmt=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}};

// Court letter: index 0 = top court = "A"
const courtLetter = (courtNum, total) => String.fromCharCode(64 + total - courtNum + 1);
// Reverse: A=top means court A has the highest courtNum internally
const courtLetterFromIdx = (idx, total) => String.fromCharCode(65 + idx);
// For display: court with internal number `n` out of `total`, where total=top
const cLtr = (n, total) => String.fromCharCode(65 + (total - n));

// Player number display
const pNum = (player, ladder) => {
  if (!player || !ladder) return '?';
  const idx = ladder.players.findIndex(p => p.id === player.id);
  return idx >= 0 ? idx + 1 : '?';
};
const pTag = (player, ladder) => {
  if (!player) return '?';
  return `#${pNum(player, ladder)}`;
};

// ─── STATE ────────────────────────────────────────────────────
let ladders=[],activeLadderId=null,activeSessionId=null,isAdmin=false,view='dashboard',tab='overview';
let timer=0,timerOn=false,timerInterval=null,pinEntry='',editingPlayerId=null;

// ─── API ──────────────────────────────────────────────────────
async function apiList(){try{const r=await fetch('/api?action=list');return(await r.json()).ladders||[]}catch(e){console.error(e);return[]}}
async function apiSave(l){try{const r=await fetch('/api?action=save',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':l.adminPin||''},body:JSON.stringify({ladder:l})});if(!r.ok)throw new Error((await r.json()).error);return await r.json()}catch(e){console.error(e);return null}}
async function apiDel(id,pin){try{return await(await fetch(`/api?action=delete&id=${id}`,{method:'DELETE',headers:{'X-Admin-Pin':pin||''}})).json()}catch{return null}}

function gL(){return ladders.find(l=>l.id===activeLadderId)||null}
function gS(){const l=gL();return l?.seasons.find(s=>s.id===l.activeSeason)||null}
function gSS(){const s=gS();return s?.sessions.find(ss=>ss.id===activeSessionId)||null}
async function save(l){const i=ladders.findIndex(x=>x.id===l.id);if(i>=0)ladders[i]=l;else ladders.push(l);await apiSave(l);render()}

// ─── LINEUP ───────────────────────────────────────────────────
function genR1(players,nC){const s=shuffle(players);return{courts:Array.from({length:nC},(_,c)=>({court:c+1,team1:[s[c*4]||null,s[c*4+1]||null],team2:[s[c*4+2]||null,s[c*4+3]||null],score:null})),completed:false}}
function genNR(prev,nC){
  const mvs=[];
  prev.courts.forEach(c=>{
    const all=[...(c.team1||[]),...(c.team2||[])].filter(Boolean);
    if(!c.score||c.score.winner==='T'){all.forEach(p=>mvs.push({p,to:c.court}));return}
    // Winners move UP = higher court number (toward A)
    const w=c.score.winner==='A'?c.team1:c.team2,lo=c.score.winner==='A'?c.team2:c.team1;
    w.filter(Boolean).forEach(p=>mvs.push({p,to:Math.min(nC,c.court+1)}));
    lo.filter(Boolean).forEach(p=>mvs.push({p,to:Math.max(1,c.court-1)}));
  });
  const bk={};for(let i=1;i<=nC;i++)bk[i]=[];
  mvs.forEach(m=>bk[m.to]?.push(m.p));
  const flat=[];for(let i=1;i<=nC;i++)flat.push(...shuffle(bk[i]));
  const pp={};prev.courts.forEach(c=>{[c.team1,c.team2].forEach(t=>{if(t[0]&&t[1]){pp[t[0].id]=t[1].id;pp[t[1].id]=t[0].id}})});
  const courts=[];let idx=0;
  for(let c=0;c<nC;c++){const g=flat.slice(idx,idx+4);idx+=4;let t1=[g[0],g[2]],t2=[g[1],g[3]];if(pp[t1[0]?.id]===t1[1]?.id||pp[t2[0]?.id]===t2[1]?.id){t1=[g[0],g[3]];t2=[g[1],g[2]]}courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}
  return{courts,completed:false};
}

// ─── STATS ────────────────────────────────────────────────────
function calcStats(sessions,players){
  const s={};players.forEach(p=>{s[p.id]={id:p.id,name:p.name,gender:p.gender,w:0,l:0,t:0,pf:0,pa:0,best:0,attended:0,courtHist:[],roundRes:[],sessRes:[]}});
  sessions.forEach((sess,si)=>{const played=new Set();const sw={},sl={},spf={},spa={};
    sess.rounds.forEach((round,ri)=>{round.courts.forEach(c=>{if(!c.score)return;const{t1,t2,winner}=c.score;const tied=winner==='T';
      [[c.team1,t1,t2,winner==='A'],[c.team2,t2,t1,winner==='B']].forEach(([team,sc,al,won])=>{team.filter(Boolean).forEach(p=>{if(!s[p.id])return;played.add(p.id);s[p.id].pf+=sc;s[p.id].pa+=al;if(tied)s[p.id].t++;else if(won)s[p.id].w++;else s[p.id].l++;s[p.id].best=Math.max(s[p.id].best,c.court);s[p.id].courtHist.push({round:ri+1,court:c.court,session:si});s[p.id].roundRes.push({round:ri+1,court:c.court,won,tied,pf:sc,pa:al});sw[p.id]=(sw[p.id]||0)+(won?1:0);sl[p.id]=(sl[p.id]||0)+(won||tied?0:1);spf[p.id]=(spf[p.id]||0)+sc;spa[p.id]=(spa[p.id]||0)+al})})});
    played.forEach(id=>{if(s[id]){s[id].attended++;s[id].sessRes.push({date:sess.date,w:sw[id]||0,l:sl[id]||0,pf:spf[id]||0,pa:spa[id]||0})}})});
  return Object.values(s).sort((a,b)=>b.w!==a.w?b.w-a.w:(b.pf-b.pa)-(a.pf-a.pa));
}

// ─── TIMER ────────────────────────────────────────────────────
function startTimer(){const ss=gSS();if(!ss)return;if(timer===0)timer=ss.config.roundMin*60;timerOn=true;clearInterval(timerInterval);timerInterval=setInterval(()=>{timer--;if(timer<=0){timer=0;timerOn=false;clearInterval(timerInterval)}renderTimer()},1000);render()}
function pauseTimer(){timerOn=false;clearInterval(timerInterval);render()}
function endTimer(){timerOn=false;clearInterval(timerInterval);timer=0;render()}
function resetTimer(ss){clearInterval(timerInterval);timerOn=false;timer=(ss?.config?.roundMin||12)*60}
function renderTimer(){const el=document.getElementById('td');if(el){el.textContent=fmt(timer);el.style.color=timer<=60?'#dc2626':'#fff'}const bar=document.getElementById('tf');const ss=gSS();if(bar&&ss){bar.style.width=(timer/(ss.config.roundMin*60))*100+'%';bar.style.background=timer<=60?'#dc2626':timer<=180?'#d4a030':'#1a7a5c'}}

// ─── PIN ──────────────────────────────────────────────────────
function openPin(){pinEntry='';document.getElementById('pinModal').style.display='flex';renderPD()}
function closePin(){pinEntry='';document.getElementById('pinModal').style.display='none';document.getElementById('pinErr').textContent=''}
function pinPress(d){if(pinEntry.length>=4)return;pinEntry+=d;renderPD();if(pinEntry.length===4)setTimeout(checkPin,150)}
function pinDel(){pinEntry=pinEntry.slice(0,-1);renderPD();document.getElementById('pinErr').textContent=''}
function renderPD(){for(let i=0;i<4;i++){const d=document.getElementById('pd'+i);if(d){d.style.background=i<pinEntry.length?'#1a7a5c':'transparent';d.style.borderColor=i<pinEntry.length?'#1a7a5c':'#a3b8ac'}}}
function checkPin(){const l=gL();if(l&&pinEntry===l.adminPin){isAdmin=true;closePin();render()}else{document.getElementById('pinErr').textContent='Incorrect PIN';pinEntry='';renderPD();setTimeout(()=>{const e=document.getElementById('pinErr');if(e)e.textContent=''},2000)}}
function lockAdmin(){isAdmin=false;render()}

// ─── EDIT PLAYER MODAL ───────────────────────────────────────
function openEditPlayer(pid){
  const l=gL();if(!l)return;const p=l.players.find(x=>x.id===pid);if(!p)return;
  editingPlayerId=pid;
  document.getElementById('edName').value=p.name;
  document.getElementById('edGender').value=p.gender;
  document.getElementById('editModal').classList.add('open');
}
function closeEditModal(){document.getElementById('editModal').classList.remove('open');editingPlayerId=null}
async function saveEditPlayer(){
  const l=gL();if(!l||!editingPlayerId)return;
  const p=l.players.find(x=>x.id===editingPlayerId);if(!p)return;
  p.name=document.getElementById('edName').value.trim()||p.name;
  p.gender=document.getElementById('edGender').value;
  closeEditModal();await save(l);
}

// ─── ACTIONS ──────────────────────────────────────────────────
async function createLadder(){const n=document.getElementById('fLN')?.value?.trim();const p=document.getElementById('fLP')?.value?.trim()||'1234';if(!n)return;const l={id:uid(),name:n,players:[],seasons:[],activeSeason:null,adminPin:p,createdAt:Date.now()};await save(l);activeLadderId=l.id;isAdmin=true;view='dashboard';tab='overview';render()}
async function deleteLadderAction(){const l=gL();if(!l||!confirm('Delete this ladder permanently?'))return;await apiDel(l.id,l.adminPin);ladders=ladders.filter(x=>x.id!==l.id);activeLadderId=ladders[0]?.id||null;isAdmin=false;view='dashboard';render()}
async function createSeason(){const n=document.getElementById('fSN')?.value?.trim();const l=gL();if(!l||!n)return;const s={id:uid(),name:n,sessions:[],createdAt:Date.now()};l.seasons.push(s);l.activeSeason=s.id;await save(l);view='dashboard';tab='overview';render()}
async function createSessionAction(){const l=gL();const s=gS();if(!l||!s)return;const ss={id:uid(),date:document.getElementById('fSD')?.value||new Date().toISOString().split('T')[0],config:{courts:parseInt(document.getElementById('fSC')?.value)||4,rounds:parseInt(document.getElementById('fSR')?.value)||6,roundMin:parseInt(document.getElementById('fSM')?.value)||12,scoreMode:document.getElementById('fSO')?.value||'points',place:document.getElementById('fSP')?.value||''},rounds:[],currentRound:-1,started:false,finished:false,createdAt:Date.now()};s.sessions.push(ss);await save(l);activeSessionId=ss.id;view='session';tab='roster';render()}
async function addPlayer(){const l=gL();if(!l)return;const n=document.getElementById('fPN')?.value?.trim();const g=document.getElementById('fPG')?.value||'M';if(!n)return;l.players.push({id:uid(),name:n,gender:g});document.getElementById('fPN').value='';await save(l)}
async function removePlayer(pid){const l=gL();if(!l||!confirm('Remove this player?'))return;l.players=l.players.filter(p=>p.id!==pid);await save(l)}
async function startSessionAction(){const l=gL();const ss=gSS();if(!l||!ss||l.players.length<4)return alert('Need at least 4 players.');ss.rounds=[genR1(l.players,ss.config.courts)];ss.currentRound=0;ss.started=true;resetTimer(ss);tab='play';await save(l)}
async function submitScore(ci,f,v){const l=gL();const ss=gSS();if(!l||!ss)return;const ct=ss.rounds[ss.currentRound].courts[ci];const sc=ct.score||{t1:0,t2:0,winner:'T'};sc[f]=parseInt(v)||0;sc.winner=sc.t1>sc.t2?'A':sc.t2>sc.t1?'B':'T';ct.score=sc;await save(l)}
async function setWL(ci,w){const l=gL();const ss=gSS();if(!l||!ss)return;ss.rounds[ss.currentRound].courts[ci].score={t1:w==='A'?1:0,t2:w==='B'?1:0,winner:w};await save(l)}
async function nextRound(){const l=gL();const ss=gSS();if(!l||!ss)return;const un=ss.rounds[ss.currentRound].courts.filter(c=>!c.score);if(un.length&&!confirm(`${un.length} court(s) unscored. Continue?`))return;if(ss.currentRound>=ss.config.rounds-1){ss.finished=true;tab='stats';await save(l);return}ss.rounds.push(genNR(ss.rounds[ss.currentRound],ss.config.courts));ss.currentRound++;resetTimer(ss);await save(l)}
async function reshuffleRound(){const l=gL();const ss=gSS();if(!l||!ss||!confirm('Reshuffle? Scores cleared.'))return;const all=[];ss.rounds[ss.currentRound].courts.forEach(c=>[...c.team1,...c.team2].filter(Boolean).forEach(p=>all.push(p)));ss.rounds[ss.currentRound]=genR1(all,ss.config.courts);await save(l)}

function go(v,t){view=v;if(t)tab=t;render()}
function selectLadder(id){activeLadderId=id;activeSessionId=null;isAdmin=false;view='dashboard';tab='overview';render()}
function openSession(id){activeSessionId=id;view='session';tab='play';render()}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function render(){
  const app=document.getElementById('app');
  const l=gL(),s=gS(),ss=gSS();
  const stats=(s&&l)?calcStats(s.sessions,l.players):[];
  const sStats=ss?calcStats([ss],l?.players||[]):[];
  let h='';

  // Header
  h+=`<header class="hdr"><div class="hdr-row"><div class="hdr-left"><div class="hdr-logo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><div><h1 class="hdr-title">Pickle Friends</h1>${s?`<div class="hdr-sub">${s.name}</div>`:''}</div></div><div class="hdr-right">${ladders.length>1?`<select class="hdr-sel" onchange="selectLadder(this.value)">${ladders.map(x=>`<option value="${x.id}"${x.id===activeLadderId?' selected':''}>${x.name}</option>`).join('')}</select>`:''}
  <button class="ib${isAdmin?' on':''}" onclick="${isAdmin?'lockAdmin()':'openPin()'}" title="${isAdmin?'Lock':'Admin'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>${!isAdmin?'<line x1="12" y1="15" x2="12" y2="18"/>':''}</svg></button>
  ${isAdmin?`<button class="ib gf" onclick="go('newLadder')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`:''}</div></div>
  ${isAdmin?'<div class="admin-bar">ADMIN MODE — <span onclick="lockAdmin()" style="cursor:pointer;text-decoration:underline;opacity:.7">Lock</span></div>':''}
  ${view==='session'?`<div class="tabs">${['Play','Roster','Stats','Rules'].map(t=>`<button class="tab${tab===t.toLowerCase()?' active':''}" onclick="tab='${t.toLowerCase()}';render()">${t}</button>`).join('')}<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go('dashboard','overview')">← Back</button></div>`:''}
  ${view==='dashboard'&&s?`<div class="tabs">${['Overview','Stats','Players'].map(t=>`<button class="tab${tab===t.toLowerCase()?' active':''}" onclick="tab='${t.toLowerCase()}';render()">${t}</button>`).join('')}</div>`:''}
  </header>`;

  h+='<div class="content">';

  // Forms
  if(view==='newLadder')h+=`<div class="card fu"><h2 class="card-t">Create Ladder</h2><p class="subtext" style="margin-bottom:16px">A ladder holds players, seasons, and all match data.</p><input id="fLN" class="inp" placeholder="Ladder name" autofocus><div style="margin-top:10px"><label class="lbl">Admin PIN (4 digits)</label><input id="fLP" class="inp" type="text" maxlength="4" placeholder="1234" style="letter-spacing:8px;text-align:center;font-size:1.1rem;font-family:'Sora',sans-serif"></div><div class="btn-row"><button class="bg" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createLadder()">Create</button></div></div>`;
  else if(view==='newSeason')h+=`<div class="card fu"><h2 class="card-t">New Season</h2><input id="fSN" class="inp" placeholder="Season name (e.g. Summer 2026)" autofocus><div class="btn-row"><button class="bg" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createSeason()">Create Season</button></div></div>`;
  else if(view==='newSession'){const td=new Date().toISOString().split('T')[0];h+=`<div class="card fu"><h2 class="card-t">New Session</h2><div style="display:flex;flex-direction:column;gap:10px"><input id="fSD" class="inp" type="date" value="${td}"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Courts</label><select id="fSC" class="inp">${[2,3,4,5,6,7,8,10,12].map(n=>`<option value="${n}"${n===4?' selected':''}>${n}</option>`).join('')}</select></div><div><label class="lbl">Rounds</label><select id="fSR" class="inp">${[3,4,5,6,7,8,10,12].map(n=>`<option value="${n}"${n===6?' selected':''}>${n}</option>`).join('')}</select></div><div><label class="lbl">Round Time</label><select id="fSM" class="inp">${[8,10,12,15,20].map(n=>`<option value="${n}"${n===12?' selected':''}>${n} min</option>`).join('')}</select></div><div><label class="lbl">Scoring</label><select id="fSO" class="inp"><option value="points">Points</option><option value="winloss">Win / Loss</option></select></div></div><input id="fSP" class="inp" placeholder="Location (optional)"></div><div class="btn-row"><button class="bg" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createSessionAction()">Create Session</button></div></div>`}

  // No ladder
  else if(!l)h+=`<div style="text-align:center;padding:70px 20px" class="fu"><div class="hdr-logo" style="width:56px;height:56px;border-radius:14px;display:inline-flex;margin-bottom:16px"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><h2 class="heading" style="font-size:1.5rem;color:var(--green);margin-bottom:8px">Pickle Friends</h2><p class="subtext" style="margin-bottom:28px;line-height:1.6;max-width:320px;margin-left:auto;margin-right:auto">Pickleball ladder play with automatic lineups, live scoring, and season stats.</p><button class="bp" onclick="go('newLadder')" style="padding:14px 32px;font-size:.95rem">Create Your First Ladder</button></div>`;

  // Dashboard
  else if(view==='dashboard'){
    if(!s){h+=`<div class="card fu" style="text-align:center;padding:32px"><h3 class="heading" style="font-size:1.1rem;margin-bottom:6px">No Seasons Yet</h3><p class="subtext" style="margin-bottom:16px">Create a season to start.</p>${isAdmin?'<button class="bp" onclick="go(\'newSeason\')">Create First Season</button>':'<p class="subtext">Admin access required.</p>'}</div>`;if(l.seasons.length)h+=`<div class="card fu">${l.seasons.map(x=>`<button class="sc" onclick="gL().activeSeason='${x.id}';save(gL())"><div style="font-weight:600">${x.name}</div><div class="subtext" style="font-size:.72rem">${x.sessions.length} sessions</div></button>`).join('')}</div>`}
    else if(tab==='overview')h+=rOverview(l,s,stats);
    else if(tab==='stats')h+=rStats(stats,s,l);
    else if(tab==='players')h+=rPlayers(l,true);
  }

  // Session
  else if(view==='session'&&ss){
    if(tab==='play')h+=rPlay(l,ss);
    else if(tab==='roster')h+=rPlayers(l,false,ss);
    else if(tab==='stats')h+=rStats(sStats,null,l,ss);
    else if(tab==='rules')h+=rRules(ss);
  }

  h+='</div>';
  app.innerHTML=h;
}

// ── OVERVIEW ──
function rOverview(l,s,stats){
  let h=`<div class="card fu" style="border-color:var(--green-border)"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="overline">Current Season</div><h2 class="heading" style="font-size:1.2rem;color:var(--green)">${s.name}</h2><div class="subtext" style="font-size:.78rem;margin-top:4px">${s.sessions.length} session${s.sessions.length!==1?'s':''} · ${l.players.length} players</div></div>${isAdmin?'<button class="bg" style="font-size:.72rem;padding:6px 12px" onclick="go(\'newSeason\')">New Season</button>':''}</div></div>`;
  if(stats.some(x=>x.w+x.l+x.t>0))h+=`<div class="chip-grid fu">${[{l:'Sessions',v:s.sessions.filter(x=>x.started).length},{l:'Games',v:Math.floor(stats.reduce((a,x)=>a+x.w+x.l+x.t,0)/2)},{l:'Players',v:l.players.length},{l:'High Pts',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)}].map(c=>`<div class="chip"><div class="chip-n">${c.v}</div><div class="chip-l">${c.l}</div></div>`).join('')}</div>`;
  if(isAdmin)h+=`<button class="bp full" onclick="go('newSession')" style="margin-bottom:14px;font-size:.9rem;padding:13px">Start New Session</button>`;
  h+=`<div class="card fu"><h3 class="card-t">Sessions</h3>`;
  if(!s.sessions.length)h+='<p class="subtext" style="text-align:center;padding:20px">No sessions yet.</p>';
  else h+=[...s.sessions].reverse().map(x=>{const st=x.finished?'<span class="pill ok">Complete</span>':x.started?`<span class="pill live"><span class="dot"></span>Rd ${x.currentRound+1}</span>`:'<span class="pill draft">Draft</span>';return`<button class="sc" onclick="openSession('${x.id}')"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:600;font-size:.88rem">${fmtDate(x.date)}</div><div class="subtext" style="font-size:.72rem;margin-top:2px">${x.config.courts} courts · ${x.config.rounds} rds${x.config.place?' · '+x.config.place:''}</div></div>${st}</div></button>`}).join('');
  h+='</div>';
  if(isAdmin)h+=`<div class="card fu"><div style="display:flex;gap:8px;align-items:center">${l.seasons.length>1?`<select class="hdr-sel" style="flex:1" onchange="gL().activeSeason=this.value;save(gL())">${l.seasons.map(x=>`<option value="${x.id}"${x.id===l.activeSeason?' selected':''}>${x.name}</option>`).join('')}</select>`:''}<button class="bd" onclick="deleteLadderAction()">Delete Ladder</button></div></div>`;
  return h;
}

// ── PLAYERS ──
function rPlayers(l,showAdd,ss){
  let h='';
  if(isAdmin&&showAdd!==false)h+=`<div class="card fu"><h3 class="card-t">Add Player</h3><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key==='Enter')addPlayer()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addPlayer()">Add Player</button></div>`;
  h+=`<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Roster</h3><span class="pill ok">${l.players.length}</span></div>`;
  if(!l.players.length)h+='<p class="subtext" style="text-align:center;padding:20px">No players yet.</p>';
  else h+=l.players.map((p,i)=>`<div class="pr"><div class="pn">${i+1}</div><span style="flex:1;font-weight:600;font-size:.86rem">${p.name}</span><span class="gt ${p.gender==='F'?'f':'m'}">${p.gender}</span>${isAdmin?`<button class="edit-btn" onclick="openEditPlayer('${p.id}')">Edit</button>`:''}${isAdmin&&(!ss||!ss.started)?`<button class="rm" onclick="removePlayer('${p.id}')">×</button>`:''}</div>`).join('');
  h+='</div>';
  if(ss)h+=`<div class="card fu"><h3 class="card-t">Session Config</h3>${[['Courts',ss.config.courts],['Rounds',ss.config.rounds],['Time',ss.config.roundMin+' min'],['Scoring',ss.config.scoreMode==='points'?'Points':'Win/Loss']].map(([k,v])=>`<div class="cfg-row"><span class="subtext">${k}</span><span style="font-weight:600">${v}</span></div>`).join('')}</div>`;
  return h;
}

// ── PLAY ──
function rPlay(l,ss){
  const nC=ss.config.courts;
  if(!ss.started)return`<div class="card fu" style="text-align:center;padding:28px"><h3 class="heading" style="font-size:1.05rem;color:var(--green);margin-bottom:6px">Session — ${fmtDate(ss.date)}</h3><p class="subtext" style="margin-bottom:4px">${l.players.length} players · ${nC} courts · ${ss.config.rounds} rounds</p>${ss.config.place?`<p class="subtext" style="font-size:.76rem;margin-bottom:16px">${ss.config.place}</p>`:''}${isAdmin?(l.players.length>=4?'<button class="bp full" style="padding:14px;font-size:.92rem" onclick="startSessionAction()">Generate Lineups & Start</button>':'<p style="color:var(--warn);font-size:.82rem;margin-top:10px">Add at least 4 players first.</p>'):'<p class="subtext" style="margin-top:10px">Waiting for admin to start.</p>'}</div>`;

  let h='';
  // Round header + timer
  h+=`<div class="round-hdr fu"><div><div class="overline">Round</div><div class="round-num">${ss.currentRound+1} <span class="round-of">of ${ss.config.rounds}</span></div></div><div id="td" class="timer-disp" style="color:${timer<=60?'#dc2626':'#fff'}">${fmt(timer)}</div></div>
  <div class="timer-bar"><div id="tf" class="timer-fill" style="width:${(timer/(ss.config.roundMin*60))*100}%;background:${timer<=60?'#dc2626':timer<=180?'#d4a030':'#1a7a5c'}"></div></div>`;
  if(isAdmin)h+=`<div style="display:flex;gap:8px;margin-bottom:14px">${!timerOn?`<button class="bp" style="flex:2;padding:11px" onclick="startTimer()">${timer===0?'Start Timer':'Resume'}</button>`:'<button class="bw" style="flex:1;padding:11px" onclick="pauseTimer()">Pause</button>'}<button class="bds" style="flex:1;padding:11px" onclick="endTimer()">End Round</button></div>`;

  // ── COURT MAP GRID ──
  const round=ss.rounds[ss.currentRound];
  if(round){
    h+='<div class="court-map">';
    // Show courts from top (A) to bottom, so reverse the courts array (highest courtNum first)
    const sorted=[...round.courts].sort((a,b)=>b.court-a.court);
    sorted.forEach(ct=>{
      const ltr=cLtr(ct.court,nC);
      const isTop=ct.court===nC;
      const hs=!!ct.score;
      const t1nums=ct.team1.filter(Boolean).map(p=>pTag(p,l)).join(' & ');
      const t2nums=ct.team2.filter(Boolean).map(p=>pTag(p,l)).join(' & ');
      h+=`<div class="court-map-cell${isTop?' top':''}${hs?' scored':''}">
        <div class="court-map-letter">Ct ${ltr}${isTop?' — Top Court':''}</div>
        <div class="court-map-matchup">${t1nums}<span class="vs-sep">vs</span>${t2nums}</div>
        ${hs?`<div class="court-map-score">${ct.score.t1} – ${ct.score.t2}</div>`:''}
      </div>`;
    });
    h+='</div>';
  }

  // ── COURT DETAIL CARDS ──
  round?.courts.slice().sort((a,b)=>b.court-a.court).forEach(ct=>{
    const ci=round.courts.indexOf(ct);
    const isTop=ct.court===nC;const hs=!!ct.score;const w=ct.score?.winner;
    const ltr=cLtr(ct.court,nC);
    const upLtr=cLtr(Math.min(nC,ct.court+1),nC);
    const dnLtr=cLtr(Math.max(1,ct.court-1),nC);

    h+=`<div class="cc${isTop?' top':''}${hs?' scored':''} fu">
      <div class="cc-hdr">
        <div class="cc-letter${isTop?' gold':''}">${ltr}</div>
        <div><span class="cc-label"${isTop?' style="color:var(--tie)"':''}>Court ${ltr}</span>${isTop?'<span class="top-lbl">TOP COURT</span>':''}</div>
        ${hs?`<div class="cc-score">${ct.score.t1} – ${ct.score.t2}</div>`:''}
      </div>
      <div class="tg">
        <div class="tb${w==='A'?' wg':''}">
          ${ct.team1.filter(Boolean).map(p=>`<div class="tn"><span class="num">${pTag(p,l)}</span>${p.name}<span class="gtag">${p.gender}</span></div>`).join('')}
          ${w==='A'?'<div class="wl g">WINNER</div>':''}
        </div>
        <div class="vs">VS</div>
        <div class="tb${w==='B'?' wb':''}">
          ${ct.team2.filter(Boolean).map(p=>`<div class="tn"><span class="num">${pTag(p,l)}</span>${p.name}<span class="gtag">${p.gender}</span></div>`).join('')}
          ${w==='B'?'<div class="wl b">WINNER</div>':''}
        </div>
      </div>`;

    if(isAdmin){
      if(ss.config.scoreMode==='points')h+=`<div class="sr"><div class="scol"><input type="number" class="si${w==='A'?' wa':''}" min="0" max="99" placeholder="0" value="${ct.score?.t1??''}" onchange="submitScore(${ci},'t1',this.value)"><div class="sl">TEAM A</div></div><div class="sd">—</div><div class="scol"><input type="number" class="si${w==='B'?' wb':''}" min="0" max="99" placeholder="0" value="${ct.score?.t2??''}" onchange="submitScore(${ci},'t2',this.value)"><div class="sl">TEAM B</div></div></div>`;
      else h+=`<div style="display:flex;gap:8px;margin-top:14px"><button class="wlb${w==='A'?' aa':''}" onclick="setWL(${ci},'A')">${w==='A'?'Winner — ':''}Team A</button><button class="wlb${w==='B'?' ab':''}" onclick="setWL(${ci},'B')">${w==='B'?'Winner — ':''}Team B</button></div>`;
    }

    if(hs&&w!=='T')h+=`<div class="mh">Winners → Ct ${upLtr} · Losers → Ct ${dnLtr}</div>`;
    if(w==='T'&&hs)h+='<div class="th">Tie — all players stay</div>';
    h+='</div>';
  });

  if(isAdmin)h+=`<div style="display:flex;gap:8px;margin-top:4px"><button class="bg" style="flex:1" onclick="reshuffleRound()">Reshuffle</button><button class="bp" style="flex:2" onclick="nextRound()">${ss.currentRound>=ss.config.rounds-1?'Finish Session':'Next Round'}</button></div>`;
  if(ss.finished)h+=`<div class="card fu" style="margin-top:14px;text-align:center;border-color:var(--green-border);padding:22px"><h3 class="heading" style="font-size:1rem;color:var(--green);margin-bottom:4px">Session Complete</h3><p class="subtext">Check the Stats tab for results.</p></div>`;
  return h;
}

// ── STATS ──
function rStats(stats,season,l,ss){
  const has=stats.length>0&&stats.some(s=>s.w+s.l+s.t>0);let h='';
  if(has){const ac=stats.filter(s=>s.w+s.l+s.t>0);h+=`<div class="chip-grid fu">${[{l:'Players',v:ac.length},{l:'Games',v:Math.floor(stats.reduce((a,x)=>a+x.w+x.l+x.t,0)/2)},{l:'Avg Pts',v:ac.length?Math.round(stats.reduce((a,x)=>a+x.pf,0)/ac.length):0},{l:'High Pts',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)}].map(c=>`<div class="chip"><div class="chip-n">${c.v}</div><div class="chip-l">${c.l}</div></div>`).join('')}</div>`}

  h+=`<div class="card fu"><h3 class="card-t">${ss?`Results — ${fmtDate(ss.date)}`:'Season Standings'}</h3>`;
  if(!has)h+='<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';
  else{h+=`<div style="overflow-x:auto;margin:0 -18px;padding:0 18px"><table class="st"><thead><tr>${['#','Player','W','L','T','W%','+','–','±'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>`;stats.filter(s=>s.w+s.l+s.t>0).forEach((s,i)=>{const d=s.pf-s.pa,gp=s.w+s.l+s.t,wr=gp?Math.round(s.w/gp*100):0;const pn=l.players.findIndex(p=>p.id===s.id);h+=`<tr><td class="${i<3?'rt':''}">${['1st','2nd','3rd'][i]||(i+1)}</td><td style="font-weight:600"><span style="font-family:'Sora',sans-serif;color:var(--green);font-weight:700;font-size:.72rem;margin-right:4px">#${pn>=0?pn+1:'?'}</span>${s.name}</td><td class="at">${s.w}</td><td class="rdt">${s.l}</td><td class="amt">${s.t}</td><td style="font-weight:600;color:${wr>=60?'var(--green)':wr<=40?'var(--loss)':'var(--text)'}">${wr}%</td><td>${s.pf}</td><td>${s.pa}</td><td style="font-weight:700;color:${d>=0?'var(--green)':'var(--loss)'}">${d>0?'+':''}${d}</td></tr>`});h+='</tbody></table></div>'}
  h+='</div>';

  if(has){h+=`<div class="card fu"><h3 class="card-t">Player Journey</h3><p class="subtext" style="font-size:.7rem;margin-bottom:14px">Court position each round</p>`;stats.filter(s=>s.courtHist.length>0).slice(0,12).forEach(s=>{const maxC=ss?.config?.courts||l.seasons?.flatMap(se=>se.sessions).reduce((m,x)=>Math.max(m,x.config?.courts||4),4)||4;const avg=(s.courtHist.reduce((a,c)=>a+c.court,0)/s.courtHist.length).toFixed(1);const pn=l.players.findIndex(p=>p.id===s.id);h+=`<div style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-family:'Sora',sans-serif;color:var(--green);font-weight:700;font-size:.72rem">#${pn>=0?pn+1:'?'}</span><span style="font-weight:600;font-size:.82rem">${s.name}</span><span class="subtext" style="font-size:.64rem">${s.w}W ${s.l}L</span><span class="subtext" style="font-size:.64rem;margin-left:auto">Avg Ct ${avg}</span></div><div style="display:flex;gap:2px;align-items:flex-end">${s.courtHist.map((ch,ci)=>{const pct=(ch.court/maxC)*100;const r=s.roundRes[ci];return`<div style="flex:1;text-align:center;min-width:0"><div style="height:${Math.max(6,pct*.55)}px;background:${r?.won?'var(--green)':r?.tied?'var(--tie)':'var(--loss)'};border-radius:3px 3px 0 0;opacity:.75"></div><div style="font-size:.5rem;color:var(--muted);margin-top:1px;font-weight:600">${cLtr(ch.court,maxC)}</div></div>`}).join('')}</div></div>`});h+='</div>'}

  if(has&&stats.length>=3){h+=`<div class="card fu"><h3 class="card-t">Podium</h3><div style="display:flex;gap:12px;justify-content:center;align-items:flex-end;padding:18px 0">${[{i:1,l:'2nd',h:70},{i:0,l:'1st',h:90},{i:2,l:'3rd',h:55}].map(p=>{const x=stats[p.i];if(!x)return'';const d=x.pf-x.pa;const pn=l.players.findIndex(q=>q.id===x.id);return`<div style="text-align:center;flex:1"><div style="font-family:'Sora',sans-serif;font-size:.64rem;color:var(--green);font-weight:700;margin-bottom:4px;letter-spacing:1px">${p.l}</div><div class="pod" style="padding-top:${p.h*.25}px"><div style="font-weight:700;font-size:.82rem">#${pn>=0?pn+1:'?'} ${x.name}</div><div class="subtext" style="font-size:.64rem;margin-top:2px">${x.w}W · ${d>0?'+':''}${d}</div></div></div>`}).join('')}</div></div>`}

  if(season&&has&&stats.some(s=>s.attended>0)){const mx=Math.max(...stats.map(x=>x.attended),1);h+=`<div class="card fu"><h3 class="card-t">Attendance</h3>${stats.filter(s=>s.attended>0).sort((a,b)=>b.attended-a.attended).slice(0,10).map(s=>{const pn=l.players.findIndex(p=>p.id===s.id);return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><span style="font-size:.82rem;font-weight:600;width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#${pn>=0?pn+1:'?'} ${s.name}</span><div style="flex:1;background:var(--bg-input);border-radius:20px;height:8px;overflow:hidden"><div style="height:100%;width:${(s.attended/mx)*100}%;background:linear-gradient(90deg,var(--green),var(--teal));border-radius:20px"></div></div><span style="font-size:.74rem;font-weight:700;color:var(--green);width:22px;text-align:right">${s.attended}</span></div>`}).join('')}</div>`}
  return h;
}

// ── RULES ──
function rRules(ss){
  const nC=ss.config.courts;
  return`<div class="card fu"><h3 class="card-t">Session Format</h3>${[['Round Time',ss.config.roundMin+' min'],['Courts',nC+' ('+cLtr(nC,nC)+'–'+cLtr(1,nC)+')'],['Rounds',ss.config.rounds],['Scoring',ss.config.scoreMode==='points'?'Points':'Win / Loss'],['Location',ss.config.place||'—']].map(([k,v])=>`<div class="cfg-row"><span class="subtext">${k}</span><span style="font-weight:600">${v}</span></div>`).join('')}</div>
  <div class="card fu"><h3 class="card-t">Movement Rules</h3><div class="rt-text"><p><strong style="color:var(--green)">Winners</strong> move up toward Court A (top court stays)</p><p><strong style="color:var(--loss)">Losers</strong> move down away from Court A (bottom court stays)</p><p>Partners split and play with new partners each round</p><p><strong style="color:var(--tie)">Ties</strong> — all players stay on the same court</p></div></div>
  <div class="card fu"><h3 class="card-t">How to Win</h3><div class="rt-text"><p><strong>1st</strong> — Winners of Court A in the final round</p><p><strong>2nd</strong> — Non-winners of Court A</p><p><strong>3rd</strong> — Winners of Court B</p></div></div>
  <div class="card fu"><h3 class="card-t">Each Round</h3><div class="rt-text"><p>Play the full round duration regardless of score</p><p>When the timer sounds, finish the rally in progress</p><p>If tied when time expires, the game is a tie</p><p>Receiving team makes line calls</p></div></div>`;
}

// ── INIT ──
async function init(){ladders=await apiList();if(ladders.length)activeLadderId=ladders[0].id;render()}
document.addEventListener('DOMContentLoaded',init);
