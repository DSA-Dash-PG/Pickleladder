// ═══════════════════════════════════════════════════════════════
// PICKLE FRIENDS
// Courts: custom names, first = top. Players: auto-numbered.
// ═══════════════════════════════════════════════════════════════
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b};
const fmtT=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}};
const formatTime12=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);const ap=h>=12?'PM':'AM';return`${h%12||12}:${String(m).padStart(2,'0')} ${ap}`};

// Court name: courtNames[0]=top court, courtNames[n-1]=bottom
// Internal court numbers: highest number = top court
// So courtNames index = total - courtNum
function cName(courtNum, ss) {
  if (!ss?.config?.courtNames?.length) return String.fromCharCode(65 + (ss?.config?.courts||4) - courtNum);
  const idx = (ss.config.courtNames.length) - courtNum;
  return ss.config.courtNames[idx] || String.fromCharCode(65 + idx);
}
// Default court names for N courts: A, B, C, D...
function defaultCourtNames(n) { return Array.from({length:n}, (_,i) => String.fromCharCode(65+i)); }

const pTag=(p,l)=>{if(!p||!l)return'?';const i=l.players.findIndex(x=>x.id===p.id);return'#'+(i>=0?i+1:'?')};

// State
let ladders=[],activeLadderId=null,activeSessionId=null,isAdmin=false,adminPin='';
let view='dashboard',tab='overview',timer=0,timerOn=false,timerInt=null,pinEntry='',editingPid=null,mapOpen=false;
let formCourtCount=4;
let viewingRound=-1; // -1 = current round, 0+ = viewing a specific round index

// API
async function apiList(){try{return(await(await fetch('/api?action=list')).json()).ladders||[]}catch{return[]}}
async function apiSave(l){try{const r=await fetch('/api?action=save',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':adminPin},body:JSON.stringify({ladder:l})});if(!r.ok){const d=await r.json();throw new Error(d.error)}return await r.json()}catch(e){console.error(e);alert('Save failed: '+e.message);return null}}
async function apiDel(id){try{return await(await fetch(`/api?action=delete&id=${id}`,{method:'DELETE',headers:{'X-Admin-Pin':adminPin}})).json()}catch{return null}}
async function apiVerifyPin(pin){try{const r=await fetch('/api?action=verify-pin',{headers:{'X-Admin-Pin':pin}});return(await r.json()).valid}catch{return false}}

function gL(){return ladders.find(l=>l.id===activeLadderId)||null}
function gS(){const l=gL();return l?.seasons.find(s=>s.id===l.activeSeason)||null}
function gSS(){const s=gS();return s?.sessions.find(ss=>ss.id===activeSessionId)||null}
async function save(l){const i=ladders.findIndex(x=>x.id===l.id);if(i>=0)ladders[i]=l;else ladders.push(l);const r=await apiSave(l);if(r)render();return r}

// Lineup — coed pairing priority: each team should be 1M + 1F whenever possible
// Assigns a group of 4 players to 2 coed teams, avoiding previous partners
function makeCoed(group, prevPartners) {
  const males = group.filter(p => p?.gender === 'M');
  const females = group.filter(p => p?.gender === 'F');
  let t1, t2;
  if (males.length >= 2 && females.length >= 2) {
    // Ideal: 2M 2F → each team gets 1M+1F
    t1 = [males[0], females[0]];
    t2 = [males[1], females[1]];
    // Check previous partners and swap if needed
    if (prevPartners && (prevPartners[t1[0]?.id] === t1[1]?.id || prevPartners[t2[0]?.id] === t2[1]?.id)) {
      t1 = [males[0], females[1]];
      t2 = [males[1], females[0]];
    }
  } else if (males.length >= 1 && females.length >= 1) {
    // Partial: at least 1 coed team, other may be same-gender
    // Put one M+F pair together, rest on the other team
    const others = group.filter(p => p !== males[0] && p !== females[0]);
    t1 = [males[0], females[0]];
    t2 = [others[0] || null, others[1] || null];
    if (prevPartners && prevPartners[t1[0]?.id] === t1[1]?.id && others.length >= 2) {
      // Try alternate pairing
      const altF = females.length > 1 ? females[1] : null;
      if (altF) { t1 = [males[0], altF]; t2 = [females[0], others.find(p => p !== altF) || others[0] || null]; }
    }
  } else {
    // All same gender — just split evenly
    t1 = [group[0] || null, group[1] || null];
    t2 = [group[2] || null, group[3] || null];
    if (prevPartners && (prevPartners[t1[0]?.id] === t1[1]?.id || prevPartners[t2[0]?.id] === t2[1]?.id)) {
      t1 = [group[0] || null, group[2] || null];
      t2 = [group[1] || null, group[3] || null];
    }
  }
  return { t1, t2 };
}

function genR1(players, nC) {
  // Separate and shuffle by gender, then interleave to maximize coed courts
  const males = shuffle(players.filter(p => p.gender === 'M'));
  const females = shuffle(players.filter(p => p.gender === 'F'));
  // Interleave: for each court, try to grab 2M + 2F
  const courts = [];
  let mi = 0, fi = 0;
  for (let c = 0; c < nC; c++) {
    const group = [];
    // Try to get 2 of each gender per court
    for (let x = 0; x < 2; x++) { if (mi < males.length) group.push(males[mi++]); }
    for (let x = 0; x < 2; x++) { if (fi < females.length) group.push(females[fi++]); }
    // Fill remaining spots if we ran short on one gender
    while (group.length < 4 && mi < males.length) group.push(males[mi++]);
    while (group.length < 4 && fi < females.length) group.push(females[fi++]);
    const { t1, t2 } = makeCoed(group, null);
    courts.push({ court: c + 1, team1: [t1[0] || null, t1[1] || null], team2: [t2[0] || null, t2[1] || null], score: null });
  }
  return { courts, completed: false };
}

function genNR(prev, nC) {
  // Movement: winners up, losers down
  const mvs = [];
  prev.courts.forEach(c => {
    const all = [...(c.team1 || []), ...(c.team2 || [])].filter(Boolean);
    if (!c.score || c.score.winner === 'T') { all.forEach(p => mvs.push({ p, to: c.court })); return; }
    const w = c.score.winner === 'A' ? c.team1 : c.team2;
    const lo = c.score.winner === 'A' ? c.team2 : c.team1;
    w.filter(Boolean).forEach(p => mvs.push({ p, to: Math.min(nC, c.court + 1) }));
    lo.filter(Boolean).forEach(p => mvs.push({ p, to: Math.max(1, c.court - 1) }));
  });
  // Bucket by target court
  const bk = {}; for (let i = 1; i <= nC; i++) bk[i] = [];
  mvs.forEach(m => bk[m.to]?.push(m.p));
  // Shuffle within each bucket
  for (let i = 1; i <= nC; i++) bk[i] = shuffle(bk[i]);
  // Build previous partners map
  const pp = {};
  prev.courts.forEach(c => { [c.team1, c.team2].forEach(t => { if (t[0] && t[1]) { pp[t[0].id] = t[1].id; pp[t[1].id] = t[0].id; } }); });
  // Assign coed teams per court
  const courts = [];
  for (let c = 0; c < nC; c++) {
    const group = bk[c + 1] || [];
    const { t1, t2 } = makeCoed(group.slice(0, 4), pp);
    courts.push({ court: c + 1, team1: [t1[0] || null, t1[1] || null], team2: [t2[0] || null, t2[1] || null], score: null });
  }
  return { courts, completed: false };
}

// Stats
function calcStats(sessions,players){const s={};players.forEach(p=>{s[p.id]={id:p.id,name:p.name,gender:p.gender,w:0,l:0,t:0,pf:0,pa:0,best:0,attended:0,courtHist:[],roundRes:[]}});sessions.forEach(sess=>{const played=new Set();sess.rounds.forEach((round,ri)=>{round.courts.forEach(c=>{if(!c.score)return;const{t1,t2,winner}=c.score;const tied=winner==='T';[[c.team1,t1,t2,winner==='A'],[c.team2,t2,t1,winner==='B']].forEach(([team,sc,al,won])=>{team.filter(Boolean).forEach(p=>{if(!s[p.id])return;played.add(p.id);s[p.id].pf+=sc;s[p.id].pa+=al;if(tied)s[p.id].t++;else if(won)s[p.id].w++;else s[p.id].l++;s[p.id].best=Math.max(s[p.id].best,c.court);s[p.id].courtHist.push({round:ri+1,court:c.court});s[p.id].roundRes.push({round:ri+1,court:c.court,won,tied,pf:sc,pa:al})})})})});played.forEach(id=>{if(s[id])s[id].attended++})});return Object.values(s).sort((a,b)=>b.w!==a.w?b.w-a.w:(b.pf-b.pa)-(a.pf-a.pa))}

// Timer
function startTimer(){const ss=gSS();if(!ss)return;if(timer===0)timer=ss.config.roundMin*60;timerOn=true;clearInterval(timerInt);timerInt=setInterval(()=>{timer--;if(timer<=0){timer=0;timerOn=false;clearInterval(timerInt)}rTimer()},1000);render()}
function pauseTimer(){timerOn=false;clearInterval(timerInt);render()}
function endTimer(){timerOn=false;clearInterval(timerInt);timer=0;render()}
function resetTimer(ss){clearInterval(timerInt);timerOn=false;timer=(ss?.config?.roundMin||12)*60}
function rTimer(){const el=document.getElementById('td');if(el){el.textContent=fmtT(timer);el.style.color=timer<=60?'#dc2626':'#fff'}const bar=document.getElementById('tf');const ss=gSS();if(bar&&ss){bar.style.width=(timer/(ss.config.roundMin*60))*100+'%';bar.style.background=timer<=60?'#dc2626':timer<=180?'#d4a030':'#1a7a5c'}}

function shouldMapOpen(ss){if(!ss||!ss.config.startTime||!ss.date)return false;try{const[h,m]=(ss.config.startTime||'').split(':').map(Number);const sessionStart=new Date(ss.date+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00');const now=new Date();const diff=(sessionStart-now)/60000;return diff<=60&&diff>=-120}catch{return false}}

// PIN
function openPin(){pinEntry='';document.getElementById('pinModal').style.display='flex';rPD()}
function closePin(){pinEntry='';document.getElementById('pinModal').style.display='none';document.getElementById('pinErr').textContent=''}
function pinPress(d){if(pinEntry.length>=4)return;pinEntry+=d;rPD();if(pinEntry.length===4)setTimeout(checkPin,150)}
function pinDel(){pinEntry=pinEntry.slice(0,-1);rPD();document.getElementById('pinErr').textContent=''}
function rPD(){for(let i=0;i<4;i++){const d=document.getElementById('pd'+i);if(d){d.style.background=i<pinEntry.length?'#1a7a5c':'transparent';d.style.borderColor=i<pinEntry.length?'#1a7a5c':'#a3b8ac'}}}
async function checkPin(){const valid=await apiVerifyPin(pinEntry);if(valid){adminPin=pinEntry;isAdmin=true;closePin();render()}else{document.getElementById('pinErr').textContent='Incorrect PIN';pinEntry='';rPD();setTimeout(()=>{const e=document.getElementById('pinErr');if(e)e.textContent=''},2000)}}
function lockAdmin(){isAdmin=false;adminPin='';render()}

// Edit player
function openEditPlayer(pid){const l=gL();if(!l)return;const p=l.players.find(x=>x.id===pid);if(!p)return;editingPid=pid;document.getElementById('edName').value=p.name;document.getElementById('edGender').value=p.gender;document.getElementById('editModal').classList.add('open')}
function closeEditModal(){document.getElementById('editModal').classList.remove('open');editingPid=null}
async function saveEditPlayer(){const l=gL();if(!l||!editingPid)return;const p=l.players.find(x=>x.id===editingPid);if(!p)return;p.name=document.getElementById('edName').value.trim()||p.name;p.gender=document.getElementById('edGender').value;closeEditModal();await save(l)}

function toggleMap(){mapOpen=!mapOpen;render()}
function viewRound(ri){viewingRound=ri;render()}

// Update court name inputs when court count changes in the form
function updateCourtInputs(){
  const n=parseInt(document.getElementById('fSC')?.value)||4;
  formCourtCount=n;
  const container=document.getElementById('courtNamesContainer');
  if(!container)return;
  const names=defaultCourtNames(n);
  container.innerHTML=`<label class="lbl">Court Names (top → bottom)</label><div style="display:grid;grid-template-columns:repeat(${Math.min(n,4)},1fr);gap:6px">${names.map((nm,i)=>`<input id="fCN${i}" class="inp" value="${nm}" style="text-align:center;font-family:'Sora',sans-serif;font-weight:700;font-size:.9rem;padding:8px 4px" placeholder="Ct ${i+1}">`).join('')}</div>`;
}

// Collect court names from form
function getFormCourtNames(){
  const n=formCourtCount;
  const names=[];
  for(let i=0;i<n;i++){const el=document.getElementById('fCN'+i);names.push(el?.value?.trim()||String.fromCharCode(65+i))}
  return names;
}

// Actions
async function createLadder(){const n=document.getElementById('fLN')?.value?.trim();if(!n)return;const l={id:uid(),name:n,players:[],seasons:[],activeSeason:null,createdAt:Date.now()};const r=await save(l);if(r){activeLadderId=l.id;view='dashboard';tab='overview';render()}}
async function deleteLadderAction(){const l=gL();if(!l||!confirm('Delete this ladder permanently?'))return;await apiDel(l.id);ladders=ladders.filter(x=>x.id!==l.id);activeLadderId=ladders[0]?.id||null;view='dashboard';render()}
async function createSeason(){const n=document.getElementById('fSN')?.value?.trim();const l=gL();if(!l||!n)return;const s={id:uid(),name:n,sessions:[],createdAt:Date.now()};l.seasons.push(s);l.activeSeason=s.id;await save(l);view='dashboard';tab='overview';render()}
async function createSessionAction(){
  const l=gL();const s=gS();if(!l||!s)return;
  const courtNames=getFormCourtNames();
  const ss={id:uid(),date:document.getElementById('fSD')?.value||new Date().toISOString().split('T')[0],
    config:{courts:formCourtCount,rounds:parseInt(document.getElementById('fSR')?.value)||6,roundMin:parseInt(document.getElementById('fSM')?.value)||12,scoreMode:document.getElementById('fSO')?.value||'points',place:document.getElementById('fSP')?.value||'',startTime:document.getElementById('fST')?.value||'',courtNames},
    rounds:[],currentRound:-1,started:false,finished:false,createdAt:Date.now()};
  s.sessions.push(ss);await save(l);activeSessionId=ss.id;view='session';tab='roster';render();
}
async function addPlayer(){const l=gL();if(!l)return;const n=document.getElementById('fPN')?.value?.trim();const g=document.getElementById('fPG')?.value||'M';if(!n)return;l.players.push({id:uid(),name:n,gender:g});document.getElementById('fPN').value='';await save(l)}
async function removePlayer(pid){const l=gL();if(!l||!confirm('Remove this player?'))return;l.players=l.players.filter(p=>p.id!==pid);await save(l)}
async function startSessionAction(){const l=gL();const ss=gSS();if(!l||!ss||l.players.length<4)return alert('Need at least 4 players.');ss.rounds=[genR1(l.players,ss.config.courts)];ss.currentRound=0;ss.started=true;resetTimer(ss);tab='play';mapOpen=true;await save(l)}
async function submitScore(ci,f,v){const l=gL();const ss=gSS();if(!l||!ss)return;const ct=ss.rounds[ss.currentRound].courts[ci];const sc=ct.score||{t1:0,t2:0,winner:'T'};sc[f]=parseInt(v)||0;sc.winner=sc.t1>sc.t2?'A':sc.t2>sc.t1?'B':'T';ct.score=sc;await save(l)}
async function setWL(ci,w){const l=gL();const ss=gSS();if(!l||!ss)return;ss.rounds[ss.currentRound].courts[ci].score={t1:w==='A'?1:0,t2:w==='B'?1:0,winner:w};await save(l)}
async function nextRound(){const l=gL();const ss=gSS();if(!l||!ss)return;const un=ss.rounds[ss.currentRound].courts.filter(c=>!c.score);if(un.length&&!confirm(`${un.length} court(s) unscored. Continue?`))return;if(ss.currentRound>=ss.config.rounds-1){ss.finished=true;tab='stats';await save(l);return}ss.rounds.push(genNR(ss.rounds[ss.currentRound],ss.config.courts));ss.currentRound++;resetTimer(ss);await save(l)}
async function reshuffleRound(){const l=gL();const ss=gSS();if(!l||!ss||!confirm('Reshuffle? Scores cleared.'))return;const all=[];ss.rounds[ss.currentRound].courts.forEach(c=>[...c.team1,...c.team2].filter(Boolean).forEach(p=>all.push(p)));ss.rounds[ss.currentRound]=genR1(all,ss.config.courts);await save(l)}

// Rename / edit names
async function renameLadder(){const l=gL();if(!l)return;const n=prompt('Ladder name:',l.name);if(n&&n.trim()){l.name=n.trim();await save(l)}}
async function renameSeason(){const l=gL();const s=gS();if(!l||!s)return;const n=prompt('Season name:',s.name);if(n&&n.trim()){s.name=n.trim();await save(l)}}
async function editSessionDate(){const l=gL();const ss=gSS();if(!l||!ss)return;const d=prompt('Session date (YYYY-MM-DD):',ss.date);if(d&&d.trim()){ss.date=d.trim();await save(l)}}
async function editSessionTime(){const l=gL();const ss=gSS();if(!l||!ss)return;const t=prompt('Start time (HH:MM, 24hr):',ss.config.startTime||'');if(t!==null){ss.config.startTime=t.trim();await save(l)}}
async function editSessionPlace(){const l=gL();const ss=gSS();if(!l||!ss)return;const p=prompt('Location:',ss.config.place||'');if(p!==null){ss.config.place=p.trim();await save(l)}}

function go(v,t){view=v;if(t)tab=t;viewingRound=-1;if(v==='newSession')formCourtCount=4;render();if(v==='newSession')setTimeout(updateCourtInputs,10)}
function selectLadder(id){activeLadderId=id;activeSessionId=null;view='dashboard';tab='overview';viewingRound=-1;render()}
function openSession(id){activeSessionId=id;view='session';tab='play';viewingRound=-1;const ss=gSS();mapOpen=ss?shouldMapOpen(ss)||(ss.started):false;render()}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function render(){
  const app=document.getElementById('app');const l=gL(),s=gS(),ss=gSS();
  const stats=(s&&l)?calcStats(s.sessions,l.players):[];
  const sStats=ss?calcStats([ss],l?.players||[]):[];
  let h='';

  // Header
  h+=`<header class="hdr"><div class="hdr-row"><div class="hdr-left"><div class="hdr-logo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><div><h1 class="hdr-title">Pickle Friends</h1>${s?`<div class="hdr-sub">${s.name}</div>`:''}</div></div><div class="hdr-right">${ladders.length>1?`<select class="hdr-sel" onchange="selectLadder(this.value)">${ladders.map(x=>`<option value="${x.id}"${x.id===activeLadderId?' selected':''}>${x.name}</option>`).join('')}</select>`:''}</div></div>
  ${view==='session'?`<div class="tabs">${['Play','Roster','Stats','Rules'].map(t=>`<button class="tab${tab===t.toLowerCase()?' active':''}" onclick="tab='${t.toLowerCase()}';render()">${t}</button>`).join('')}<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go('dashboard','overview')">← Back</button></div>`:''}
  ${view==='dashboard'&&s?`<div class="tabs">${['Overview','Stats','Players'].map(t=>`<button class="tab${tab===t.toLowerCase()?' active':''}" onclick="tab='${t.toLowerCase()}';render()">${t}</button>`).join('')}</div>`:''}
  </header><div class="content">`;

  // Forms
  if(view==='newLadder')h+=`<div class="card fu"><h2 class="card-t">Create Ladder</h2><input id="fLN" class="inp" placeholder="Ladder name" autofocus><div class="btn-row"><button class="bg-btn" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createLadder()">Create</button></div></div>`;
  else if(view==='newSeason')h+=`<div class="card fu"><h2 class="card-t">New Season</h2><input id="fSN" class="inp" placeholder="Season name (e.g. Summer 2026)" autofocus><div class="btn-row"><button class="bg-btn" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createSeason()">Create Season</button></div></div>`;
  else if(view==='newSession'){
    const td=new Date().toISOString().split('T')[0];
    h+=`<div class="card fu"><h2 class="card-t">New Session</h2><div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Date</label><input id="fSD" class="inp" type="date" value="${td}"></div><div><label class="lbl">Start Time</label><input id="fST" class="inp" type="time" value="15:00"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label class="lbl">Courts</label><select id="fSC" class="inp" onchange="updateCourtInputs()">${[2,3,4,5,6,7,8,10,12].map(n=>`<option value="${n}"${n===4?' selected':''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl">Rounds</label><select id="fSR" class="inp">${[3,4,5,6,7,8,10,12].map(n=>`<option value="${n}"${n===6?' selected':''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl">Round Time (min)</label><input id="fSM" class="inp" type="number" min="1" max="20" value="12"></div>
        <div><label class="lbl">Scoring</label><select id="fSO" class="inp"><option value="points">Points</option><option value="winloss">Win / Loss</option></select></div>
      </div>
      <div id="courtNamesContainer"></div>
      <input id="fSP" class="inp" placeholder="Location (optional)">
    </div><div class="btn-row"><button class="bg-btn" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createSessionAction()">Create Session</button></div></div>`;
  }

  // No ladder
  else if(!l){
    if(ladders.length===0&&!isAdmin)h+=`<div style="text-align:center;padding:70px 20px" class="fu"><div class="hdr-logo" style="width:56px;height:56px;border-radius:14px;display:inline-flex;margin-bottom:16px"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><h2 class="heading" style="font-size:1.5rem;color:var(--green);margin-bottom:8px">Pickle Friends</h2><p class="subtext" style="margin-bottom:28px;line-height:1.6;max-width:320px;margin-left:auto;margin-right:auto">Pickleball ladder play — automatic lineups, live scoring, and season stats.</p><p class="subtext">No active ladders yet. Check back soon!</p></div>`;
    else if(isAdmin)h+=`<div style="text-align:center;padding:40px 20px" class="fu"><h2 class="heading" style="font-size:1.2rem;color:var(--green);margin-bottom:12px">No Ladders</h2><button class="bp" onclick="go('newLadder')" style="padding:14px 32px">Create Your First Ladder</button></div>`;
  }

  // Dashboard
  else if(view==='dashboard'){
    if(!s){h+=`<div class="card fu" style="text-align:center;padding:32px"><h3 class="heading" style="font-size:1.1rem;margin-bottom:6px">No Seasons Yet</h3>${isAdmin?'<button class="bp" onclick="go(\'newSeason\')">Create First Season</button>':'<p class="subtext">Check back soon!</p>'}</div>`}
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

  // Admin footer
  h+=`<div class="admin-footer">`;
  if(isAdmin){
    h+=`<div class="admin-bar-bottom">ADMIN MODE</div><div style="display:flex;flex-direction:column;gap:8px">`;
    if(view==='dashboard'&&s){h+=`<button class="bp full" onclick="go('newSession')">New Session</button><button class="bg-btn full" onclick="go('newSeason')">New Season</button><button class="bp full" onclick="go('newLadder')">New Ladder</button><button class="bg-btn full" onclick="renameLadder()">Rename Ladder</button>`;if(l.seasons.length>1)h+=`<div style="margin-top:4px"><label class="lbl">Switch Season</label><select class="inp" onchange="gL().activeSeason=this.value;save(gL())">${l.seasons.map(x=>`<option value="${x.id}"${x.id===l.activeSeason?' selected':''}>${x.name}</option>`).join('')}</select></div>`;h+=`<button class="bd full" style="margin-top:8px" onclick="deleteLadderAction()">Delete Ladder</button>`}
    else if(!l||!s)h+=`<button class="bp full" onclick="go('newLadder')">New Ladder</button>`;
    h+=`</div><button class="admin-lock-btn unlocked" onclick="lockAdmin()" style="margin-top:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Lock Admin</button>`;
  } else {
    h+=`<button class="admin-lock-btn" onclick="openPin()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="15" x2="12" y2="18"/></svg> Admin</button>`;
  }
  h+=`</div></div>`;
  app.innerHTML=h;

  // Trigger court name inputs after DOM is ready for new session form
  if(view==='newSession')setTimeout(updateCourtInputs,0);
}

// ── OVERVIEW ──
function rOverview(l,s,stats){
  let h=`<div class="card fu" style="border-color:var(--green-bd)"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="overline">Current Season</div><h2 class="heading" style="font-size:1.2rem;color:var(--green)">${s.name}${isAdmin?` <button class="edit-btn" onclick="renameSeason()" style="font-size:.7rem;vertical-align:middle">Edit</button>`:''}</h2><div class="subtext" style="font-size:.78rem;margin-top:4px">${s.sessions.length} session${s.sessions.length!==1?'s':''} · ${l.players.length} players</div></div></div></div>`;
  if(stats.some(x=>x.w+x.l+x.t>0))h+=`<div class="chip-grid fu">${[{l:'Sessions',v:s.sessions.filter(x=>x.started).length},{l:'Games',v:Math.floor(stats.reduce((a,x)=>a+x.w+x.l+x.t,0)/2)},{l:'Players',v:l.players.length},{l:'High Pts',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)}].map(c=>`<div class="chip"><div class="chip-n">${c.v}</div><div class="chip-l">${c.l}</div></div>`).join('')}</div>`;
  h+=`<div class="card fu"><h3 class="card-t">Sessions</h3>`;
  if(!s.sessions.length)h+='<p class="subtext" style="text-align:center;padding:20px">No sessions scheduled yet.</p>';
  else h+=[...s.sessions].reverse().map(x=>{const st=x.finished?'<span class="pill ok">Complete</span>':x.started?`<span class="pill live"><span class="dot"></span>Rd ${x.currentRound+1}</span>`:'<span class="pill draft">Upcoming</span>';const ts=x.config.startTime?` · ${formatTime12(x.config.startTime)}`:'';return`<button class="sc" onclick="openSession('${x.id}')"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:600;font-size:.88rem">${fmtDate(x.date)}${ts}</div><div class="subtext" style="font-size:.72rem;margin-top:2px">${x.config.courts} courts · ${x.config.rounds} rds${x.config.place?' · '+x.config.place:''}</div></div>${st}</div></button>`}).join('');
  h+='</div>';return h;
}

// ── PLAYERS ──
function rPlayers(l,showAdd,ss){
  let h='';
  if(isAdmin&&showAdd!==false)h+=`<div class="card fu"><h3 class="card-t">Add Player</h3><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key==='Enter')addPlayer()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addPlayer()">Add Player</button></div>`;
  h+=`<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Roster</h3><span class="pill ok">${l.players.length}</span></div>`;
  if(!l.players.length)h+='<p class="subtext" style="text-align:center;padding:20px">No players yet.</p>';
  else h+=l.players.map((p,i)=>`<div class="pr"><div class="pn">${i+1}</div><span style="flex:1;font-weight:600;font-size:.86rem">${p.name}</span><span class="gt ${p.gender==='F'?'f':'m'}">${p.gender}</span>${isAdmin?`<button class="edit-btn" onclick="openEditPlayer('${p.id}')">Edit</button>`:''}${isAdmin&&(!ss||!ss.started)?`<button class="rm" onclick="removePlayer('${p.id}')">×</button>`:''}</div>`).join('');
  h+='</div>';
  if(ss){
    const edB=(fn)=>isAdmin?`<button class="edit-btn" onclick="${fn}" style="font-size:.68rem;margin-left:6px">Edit</button>`:'';
    h+=`<div class="card fu"><h3 class="card-t">Session Config</h3>${[
      ['Courts',ss.config.courtNames?.join(', ')||ss.config.courts,''],
      ['Rounds',ss.config.rounds,''],
      ['Time',ss.config.roundMin+' min',''],
      ['Date',fmtDate(ss.date),edB("editSessionDate()")],
      ['Start',ss.config.startTime?formatTime12(ss.config.startTime):'—',edB("editSessionTime()")],
      ['Location',ss.config.place||'—',edB("editSessionPlace()")],
      ['Scoring',ss.config.scoreMode==='points'?'Points':'Win/Loss',''],
    ].map(([k,v,eb])=>`<div class="cfg-row"><span class="subtext">${k}</span><span style="font-weight:600">${v}${eb}</span></div>`).join('')}</div>`;
  }
  return h;
}

// ── PLAY ──
function rPlay(l,ss){
  const nC=ss.config.courts;
  if(!ss.started)return`<div class="card fu" style="text-align:center;padding:28px"><h3 class="heading" style="font-size:1.05rem;color:var(--green);margin-bottom:6px">Session — ${fmtDate(ss.date)}</h3><p class="subtext" style="margin-bottom:2px">${l.players.length} players · ${nC} courts · ${ss.config.rounds} rounds</p>${ss.config.startTime?`<p class="subtext" style="margin-bottom:2px">${formatTime12(ss.config.startTime)}${ss.config.place?' · '+ss.config.place:''}</p>`:''}${isAdmin?(l.players.length>=4?'<button class="bp full" style="padding:14px;font-size:.92rem;margin-top:14px" onclick="startSessionAction()">Generate Lineups & Start</button>':'<p style="color:var(--warn);font-size:.82rem;margin-top:10px">Add at least 4 players first.</p>'):'<p class="subtext" style="margin-top:10px">Lineups will appear when the session starts.</p>'}</div>`;

  // Determine which round we're viewing
  const isCurrent = viewingRound===-1||viewingRound===ss.currentRound;
  const vr = isCurrent?ss.currentRound:viewingRound;
  const round = ss.rounds[vr];
  if(!round)return'<p class="subtext">No round data.</p>';

  let h='';

  // Round header with timer (only for current round)
  if(isCurrent){
    h+=`<div class="round-hdr fu"><div><div class="overline">Round</div><div class="round-num">${ss.currentRound+1} <span class="round-of">of ${ss.config.rounds}</span></div></div><div id="td" class="timer-disp" style="color:${timer<=60?'#dc2626':'#fff'}">${fmtT(timer)}</div></div><div class="timer-bar"><div id="tf" class="timer-fill" style="width:${(timer/(ss.config.roundMin*60))*100}%;background:${timer<=60?'#dc2626':timer<=180?'#d4a030':'#1a7a5c'}"></div></div>`;
    if(isAdmin)h+=`<div style="display:flex;gap:8px;margin-bottom:14px">${!timerOn?`<button class="bp" style="flex:2;padding:11px" onclick="startTimer()">${timer===0?'Start Timer':'Resume'}</button>`:'<button class="bw" style="flex:1;padding:11px" onclick="pauseTimer()">Pause</button>'}<button class="bds" style="flex:1;padding:11px" onclick="endTimer()">End Round</button></div>`;
  } else {
    h+=`<div class="card fu" style="text-align:center;padding:14px"><div class="subtext" style="font-size:.72rem">Viewing previous round</div><h3 class="heading" style="font-size:1rem;color:var(--green);margin:4px 0">Round ${vr+1}</h3></div>`;
  }

  // Round selector tabs
  h+=`<div style="display:flex;gap:4px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">`;
  for(let ri=0;ri<=ss.currentRound;ri++){
    const isViewing=(isCurrent&&ri===ss.currentRound)||(!isCurrent&&ri===vr);
    const rdComplete=ss.rounds[ri]?.courts.every(c=>!!c.score);
    h+=`<button onclick="viewRound(${ri===ss.currentRound?-1:ri})" style="padding:6px 12px;border-radius:var(--rx);border:1.5px solid ${isViewing?'var(--green)':'var(--border-s)'};background:${isViewing?'var(--green-pale)':'var(--bg-card)'};color:${isViewing?'var(--green)':'var(--muted)'};font-family:'Sora',sans-serif;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">Rd ${ri+1}${ri===ss.currentRound?' ●':rdComplete?' ✓':''}</button>`;
  }
  h+=`</div>`;

  // Court map
  const isOpen=mapOpen||shouldMapOpen(ss);
  h+=`<div class="map-toggle${isOpen?' open':''}" onclick="toggleMap()"><span class="label">Court Map — Round ${vr+1}</span><span class="arrow">▼</span></div>`;
  h+=`<div class="court-map${isOpen?' open':''}">`;
  [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
    const nm=cName(ct.court,ss);const hs=!!ct.score;
    h+=`<div class="cmc${hs?' scored':''}"><div class="cmc-ltr">Ct ${nm}</div><div class="cmc-match">${ct.team1.filter(Boolean).map(p=>pTag(p,l)).join(' & ')}<span class="vs-s">vs</span>${ct.team2.filter(Boolean).map(p=>pTag(p,l)).join(' & ')}</div>${hs?`<div class="cmc-score">${ct.score.t1} – ${ct.score.t2}</div>`:''}</div>`;
  });
  h+='</div>';

  // Court detail cards
  round.courts.slice().sort((a,b)=>b.court-a.court).forEach(ct=>{
    const ci=round.courts.indexOf(ct);const hs=!!ct.score;const w=ct.score?.winner;
    const nm=cName(ct.court,ss);
    const upNm=cName(Math.min(nC,ct.court+1),ss);
    const dnNm=cName(Math.max(1,ct.court-1),ss);

    h+=`<div class="cc${hs?' scored':''} fu"><div class="cc-hdr"><div class="cc-ltr">${nm}</div><div><span class="cc-label">Court ${nm}</span></div>${hs?`<div class="cc-score">${ct.score.t1} – ${ct.score.t2}</div>`:''}</div>
    <div class="tg"><div class="tb${w==='A'?' wg':''}">${ct.team1.filter(Boolean).map(p=>`<div class="tn"><span class="num">${pTag(p,l)}</span>${p.name}<span class="gtag">${p.gender}</span></div>`).join('')}${w==='A'?'<div class="wl g">WINNER</div>':''}</div><div class="vs">VS</div><div class="tb${w==='B'?' wb':''}">${ct.team2.filter(Boolean).map(p=>`<div class="tn"><span class="num">${pTag(p,l)}</span>${p.name}<span class="gtag">${p.gender}</span></div>`).join('')}${w==='B'?'<div class="wl b">WINNER</div>':''}</div></div>`;

    // Score entry only on current round + admin
    if(isAdmin&&isCurrent){
      if(ss.config.scoreMode==='points')h+=`<div class="sr"><div class="scol"><input type="number" class="si${w==='A'?' wa':''}" min="0" max="99" placeholder="0" value="${ct.score?.t1??''}" onchange="submitScore(${ci},'t1',this.value)"><div class="sl">TEAM A</div></div><div class="sd">—</div><div class="scol"><input type="number" class="si${w==='B'?' swb':''}" min="0" max="99" placeholder="0" value="${ct.score?.t2??''}" onchange="submitScore(${ci},'t2',this.value)"><div class="sl">TEAM B</div></div></div>`;
      else h+=`<div style="display:flex;gap:8px;margin-top:14px"><button class="wlb${w==='A'?' aa':''}" onclick="setWL(${ci},'A')">${w==='A'?'Winner — ':''}Team A</button><button class="wlb${w==='B'?' ab':''}" onclick="setWL(${ci},'B')">${w==='B'?'Winner — ':''}Team B</button></div>`;
    }

    if(hs&&w!=='T')h+=`<div class="mh">Winners → Ct ${upNm} · Losers → Ct ${dnNm}</div>`;
    if(w==='T'&&hs)h+='<div class="th">Tie — all players stay</div>';
    h+='</div>';
  });

  // Round controls (admin, current round only)
  if(isAdmin&&isCurrent)h+=`<div style="display:flex;gap:8px;margin-top:4px"><button class="bg-btn" style="flex:1" onclick="reshuffleRound()">Reshuffle</button><button class="bp" style="flex:2" onclick="nextRound()">${ss.currentRound>=ss.config.rounds-1?'Finish Session':'Next Round'}</button></div>`;

  // Back to current round button when viewing previous
  if(!isCurrent)h+=`<div style="margin-top:10px"><button class="bp full" onclick="viewRound(-1)">Back to Current Round (Rd ${ss.currentRound+1})</button></div>`;

  if(ss.finished)h+=`<div class="card fu" style="margin-top:14px;text-align:center;border-color:var(--green-bd);padding:22px"><h3 class="heading" style="font-size:1rem;color:var(--green);margin-bottom:4px">Session Complete</h3><p class="subtext">Check the Stats tab for results.</p></div>`;
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
  if(has){const maxC=ss?.config?.courts||l.seasons?.flatMap(se=>se.sessions).reduce((m,x)=>Math.max(m,x.config?.courts||4),4)||4;h+=`<div class="card fu"><h3 class="card-t">Player Journey</h3><p class="subtext" style="font-size:.7rem;margin-bottom:14px">Court position each round</p>`;stats.filter(s=>s.courtHist.length>0).slice(0,12).forEach(s=>{const pn=l.players.findIndex(p=>p.id===s.id);h+=`<div style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-family:'Sora',sans-serif;color:var(--green);font-weight:700;font-size:.72rem">#${pn>=0?pn+1:'?'}</span><span style="font-weight:600;font-size:.82rem">${s.name}</span><span class="subtext" style="font-size:.64rem">${s.w}W ${s.l}L</span></div><div style="display:flex;gap:2px;align-items:flex-end">${s.courtHist.map((ch,ci)=>{const pct=(ch.court/maxC)*100;const r=s.roundRes[ci];return`<div style="flex:1;text-align:center;min-width:0"><div style="height:${Math.max(6,pct*.55)}px;background:${r?.won?'var(--green)':r?.tied?'var(--tie)':'var(--loss)'};border-radius:3px 3px 0 0;opacity:.75"></div><div style="font-size:.5rem;color:var(--muted);margin-top:1px;font-weight:600">${cName(ch.court,ss||{config:{courts:maxC}})}</div></div>`}).join('')}</div></div>`});h+='</div>'}
  if(has&&stats.length>=3){h+=`<div class="card fu"><h3 class="card-t">Podium</h3><div style="display:flex;gap:12px;justify-content:center;align-items:flex-end;padding:18px 0">${[{i:1,l:'2nd',h:70},{i:0,l:'1st',h:90},{i:2,l:'3rd',h:55}].map(p=>{const x=stats[p.i];if(!x)return'';const d=x.pf-x.pa;const pn=l.players.findIndex(q=>q.id===x.id);return`<div style="text-align:center;flex:1"><div style="font-family:'Sora',sans-serif;font-size:.64rem;color:var(--green);font-weight:700;margin-bottom:4px;letter-spacing:1px">${p.l}</div><div class="pod" style="padding-top:${p.h*.25}px"><div style="font-weight:700;font-size:.82rem">#${pn>=0?pn+1:'?'} ${x.name}</div><div class="subtext" style="font-size:.64rem;margin-top:2px">${x.w}W · ${d>0?'+':''}${d}</div></div></div>`}).join('')}</div></div>`}
  return h;
}

// ── RULES ──
function rRules(ss){
  const nC=ss.config.courts;const names=ss.config.courtNames||defaultCourtNames(nC);
  return`<div class="card fu"><h3 class="card-t">Session Format</h3>${[['Round Time',ss.config.roundMin+' min'],['Courts',names.join(', ')],['Rounds',ss.config.rounds],['Start',ss.config.startTime?formatTime12(ss.config.startTime):'—'],['Scoring',ss.config.scoreMode==='points'?'Points':'Win / Loss'],['Location',ss.config.place||'—']].map(([k,v])=>`<div class="cfg-row"><span class="subtext">${k}</span><span style="font-weight:600">${v}</span></div>`).join('')}</div>
  <div class="card fu"><h3 class="card-t">Movement Rules</h3><div class="rt-text"><p><strong style="color:var(--green)">Winners</strong> move up one court</p><p><strong style="color:var(--loss)">Losers</strong> move down one court</p><p>Partners split and play with new partners each round</p><p><strong style="color:var(--tie)">Ties</strong> — all players stay on the same court</p></div></div>
  <div class="card fu"><h3 class="card-t">How to Win</h3><div class="rt-text"><p>The player with the <strong>most cumulative points</strong> at the end of all rounds wins</p><p>Tiebreaker: point differential (points scored minus points allowed)</p><p>All rounds count equally — every point matters</p></div></div>
  <div class="card fu"><h3 class="card-t">Each Round</h3><div class="rt-text"><p>Play the full round duration regardless of score</p><p>When the timer sounds, finish the rally in progress</p><p>If tied when time expires, the game is a tie</p><p>Receiving team makes line calls</p></div></div>`;
}

// ── INIT ──
async function init(){ladders=await apiList();if(ladders.length){activeLadderId=ladders[0].id;const l=gL();if(l?.activeSeason)tab='overview'}render()}
document.addEventListener('DOMContentLoaded',init);
