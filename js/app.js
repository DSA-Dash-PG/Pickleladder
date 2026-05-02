// PICKLE FRIENDS — v4: Gamified dark theme, numpad scoring, court cards, player board
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b};
const fmtT=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}};
const fmt12=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);return`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
function cName(n,ss){if(!ss?.config?.courtNames?.length)return String.fromCharCode(65+(ss?.config?.courts||4)-n);const idx=ss.config.courtNames.length-n;return ss.config.courtNames[idx]||String.fromCharCode(65+idx)}
function defaultCourtNames(n){return Array.from({length:n},(_,i)=>String.fromCharCode(65+i))}
const pTag=(p,l)=>{if(!p||!l)return'?';const i=l.players.findIndex(x=>x.id===p.id);return'#'+(i>=0?i+1:'?')};
const pNum=(p,l)=>{const i=l.players.findIndex(x=>x.id===p.id);return i>=0?i+1:0};

// ── Text size preference (persisted) ──
let textSize=localStorage.getItem('pf_textSize')||'lg';
function setTextSize(s){textSize=s;localStorage.setItem('pf_textSize',s);applyTextSize();renderSizeBtns()}
function applyTextSize(){
  const m={sm:{'--cc-pname':'11px','--cc-score':'34px','--cc-score-empty':'22px','--cc-pad':'8px 7px 9px'},
            md:{'--cc-pname':'13px','--cc-score':'40px','--cc-score-empty':'26px','--cc-pad':'10px 8px 11px'},
            lg:{'--cc-pname':'15px','--cc-score':'48px','--cc-score-empty':'30px','--cc-pad':'13px 10px 14px'}};
  const vars=m[textSize]||m.lg;
  Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v))}
function renderSizeBtns(){
  ['sm','md','lg'].forEach(s=>{const b=document.getElementById('szBtn-'+s);if(b)b.classList.toggle('active',s===textSize)})}

// ── Numpad state ──
let npState=null; // {ri, ci, field, value}
function openNumpad(ri,ci,field){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const ct=ss.rounds[ri].courts[ci];
  const existing=ct.score?(field==='t1'?ct.score.t1:ct.score.t2):null;
  npState={ri,ci,field,value:existing!=null?String(existing):''};
  render()}
function npPress(d){if(!npState)return;if(npState.value.length>=2)return;npState.value+=d;renderNpDisplay()}
function npDel(){if(!npState)return;npState.value=npState.value.slice(0,-1);renderNpDisplay()}
function npQuick(v){if(!npState)return;npState.value=String(v);renderNpDisplay()}
function renderNpDisplay(){
  const el=document.getElementById('npScoreDisplay');
  if(el)el.textContent=npState.value===''?'--':npState.value+'_'.slice(0,1);}
async function npConfirm(){
  if(!npState)return;
  const v=npState.value===''?null:parseInt(npState.value);
  await _applyScore(npState.ri,npState.ci,npState.field,v);
  const other=npState.field==='t1'?'t2':'t1';
  const l=gL();const ss=gSS();
  if(l&&ss){const sc=ss.rounds[npState.ri].courts[npState.ci].score;
    const otherVal=other==='t1'?sc?.t1:sc?.t2;
    if(otherVal===null||otherVal===undefined){npState={...npState,field:other,value:''};render()}
    else{npState=null;render()}}
  else{npState=null;render()}}
function npCancel(){npState=null;render()}
function npSwitchField(field,existingVal){if(!npState)return;npState.field=field;npState.value=(existingVal!==null&&existingVal!==undefined&&existingVal!=='null')?String(existingVal):'';render()}

let ladders=[],activeLadderId=null,activeSessionId=null,isAdmin=false,adminPin='';
let view='dashboard',tab='overview',timer=0,timerOn=false,timerInt=null,pinEntry='',editingPid=null,mapOpen=false;
let formCourtCount=4,viewingRound=-1;
let swapMode=null;
let tkMode='top50',tkPickerOpen=false,tkPicked=new Set(),tkChart=null;
// Player board tab state
let pvTab='now'; // 'now' | 'next'
const tkPal=['#c8ff00','#00e5ff','#ffcc00','#ff5c47','#a78bfa','#34d399','#f472b6','#60a5fa','#fb923c','#4ade80','#e879f9','#38bdf8'];
const tkDash=[[],[5,5],[2,3],[8,4],[4,2,1,2],[1,4],[6,3],[3,6],[10,3],[2,6],[6,2],[4,4]];

async function apiList(){try{return(await(await fetch('/api?action=list')).json()).ladders||[]}catch{return[]}}
async function apiSave(l){try{const r=await fetch('/api?action=save',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':adminPin},body:JSON.stringify({ladder:l})});if(!r.ok){const d=await r.json();throw new Error(d.error)}return await r.json()}catch(e){console.error(e);alert('Save failed: '+e.message);return null}}
async function apiDel(id){try{return await(await fetch(`/api?action=delete&id=${id}`,{method:'DELETE',headers:{'X-Admin-Pin':adminPin}})).json()}catch{return null}}
async function apiVerifyPin(pin){try{const r=await fetch('/api?action=verify-pin',{headers:{'X-Admin-Pin':pin}});return(await r.json()).valid}catch{return false}}

function gL(){return ladders.find(l=>l.id===activeLadderId)||null}
function gS(){const l=gL();if(!l)return null;if(l.activeSeason){const s=l.seasons.find(x=>x.id===l.activeSeason);if(s)return s}return l.seasons.find(x=>!x.archived)||null}
function gSS(){const s=gS();return s?.sessions.find(ss=>ss.id===activeSessionId)||null}
function gParts(ss,l){if(!ss||!l)return[];if(!ss.participants||!ss.participants.length)return l.players.filter(p=>p.active!==false);return ss.participants.map(id=>l.players.find(p=>p.id===id)).filter(Boolean)}
async function save(l,skipRender){const i=ladders.findIndex(x=>x.id===l.id);if(i>=0)ladders[i]=l;else ladders.push(l);const r=await apiSave(l);if(r&&!skipRender)render();return r}

let scoreTimer=null;
// ── THE BUG FIX: submitScoreRound no longer calls render() directly ──
// Score is stored in memory and debounced to API. render() is NOT called here.
async function _applyScore(ri,ci,field,v){
  const l=gL();const ss=gSS();if(!l||!ss||!ss.rounds[ri])return;
  const ct=ss.rounds[ri].courts[ci];
  const sc=ct.score||{t1:null,t2:null,winner:null};
  sc[field]=v;
  if(sc.t1!==null&&sc.t2!==null){sc.winner=sc.t1===sc.t2?null:(sc.t1>sc.t2?'A':'B')}
  else{sc.winner=null}
  ct.score=sc;
  const idx=ladders.findIndex(x=>x.id===l.id);if(idx>=0)ladders[idx]=l;
  clearTimeout(scoreTimer);scoreTimer=setTimeout(()=>apiSave(l),800);}

// kept for win/loss mode (no numpad needed there)
async function submitScoreRound(ri,ci,f,v){await _applyScore(ri,ci,f,v===''?null:parseInt(v)||0);render()}
async function setWLRound(ri,ci,w){
  const l=gL();const ss=gSS();if(!l||!ss||!ss.rounds[ri])return;
  ss.rounds[ri].courts[ci].score={t1:w==='A'?1:0,t2:w==='B'?1:0,winner:w};await save(l)}

function makeCoed(group,pp){
  // Try all possible pairings and pick one with no repeat partners
  const g=group.filter(Boolean);
  if(g.length<2)return{t1:[g[0]||null,null],t2:[null,null]};
  const males=g.filter(p=>p.gender==='M'),females=g.filter(p=>p.gender==='F');
  // noRepeat: true if neither pair was together last round
  const noRepeat=(a,b,c,d)=>{if(!pp)return true;return pp[a?.id]!==b?.id&&pp[b?.id]!==a?.id&&pp[c?.id]!==d?.id&&pp[d?.id]!==c?.id};
  // Generate all valid pairings (A+B vs C+D where A≠C, A≠D)
  const pairings=[];
  if(males.length>=2&&females.length>=2){
    // Mixed doubles options: swap female or male
    pairings.push([[males[0],females[0]],[males[1],females[1]]]);
    pairings.push([[males[0],females[1]],[males[1],females[0]]]);
    if(males.length>2)pairings.push([[males[0],females[0]],[males[2],females[1]]]);
  } else {
    // Try all 3 ways to split 4 players into 2 pairs
    if(g[0]&&g[1]&&g[2]&&g[3]){
      pairings.push([[g[0],g[1]],[g[2],g[3]]]);
      pairings.push([[g[0],g[2]],[g[1],g[3]]]);
      pairings.push([[g[0],g[3]],[g[1],g[2]]]);
    } else if(males.length>=1&&females.length>=1){
      const others=g.filter(p=>p!==males[0]&&p!==females[0]);
      pairings.push([[males[0],females[0]],[others[0]||null,others[1]||null]]);
    }
  }
  // Pick first pairing with no repeat partners; fall back to first pairing
  const chosen=pairings.find(([a,b])=>noRepeat(a[0],a[1],b[0],b[1]))||pairings[0];
  if(!chosen)return{t1:[g[0]||null,g[1]||null],t2:[g[2]||null,g[3]||null]};
  return{t1:[chosen[0][0]||null,chosen[0][1]||null],t2:[chosen[1][0]||null,chosen[1][1]||null]};
}
function genR1(players,nC){const males=shuffle(players.filter(p=>p.gender==='M')),females=shuffle(players.filter(p=>p.gender==='F'));const courts=[];let mi=0,fi=0;for(let c=0;c<nC;c++){const g=[];for(let x=0;x<2;x++){if(mi<males.length)g.push(males[mi++])}for(let x=0;x<2;x++){if(fi<females.length)g.push(females[fi++])}while(g.length<4&&mi<males.length)g.push(males[mi++]);while(g.length<4&&fi<females.length)g.push(females[fi++]);const{t1,t2}=makeCoed(g,null);courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}return{courts,completed:false}}
function genNR(prev,nC){
  // Build previous-partner map so we can guarantee splits
  const pp={};
  prev.courts.forEach(c=>{
    [c.team1,c.team2].forEach(t=>{
      if(t[0]&&t[1]){pp[t[0].id]=t[1].id;pp[t[1].id]=t[0].id}})});

  // Movement rules:
  // Court nC (top/king): winners STAY (move to nC), losers DROP to nC-1
  // Court 1 (bottom):    winners RISE to 2,         losers STAY (move to 1)
  // All others:          winners RISE one,           losers DROP one
  // Everyone SPLITS — no repeat partners enforced by makeCoed
  const mvs=[];
  prev.courts.forEach(c=>{
    const all=[...(c.team1||[]),...(c.team2||[])].filter(Boolean);
    if(!c.score||!c.score.winner){
      // Unscored — keep on same court
      all.forEach(p=>mvs.push({p,to:c.court}));return}
    const w=c.score.winner==='A'?c.team1:c.team2;
    const lo=c.score.winner==='A'?c.team2:c.team1;
    // Winners move up (capped at nC — top court winners stay)
    w.filter(Boolean).forEach(p=>mvs.push({p,to:Math.min(nC,c.court+1)}));
    // Losers move down (floor at 1 — bottom court losers stay)
    lo.filter(Boolean).forEach(p=>mvs.push({p,to:Math.max(1,c.court-1)}));
  });

  // Bucket players by destination court
  const bk={};for(let i=1;i<=nC;i++)bk[i]=[];
  mvs.forEach(m=>{if(bk[m.to])bk[m.to].push(m.p)});

  // Shuffle within each bucket (randomises team assignment within the court)
  // then pair with makeCoed which enforces no-repeat-partner rule
  for(let i=1;i<=nC;i++)bk[i]=shuffle(bk[i]);

  const courts=[];
  for(let c=0;c<nC;c++){
    const g=bk[c+1]||[];
    const{t1,t2}=makeCoed(g.slice(0,4),pp);
    courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}
  return{courts,completed:false}}

function calcStats(sessions,players){
  const s={};players.forEach(p=>{s[p.id]={id:p.id,name:p.name,gender:p.gender,w:0,l:0,t:0,pf:0,pa:0,best:0,attended:0,courtHist:[],roundRes:[],streak:0,maxStreak:0,roundPts:[]}});
  sessions.forEach(sess=>{const played=new Set();
    sess.rounds.forEach((round,ri)=>{round.courts.forEach(c=>{if(!c.score||c.score.t1===null||c.score.t1===undefined||c.score.t2===null||c.score.t2===undefined||!c.score.winner)return;const{t1,t2,winner}=c.score;
      [[c.team1,t1,t2,winner==='A'],[c.team2,t2,t1,winner==='B']].forEach(([team,sc,al,won])=>{team.filter(Boolean).forEach(p=>{if(!s[p.id])return;played.add(p.id);s[p.id].pf+=sc;s[p.id].pa+=al;
        if(won){s[p.id].w++;s[p.id].streak=s[p.id].streak>0?s[p.id].streak+1:1;s[p.id].maxStreak=Math.max(s[p.id].maxStreak,s[p.id].streak)}else{s[p.id].l++;s[p.id].streak=s[p.id].streak<0?s[p.id].streak-1:-1}
        s[p.id].best=Math.max(s[p.id].best,c.court);s[p.id].courtHist.push({round:ri+1,court:c.court});s[p.id].roundRes.push({round:ri+1,court:c.court,won,pf:sc,pa:al,diff:sc-al});s[p.id].roundPts.push(sc)})})})});
    played.forEach(id=>{if(s[id])s[id].attended++})});
  return Object.values(s).sort((a,b)=>b.pf!==a.pf?b.pf-a.pf:(b.pf-b.pa)-(a.pf-a.pa))}

function getRoundMVPs(round,ladder){
  if(!round||!ladder)return{male:[],female:[]};const perfs=[];
  round.courts.forEach(c=>{if(!c.score||!c.score.winner)return;const{t1,t2}=c.score;
    [[c.team1,t1-t2],[c.team2,t2-t1]].forEach(([team,diff])=>{team.filter(Boolean).forEach(p=>{const rosterP=ladder.players.find(x=>x.id===p.id);const gender=rosterP?.gender||p.gender||'M';perfs.push({p:{...p,gender},diff,court:c.court})})})});
  const sorted=perfs.sort((a,b)=>b.diff-a.diff);
  const seen=new Set();
  const top=(gender)=>sorted.filter(x=>x.p.gender===gender&&!seen.has(x.p.id)&&seen.add(x.p.id)).slice(0,2);
  const male=top('M');const female=top('F');
  return{male,female}}

function calcPartners(sessions,players){
  const pairs={};sessions.forEach(sess=>{sess.rounds.forEach(round=>{round.courts.forEach(c=>{if(!c.score||c.score.t1===null||c.score.t2===null)return;const won=c.score.winner;
    [c.team1,c.team2].forEach((team,ti)=>{if(team[0]&&team[1]){const key=[team[0].id,team[1].id].sort().join('-');if(!pairs[key])pairs[key]={p1:team[0],p2:team[1],w:0,l:0};const teamWon=(ti===0&&won==='A')||(ti===1&&won==='B');if(teamWon)pairs[key].w++;else if(won!=='T')pairs[key].l++}})})})});
  return Object.values(pairs).sort((a,b)=>(b.w/(b.w+b.l||1))-(a.w/(a.w+a.l||1)))}

// Timer
function startTimer(){const ss=gSS();if(!ss)return;if(timer===0)timer=ss.config.roundMin*60;timerOn=true;clearInterval(timerInt);timerInt=setInterval(()=>{timer--;if(timer<=0){timer=0;timerOn=false;clearInterval(timerInt)}rTimer()},1000);render()}
function pauseTimer(){timerOn=false;clearInterval(timerInt);render()}
function endTimer(){timerOn=false;clearInterval(timerInt);timer=0;render()}
function resetTimer(ss){clearInterval(timerInt);timerOn=false;timer=(ss?.config?.roundMin||12)*60}
function rTimer(){['td','stickyTd'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent=fmtT(timer);el.classList.toggle('urgent',timer<=60)}});const ss=gSS();['tf','stickyTf'].forEach(id=>{const bar=document.getElementById(id);if(bar&&ss){bar.style.width=(timer/(ss.config.roundMin*60))*100+'%';bar.style.background=timer<=60?'#ff5c47':timer<=180?'#ffcc00':'#c8ff00'}})}
function editTimer(){const cur=Math.ceil(timer/60);const n=prompt('Set timer (minutes):',cur);if(n===null)return;const mins=parseInt(n);if(isNaN(mins)||mins<0||mins>60)return alert('Enter 0-60.');timer=mins*60;rTimer();render()}
function shouldMapOpen(ss){if(!ss?.config?.startTime||!ss.date)return false;try{const[h,m]=ss.config.startTime.split(':').map(Number);const start=new Date(ss.date+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00');return(start-new Date())/60000<=60&&(start-new Date())/60000>=-120}catch{return false}}

// PIN
function openPin(){pinEntry='';document.getElementById('pinModal').style.display='flex';rPD()}
function closePin(){pinEntry='';document.getElementById('pinModal').style.display='none';document.getElementById('pinErr').textContent=''}
function pinPress(d){if(pinEntry.length>=4)return;pinEntry+=d;rPD();if(pinEntry.length===4)setTimeout(checkPin,150)}
function pinDel(){pinEntry=pinEntry.slice(0,-1);rPD();document.getElementById('pinErr').textContent=''}
function rPD(){for(let i=0;i<4;i++){const d=document.getElementById('pd'+i);if(d){d.style.background=i<pinEntry.length?'#c8ff00':'transparent';d.style.borderColor=i<pinEntry.length?'#c8ff00':'rgba(255,255,255,0.13)'}}}
async function checkPin(){const v=await apiVerifyPin(pinEntry);if(v){adminPin=pinEntry;isAdmin=true;closePin();render()}else{document.getElementById('pinErr').textContent='Incorrect PIN';pinEntry='';rPD();setTimeout(()=>{const e=document.getElementById('pinErr');if(e)e.textContent=''},2000)}}
function lockAdmin(){isAdmin=false;adminPin='';render()}

// Player management
function openEditPlayer(pid){const l=gL();if(!l)return;const p=l.players.find(x=>x.id===pid);if(!p)return;editingPid=pid;document.getElementById('edName').value=p.name;document.getElementById('edGender').value=p.gender;document.getElementById('editModal').classList.add('open')}
function closeEditModal(){document.getElementById('editModal').classList.remove('open');editingPid=null}
async function saveEditPlayer(){const l=gL();if(!l||!editingPid)return;const p=l.players.find(x=>x.id===editingPid);if(!p)return;const nn=document.getElementById('edName').value.trim()||p.name;const ng=document.getElementById('edGender').value;p.name=nn;p.gender=ng;const s=gS();if(s){s.sessions.forEach(sess=>{sess.rounds.forEach(round=>{round.courts.forEach(ct=>{[ct.team1,ct.team2].forEach(team=>{team.forEach((tp,i)=>{if(tp&&tp.id===editingPid){team[i]={...tp,name:nn,gender:ng}}})})})})})}closeEditModal();await save(l)}
async function replacePlayer(oldPid){const l=gL();if(!l)return;const oldP=l.players.find(x=>x.id===oldPid);if(!oldP)return;const n=prompt('New player name to replace '+oldP.name+':');if(!n?.trim())return;const g=prompt('Gender (M/F):','M');if(g!=='M'&&g!=='F')return;const newP={id:uid(),name:n.trim(),gender:g,active:true};l.players.push(newP);oldP.active=false;const ss=gSS();if(ss){if(ss.participants){const idx=ss.participants.indexOf(oldPid);if(idx>=0)ss.participants[idx]=newP.id}ss.rounds.forEach(round=>{round.courts.forEach(ct=>{[ct.team1,ct.team2].forEach(team=>{team.forEach((tp,i)=>{if(tp&&tp.id===oldPid){team[i]={...newP}}})})})})}await save(l)}
async function addPlayer(){const l=gL();if(!l)return;const n=document.getElementById('fPN')?.value?.trim();const g=document.getElementById('fPG')?.value||'M';if(!n)return;l.players.push({id:uid(),name:n,gender:g,active:true});document.getElementById('fPN').value='';await save(l)}
async function deactivatePlayer(pid){const l=gL();if(!l||!confirm('Deactivate this player? They will be hidden from the picker but their historical stats are preserved.'))return;const p=l.players.find(x=>x.id===pid);if(p)p.active=false;await save(l)}
async function reactivatePlayer(pid){const l=gL();if(!l)return;const p=l.players.find(x=>x.id===pid);if(p)p.active=true;await save(l)}
async function toggleParticipant(pid){const l=gL();const ss=gSS();if(!l||!ss)return;if(ss.started)return;if(!ss.participants)ss.participants=l.players.filter(p=>p.active!==false).map(p=>p.id);const idx=ss.participants.indexOf(pid);if(idx>=0)ss.participants.splice(idx,1);else ss.participants.push(pid);await save(l)}
async function selectAllParticipants(){const l=gL();const ss=gSS();if(!l||!ss||ss.started)return;ss.participants=l.players.filter(p=>p.active!==false).map(p=>p.id);await save(l)}
async function deselectAllParticipants(){const l=gL();const ss=gSS();if(!l||!ss||ss.started)return;ss.participants=[];await save(l)}
async function addAndSelect(){const l=gL();const ss=gSS();if(!l)return;const n=document.getElementById('fPN')?.value?.trim();const g=document.getElementById('fPG')?.value||'M';if(!n)return;const p={id:uid(),name:n,gender:g,active:true};l.players.push(p);if(ss&&!ss.started){if(!ss.participants)ss.participants=[];ss.participants.push(p.id)}document.getElementById('fPN').value='';await save(l)}

function toggleMap(){mapOpen=!mapOpen;render()}
function viewRound(ri){viewingRound=ri;swapMode=null;npState=null;render()}
function updateCourtInputs(){const n=parseInt(document.getElementById('fSC')?.value)||4;formCourtCount=n;const c=document.getElementById('courtNamesContainer');if(!c)return;const names=defaultCourtNames(n);c.innerHTML='<label class="lbl">Court names (top to bottom)</label><div style="display:grid;grid-template-columns:repeat('+Math.min(n,4)+',1fr);gap:6px">'+names.map((nm,i)=>'<input id="fCN'+i+'" class="inp" value="'+nm+'" style="text-align:center;font-family:\'Sora\',sans-serif;font-weight:700;font-size:.9rem;padding:8px 4px">').join('')+'</div>'}
function getFormCourtNames(){const n=formCourtCount;const names=[];for(let i=0;i<n;i++){const el=document.getElementById('fCN'+i);names.push(el?.value?.trim()||String.fromCharCode(65+i))}return names}

async function createLadder(){const n=document.getElementById('fLN')?.value?.trim();if(!n)return;const l={id:uid(),name:n,players:[],seasons:[],activeSeason:null,createdAt:Date.now()};const r=await save(l);if(r){activeLadderId=l.id;view='dashboard';tab='overview';render()}}
async function deleteLadderAction(){const l=gL();if(!l||!confirm('Delete this league permanently?'))return;await apiDel(l.id);ladders=ladders.filter(x=>x.id!==l.id);activeLadderId=ladders[0]?.id||null;view='dashboard';render()}
async function createSeason(){const n=document.getElementById('fSN')?.value?.trim();const l=gL();if(!l||!n)return;const s={id:uid(),name:n,sessions:[],createdAt:Date.now()};l.seasons.push(s);l.activeSeason=s.id;await save(l);view='dashboard';tab='overview';render()}
async function createSessionAction(){const l=gL();const s=gS();if(!l||!s)return;const cn=getFormCourtNames();const ss={id:uid(),name:document.getElementById('fSName')?.value?.trim()||'',date:document.getElementById('fSD')?.value||new Date().toISOString().split('T')[0],config:{courts:formCourtCount,rounds:parseInt(document.getElementById('fSR')?.value)||6,roundMin:parseInt(document.getElementById('fSM')?.value)||12,scoreMode:document.getElementById('fSO')?.value||'points',place:document.getElementById('fSP')?.value||'',startTime:document.getElementById('fST')?.value||'',courtNames:cn},participants:l.players.filter(p=>p.active!==false).map(p=>p.id),rounds:[],currentRound:-1,started:false,finished:false,createdAt:Date.now()};s.sessions.push(ss);await save(l);activeSessionId=ss.id;view='session';tab='play';render()}
async function startSessionAction(){const l=gL();const ss=gSS();if(!l||!ss)return;const parts=gParts(ss,l);if(parts.length<4)return alert('Need at least 4 participants. Go to the Roster tab to select players.');ss.rounds=[genR1(parts,ss.config.courts)];ss.currentRound=0;ss.started=true;resetTimer(ss);tab='play';mapOpen=true;await save(l)}
async function finishLadderEarly(){const l=gL();const ss=gSS();if(!l||!ss)return;if(!confirm('End this ladder now?'))return;ss.finished=true;tab='stats';await save(l)}
async function nextRound(){const l=gL();const ss=gSS();if(!l||!ss)return;const tied=ss.rounds[ss.currentRound].courts.filter(c=>c.score&&c.score.t1!==null&&c.score.t2!==null&&!c.score.winner);if(tied.length)return alert(tied.length+' court(s) have tied scores. There are no ties — remove the last point so there is a winner.');const un=ss.rounds[ss.currentRound].courts.filter(c=>!c.score);if(un.length&&!confirm(un.length+' court(s) unscored. Continue?'))return;if(ss.currentRound>=ss.config.rounds-1){ss.finished=true;tab='stats';await save(l);return}ss.rounds.push(genNR(ss.rounds[ss.currentRound],ss.config.courts));ss.currentRound++;viewingRound=-1;npState=null;resetTimer(ss);await save(l)}
async function reshuffleRound(){const l=gL();const ss=gSS();if(!l||!ss||!confirm('Reshuffle? Scores cleared.'))return;const all=[];ss.rounds[ss.currentRound].courts.forEach(c=>[...c.team1,...c.team2].filter(Boolean).forEach(p=>all.push(p)));ss.rounds[ss.currentRound]=genR1(all,ss.config.courts);npState=null;await save(l)}
async function restartRound(ri){const l=gL();const ss=gSS();if(!l||!ss)return;if(!confirm('Restart Round '+(ri+1)+'? All rounds after it will be removed.'))return;ss.rounds[ri].courts.forEach(c=>{c.score=null});ss.rounds=ss.rounds.slice(0,ri+1);ss.currentRound=ri;ss.finished=false;viewingRound=-1;npState=null;resetTimer(ss);await save(l)}
function beginSwap(ri,ci,ti,pi){if(!isAdmin)return;if(swapMode){doSwap(ri,ci,ti,pi);return}swapMode={ri,ci,ti,pi};render()}
async function doSwap(ri,ci,ti,pi){if(!swapMode)return;const l=gL();const ss=gSS();if(!l||!ss)return;const round=ss.rounds[ri];if(!round)return;const src=swapMode;const srcTeam=src.ti===0?round.courts[src.ci].team1:round.courts[src.ci].team2;const dstTeam=ti===0?round.courts[ci].team1:round.courts[ci].team2;const tmp=srcTeam[src.pi];srcTeam[src.pi]=dstTeam[pi];dstTeam[pi]=tmp;swapMode=null;await save(l)}
function cancelSwap(){swapMode=null;render()}
async function renameLadder(){const l=gL();if(!l)return;const n=prompt('League name:',l.name);if(n?.trim()){l.name=n.trim();await save(l)}}
async function renameSeason(){const l=gL();const s=gS();if(!l||!s)return;const n=prompt('Season name:',s.name);if(n?.trim()){s.name=n.trim();await save(l)}}
async function editSessionName(){const l=gL();const ss=gSS();if(!l||!ss)return;const n=prompt('Ladder name:',ss.name||'');if(n!==null){ss.name=n.trim();await save(l)}}
async function editSessionDate(){const l=gL();const ss=gSS();if(!l||!ss)return;const d=prompt('Date (YYYY-MM-DD):',ss.date);if(d?.trim()){ss.date=d.trim();await save(l)}}
async function editSessionTime(){const l=gL();const ss=gSS();if(!l||!ss)return;const t=prompt('Start time (HH:MM):',ss.config.startTime||'');if(t!==null){ss.config.startTime=t.trim();await save(l)}}
async function editSessionPlace(){const l=gL();const ss=gSS();if(!l||!ss)return;const p=prompt('Location:',ss.config.place||'');if(p!==null){ss.config.place=p.trim();await save(l)}}
async function archiveSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s||!confirm('Archive "'+s.name+'"?'))return;s.archived=true;if(l.activeSeason===sid){const a=l.seasons.find(x=>!x.archived);l.activeSeason=a?.id||null}await save(l)}
async function unarchiveSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s)return;s.archived=false;l.activeSeason=sid;await save(l)}
async function deleteSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s||!confirm('Delete "'+s.name+'" permanently?'))return;l.seasons=l.seasons.filter(x=>x.id!==sid);if(l.activeSeason===sid)l.activeSeason=l.seasons[0]?.id||null;await save(l)}
async function archiveSession(ssid){const l=gL();const s=gS();if(!l||!s)return;const ss=s.sessions.find(x=>x.id===ssid);if(!ss||!confirm('Archive "'+(ss.name||fmtDate(ss.date))+'"?'))return;ss.archived=true;if(activeSessionId===ssid)activeSessionId=null;await save(l)}
async function unarchiveSession(ssid){const l=gL();const s=gS();if(!l||!s)return;const ss=s.sessions.find(x=>x.id===ssid);if(!ss)return;ss.archived=false;await save(l)}
async function deleteSession(ssid){const l=gL();const s=gS();if(!l||!s)return;const ss=s.sessions.find(x=>x.id===ssid);if(!ss||!confirm('Delete permanently?'))return;s.sessions=s.sessions.filter(x=>x.id!==ssid);if(activeSessionId===ssid)activeSessionId=null;await save(l)}

function go(v,t){view=v;if(t)tab=t;viewingRound=-1;swapMode=null;npState=null;if(v==='newSession')formCourtCount=4;render();if(v==='newSession')setTimeout(updateCourtInputs,10)}
function selectLadder(id){activeLadderId=id;activeSessionId=null;view='dashboard';tab='overview';viewingRound=-1;render()}
function openSession(id){activeSessionId=id;view='session';viewingRound=-1;swapMode=null;npState=null;const ss=gSS();const finished=ss?.finished;tab='play';if(finished&&!isAdmin)pvTab='now';mapOpen=ss?shouldMapOpen(ss)||ss.started:false;render()}
function setPvTab(t){pvTab=t;render()}

function tkSetMode(m){tkMode=m;tkPicked.clear();render();setTimeout(tkRenderChart,10)}
function tkTogglePicker(){tkPickerOpen=!tkPickerOpen;render();setTimeout(tkRenderChart,10)}
function tkTogglePlayer(id){if(tkPicked.has(id))tkPicked.delete(id);else tkPicked.add(id);render();setTimeout(tkRenderChart,10)}
function tkRenderChart(){
  const canvas=document.getElementById('tkCanvas');if(!canvas||!window.Chart)return;
  const l=gL();const ss=gSS();const s=gS();if(!l)return;
  const sessions=ss?[ss]:(s?s.sessions:[]);const stats=calcStats(sessions,l.players).filter(x=>x.roundPts.length>0);if(!stats.length)return;
  const ranked=[...stats].sort((a,b)=>b.pf-a.pf);let visible;
  if(tkPicked.size>0)visible=ranked.filter(p=>tkPicked.has(p.id));else if(tkMode==='top50')visible=ranked.slice(0,Math.ceil(ranked.length/2));else visible=ranked;
  const cntEl=document.getElementById('tkCount');if(cntEl)cntEl.textContent='Showing '+visible.length+' of '+ranked.length;
  const maxRounds=Math.max(...visible.map(p=>p.roundPts.length));const labels=Array.from({length:maxRounds},(_,i)=>'Rd '+(i+1));
  const datasets=visible.map((p,i)=>{const ci=ranked.indexOf(p)%tkPal.length;let cum=0;const data=p.roundPts.map(r=>{cum+=r;return cum});return{label:'#'+pNum(p,l)+' '+p.name,data,borderColor:tkPal[ci],backgroundColor:tkPal[ci]+'15',borderWidth:2.5,borderDash:tkDash[ci%tkDash.length],pointRadius:5,pointBackgroundColor:tkPal[ci],pointBorderColor:'#111',pointBorderWidth:2,pointHoverRadius:7,tension:.25,fill:false,roundPts:p.roundPts}});
  if(tkChart)tkChart.destroy();
  tkChart=new Chart(canvas,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#18181f',titleColor:'#f4f4f0',bodyColor:'#7a7a8a',borderColor:'rgba(255,255,255,0.1)',borderWidth:1,padding:10,cornerRadius:8,callbacks:{label:ctx=>{const rp=ctx.dataset.roundPts[ctx.dataIndex];return ctx.dataset.label+': '+Math.round(ctx.raw)+' pts (+'+rp+')'}}}},scales:{y:{beginAtZero:true,ticks:{color:'rgba(255,255,255,0.25)',font:{size:11}},grid:{color:'rgba(255,255,255,0.05)'},border:{display:false}},x:{ticks:{color:'rgba(255,255,255,0.25)',font:{size:11},autoSkip:false},grid:{display:false},border:{display:false}}},layout:{padding:{top:4,right:8}}}});
  const lgEl=document.getElementById('tkLegend');if(lgEl)lgEl.innerHTML=visible.map((p,i)=>{const ci=ranked.indexOf(p)%tkPal.length;return'<span class="tk-legend-item"><span class="tk-legend-swatch" style="background:'+tkPal[ci]+'"></span>#'+pNum(p,l)+' '+p.name+'</span>'}).join('');
  const chEl=document.getElementById('tkChips');if(chEl)chEl.innerHTML=ranked.map(p=>'<button class="tk-chip'+(tkPicked.has(p.id)?' on':'')+'" onclick="tkTogglePlayer(\''+p.id+'\')">#'+pNum(p,l)+' '+p.name+'</button>').join('')}

// ── Shared round MVP renderer ──
function rRoundMVPs(round,vr,ss,l){
  const {male,female}=getRoundMVPs(round,l);
  const allScored=round.courts.every(c=>c.score&&c.score.winner);
  if(!allScored||(!male.length&&!female.length))return'';
  const mkCard=(mv,label,clr,bg)=>{const n=pNum(mv.p,l);return'<div class="mvp-card fu"><div class="mvp-header"><div class="mvp-icon" style="background:'+bg+'"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="'+clr+'" stroke-width="3"><path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9Z"/></svg></div><span class="mvp-label">'+label+'</span></div><div class="mvp-name">#'+n+' '+mv.p.name+'</div><div class="mvp-val">'+(mv.diff>0?'+':'')+mv.diff+' diff</div><div class="mvp-sub">Court '+cName(mv.court,ss)+'</div></div>'};
  let h='<div style="font-size:.7rem;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Round '+(vr+1)+' MVPs</div>';
  h+='<div class="mvp-grid">';
  if(male.length)h+=mkCard(male[0],'🏆 Mens MVP','#5b9fff','rgba(59,130,246,0.1)');
  if(female.length)h+=mkCard(female[0],'🏆 Womens MVP','#ff69a0','rgba(255,45,120,0.1)');
  if(male.length>1)h+=mkCard(male[1],'Mens #2','#5b9fff','rgba(59,130,246,0.07)');
  if(female.length>1)h+=mkCard(female[1],'Womens #2','#ff69a0','rgba(255,45,120,0.07)');
  h+='</div>';return h}

// ═══════════════════════════════════════════════════
// COURT CARD RENDERER — Jersey + Split Panel + SVG court
// ═══════════════════════════════════════════════════
function rCourtCard(ct,ci,vr,ss,l,adminMode){
  const nC=ss.config.courts;
  const sc=ct.score;
  const h1=sc&&sc.t1!==null&&sc.t1!==undefined;
  const h2=sc&&sc.t2!==null&&sc.t2!==undefined;
  const hb=h1&&h2;
  const w=hb?sc.winner:null;
  const nm=cName(ct.court,ss);
  const isTop=ct.court===nC;
  const isBot=ct.court===1;
  const isKitchen=isTop;

  const accents={[nC]:{col:'#ffcc00',dim:'rgba(255,204,0,0.18)',bd:'rgba(255,204,0,0.35)',stripe:'#1c1400,#1c1400 5px,#140f00 5px,#140f00 10px',bg:'#0a0800'},
                 [nC-1]:{col:'#00e5ff',dim:'rgba(0,229,255,0.15)',bd:'rgba(0,229,255,0.3)',stripe:'#001618,#001618 5px,#000e10 5px,#000e10 10px',bg:'#000c10'},
                 [nC-2]:{col:'#3b82f6',dim:'rgba(59,130,246,0.12)',bd:'rgba(59,130,246,0.25)',stripe:'#000a20,#000a20 5px,#000718 5px,#000718 10px',bg:'#00081a'}};
  const acc=accents[ct.court]||{col:'#a78bfa',dim:'rgba(167,139,250,0.12)',bd:'rgba(167,139,250,0.3)',stripe:'#0e0a1a,#0e0a1a 5px,#080612 5px,#080612 10px',bg:'#0a0814'};

  const wTeam=w==='A'?ct.team1:ct.team2;
  const lTeam=w==='A'?ct.team2:ct.team1;
  const wScore=w==='A'?sc?.t1:sc?.t2;
  const lScore=w==='A'?sc?.t2:sc?.t1;
  const wNames=hb&&w?wTeam.filter(Boolean).map(p=>p.name).join(' + '):'';
  const lNames=hb&&w?lTeam.filter(Boolean).map(p=>p.name).join(' + '):'';
  const wNamesShort=hb&&w?wTeam.filter(Boolean).map(p=>p.name.split(' ')[0]).join(' + '):'';
  const lNamesShort=hb&&w?lTeam.filter(Boolean).map(p=>p.name.split(' ')[0]).join(' + '):'';

  // movement badges with arrows
  let wMove='',lMove='',wArrow='',lArrow='';
  if(hb&&w){
    if(isTop){wMove='Stay &amp; split';wArrow='&#x21D5;';lMove='&#8595; '+cName(Math.max(1,ct.court-1),ss);lArrow='&#8595;'}
    else if(isBot){wMove='&#8593; '+cName(Math.min(nC,ct.court+1),ss);wArrow='&#8593;';lMove='Stay &amp; split';lArrow='&#x21D5;'}
    else{wMove='&#8593; '+cName(Math.min(nC,ct.court+1),ss);wArrow='&#8593;';lMove='&#8595; '+cName(Math.max(1,ct.court-1),ss);lArrow='&#8595;'}}
  let footWin='',footLose='';
  if(!hb||!w){
    if(isTop){footWin='Winners &#x21D5; stay &amp; split';footLose='Losers &#8595; '+cName(Math.max(1,ct.court-1),ss)}
    else if(isBot){footWin='Winners &#8593; '+cName(Math.min(nC,ct.court+1),ss);footLose='Losers &#x21D5; stay &amp; split'}
    else{footWin='Winners &#8593; '+cName(Math.min(nC,ct.court+1),ss);footLose='Losers &#8595; '+cName(Math.max(1,ct.court-1),ss)}}

  const winGlow=isKitchen?'rgba(255,204,0,0.75)':'rgba(200,255,0,0.65)';
  const winGlowSoft=isKitchen?'rgba(255,204,0,0.28)':'rgba(200,255,0,0.22)';
  const winScoreCol=isKitchen?'#ffcc00':'#c8ff00';

  let h='<div class="fu" style="border:1px solid '+acc.bd+';border-radius:14px;overflow:hidden;margin-bottom:10px">';

  // ── Jersey header ──
  h+='<div style="background:repeating-linear-gradient(45deg,'+acc.stripe+');border-bottom:2px solid '+acc.col+';padding:7px 12px;display:flex;align-items:center;justify-content:space-between">';
  h+='<div style="display:flex;align-items:center;gap:8px">';
  if(isKitchen){h+='<div style="width:28px;height:28px;border-radius:50%;background:'+acc.col+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000;flex-shrink:0">'+nm+'</div>';}
  else{h+='<div style="width:28px;height:28px;border-radius:50%;background:'+acc.dim+';border:2px solid '+acc.col+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:'+acc.col+';flex-shrink:0">'+nm+'</div>';}
  h+='<div>';
  if(isKitchen){h+='<div style="font-size:10px;font-weight:900;color:'+acc.col+';letter-spacing:.07em;text-transform:uppercase">&#128081; Owns the Kitchen</div><div style="font-size:7px;color:rgba(255,204,0,0.45);margin-top:1px">Top court &#183; Winners stay &amp; split</div>';}
  else{h+='<div style="font-size:10px;font-weight:900;color:'+acc.col+';letter-spacing:.07em;text-transform:uppercase">Court '+nm+'</div>';}
  h+='</div></div>';
  if(hb&&w){h+='<span style="font-size:12px;font-weight:900;color:#c8ff00;letter-spacing:.02em">'+sc.t1+' &#8211; '+sc.t2+'</span>';}
  else{h+='<span style="font-size:7px;font-weight:800;color:#444;text-transform:uppercase;letter-spacing:.08em">'+(adminMode?'Tap to score':'Not scored')+'</span>';}
  h+='</div>';

  // ── Split panels ──
  if(hb&&w){
    h+='<div style="display:grid;grid-template-columns:1fr 1fr">';
    // Winner panel
    h+='<div style="background:'+(isKitchen?'#1a1000':'#0d1f00')+';padding:10px 12px;text-align:center">';
    h+='<div style="font-size:7px;font-weight:900;color:'+winScoreCol+';text-transform:uppercase;letter-spacing:.14em;margin-bottom:5px">Winner</div>';
    // Names as "P1 + P2" on one line, clickable for swap in admin
    const wNameStr=wTeam.filter(Boolean).map(p=>p.name).join(' + ');
    const lNameStr=lTeam.filter(Boolean).map(p=>p.name).join(' + ');
    if(adminMode){
      wTeam.filter(Boolean).forEach((p,pi)=>{const isSrc=swapMode&&swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===(w==='A'?0:1)&&swapMode.pi===pi;h+='<div style="font-size:12px;font-weight:700;'+(isSrc?'color:#ffcc00;opacity:.5;text-decoration:line-through':'color:#f4f4f0')+';margin-bottom:3px;line-height:1.35;cursor:pointer;background:rgba(255,255,255,0.05);border-radius:8px;padding:3px 8px;display:inline-block" onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+(w==='A'?0:1)+','+pi+')">'+p.name+'</div>'});
    } else {h+='<div style="font-size:12px;font-weight:700;color:#f4f4f0;margin-bottom:6px;line-height:1.35">'+wNameStr+'</div>';}
    h+='<div style="font-size:44px;font-weight:900;color:'+winScoreCol+';line-height:1;letter-spacing:-.03em;text-shadow:0 0 18px '+winGlow+',0 0 36px '+winGlowSoft+'">'+wScore+'</div>';
    h+='<div style="display:inline-flex;align-items:center;gap:3px;margin-top:6px;font-size:8px;font-weight:900;background:'+winScoreCol+';color:#000;padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.06em">'+wMove+'</div>';
    h+='</div>';
    // Loser panel
    h+='<div style="background:#1a0000;padding:10px 12px;text-align:center;border-left:1px solid rgba(255,92,71,0.08)">';
    h+='<div style="font-size:7px;font-weight:900;color:rgba(255,92,71,0.7);text-transform:uppercase;letter-spacing:.14em;margin-bottom:5px">Loser</div>';
    if(adminMode){
      lTeam.filter(Boolean).forEach((p,pi)=>{const isSrc=swapMode&&swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===(w==='A'?1:0)&&swapMode.pi===pi;h+='<div style="font-size:12px;font-weight:700;'+(isSrc?'color:#ffcc00;opacity:.5;text-decoration:line-through':'color:rgba(255,255,255,0.55)')+';margin-bottom:3px;line-height:1.35;cursor:pointer;background:rgba(255,255,255,0.05);border-radius:8px;padding:3px 8px;display:inline-block" onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+(w==='A'?1:0)+','+pi+')">'+p.name+'</div>'});
    } else {h+='<div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.35);margin-bottom:6px;line-height:1.35">'+lNameStr+'</div>';}
    h+='<div style="font-size:44px;font-weight:900;color:rgba(255,92,71,0.3);line-height:1;letter-spacing:-.03em">'+lScore+'</div>';
    h+='<div style="display:inline-flex;align-items:center;gap:3px;margin-top:6px;font-size:8px;font-weight:900;background:rgba(255,92,71,0.15);color:rgba(255,92,71,0.7);border:1px solid rgba(255,92,71,0.25);padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.06em">'+lMove+'</div>';
    h+='</div></div>';
    // Footer
    h+='<div style="padding:5px 12px;font-size:7px;font-weight:700;color:rgba(255,255,255,0.28);background:'+acc.bg+';border-top:1px solid rgba(255,255,255,0.04);letter-spacing:.03em">';
    h+=wNamesShort+' '+wMove.replace(/&#8593;/g,'↑').replace(/&#8595;/g,'↓').replace(/&#x21D5;/g,'↕').replace(/&amp;/g,'&').toLowerCase()+' &#183; '+lNamesShort+' '+lMove.replace(/&#8593;/g,'↑').replace(/&#8595;/g,'↓').replace(/&#x21D5;/g,'↕').replace(/&amp;/g,'&').toLowerCase();
    h+='</div>';
  } else {
    // Unscored panels
    const mkPanel=(team,side,isRight)=>{
      const fld=side==='A'?'t1':'t2';const ti=side==='A'?0:1;
      const onclk=adminMode?` onclick="openNumpad(${vr},${ci},'${fld}')" style="cursor:pointer;text-align:center;background:${acc.bg};padding:10px 12px${isRight?';border-left:1px solid rgba(255,255,255,0.04)':''}"`:`style="text-align:center;background:${acc.bg};padding:10px 12px${isRight?';border-left:1px solid rgba(255,255,255,0.04)':''}"`;
      let p='<div '+onclk+'>';
      p+='<div style="font-size:7px;font-weight:900;color:'+acc.col+';opacity:.65;text-transform:uppercase;letter-spacing:.14em;margin-bottom:5px">Team '+side+'</div>';
      if(adminMode&&swapMode){team.filter(Boolean).forEach((pl,pi)=>{const isSrc=swapMode&&swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===ti&&swapMode.pi===pi;p+='<div style="font-size:12px;font-weight:700;'+(isSrc?'color:#ffcc00;opacity:.5;text-decoration:line-through':'color:rgba(255,255,255,0.7)')+';margin-bottom:3px;line-height:1.35;cursor:pointer;background:rgba(255,255,255,0.06);border-radius:8px;padding:3px 8px;display:inline-block" onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+ti+','+pi+')">'+pl.name+'</div>'})}
      else{const nameStr=team.filter(Boolean).map(pl=>pl.name).join(' + ')||'TBD';p+='<div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:6px;line-height:1.35">'+nameStr+'</div>';}
      p+='<div style="font-size:40px;font-weight:900;line-height:1;color:'+acc.col+';opacity:.1;letter-spacing:-.03em">--</div>';
      if(adminMode)p+='<div style="font-size:7px;color:rgba(255,255,255,0.18);margin-top:6px">Tap to score</div>';
      p+='</div>';return p};
    h+='<div style="display:grid;grid-template-columns:1fr 1fr">';
    h+=mkPanel(ct.team1,'A',false);
    h+=mkPanel(ct.team2,'B',true);
    h+='</div>';
    h+='<div style="padding:5px 12px;font-size:7px;font-weight:700;color:#333;background:'+acc.bg+';border-top:1px solid rgba(255,255,255,0.04)">'+footWin+' &#183; '+footLose+'</div>';
  }

  // numpad rendered as centered overlay in render()

  // ── Win/Loss mode ──
  if(adminMode&&ss.config.scoreMode==='winloss'){
    h+='<div style="display:flex;gap:8px;padding:8px 12px 10px">';
    h+='<button class="wlb'+(w==='A'?' aa':'')+'" onclick="setWLRound('+vr+','+ci+',\'A\')">'+(w==='A'?'\u2713 Winner \u2014 ':'')+'Team A</button>';
    h+='<button class="wlb'+(w==='B'?' ab':'')+'" onclick="setWLRound('+vr+','+ci+',\'B\')">'+(w==='B'?'\u2713 Winner \u2014 ':'')+'Team B</button>';
    h+='</div>'}

  // ── Tie warning ──
  if(adminMode&&hb&&!w)h+='<div class="th" style="padding:6px 12px 8px">Scores tied \u2014 remove the last point to determine a winner</div>';

  h+='</div>';return h}

// ═══════════════════════════════════════════════════
// PLAYER VIEW — Now Playing/Up Next (active) or Round History/Final Stats (completed)
// ═══════════════════════════════════════════════════
function rPlayerView(l,ss){
  const nC=ss.config.courts;
  const isCurrent=viewingRound===-1||viewingRound===ss.currentRound;
  const vr=isCurrent?ss.currentRound:viewingRound;
  const round=ss.rounds[vr];
  if(!round)return'';
  let h='';

  // ── COMPLETED LADDER ──
  if(ss.finished){
    h+='<div class="round-pills" style="padding:8px 12px 0">';
    for(let ri=0;ri<=ss.currentRound;ri++){
      const isV=(!isCurrent&&ri===vr)||(isCurrent&&ri===ss.currentRound);
      const done=ss.rounds[ri]?.courts.every(c=>c.score&&c.score.winner);
      h+='<button class="rd-pill'+(isV?' active':'')+'" onclick="viewRound('+(ri===ss.currentRound?-1:ri)+')">Rd '+(ri+1)+(done?' ✓':'')+'</button>'}
    h+='</div>';
    h+='<div class="pv-tabs">';
    h+='<button class="pv-tab'+(pvTab==='now'?' on':'')+'" onclick="setPvTab(\'now\')">Round History</button>';
    h+='<button class="pv-tab'+(pvTab==='stats'?' on':'')+'" onclick="setPvTab(\'stats\')">Final Stats</button>';
    h+='</div>';
    // Round History
    h+='<div class="pv-panel'+(pvTab==='now'?' active':'')+'" id="pv-now">';
    h+='<div class="pv-sec-label" style="padding:8px 12px 0">Round '+(vr+1)+' — all courts</div>';
    h+='<div class="court-grid" style="padding:8px 12px 0">';
    [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,false)});
    h+='</div>';
    h+=rRoundMVPs(round,vr,ss,l);
    h+='</div>';
    // Final Stats
    h+='<div id="pv-stats" style="display:'+(pvTab==='stats'?'block':'none')+';padding:10px 12px">';
    const sStats=calcStats([ss],l.players);
    h+=rStats(sStats,null,l,ss);
    h+='</div>';
    return h}

  // ── ACTIVE LADDER ──
  if(ss.currentRound>0){
    h+='<div class="round-pills" style="padding:8px 12px 0">';
    for(let ri=0;ri<=ss.currentRound;ri++){
      const isV=(isCurrent&&ri===ss.currentRound)||(!isCurrent&&ri===vr);
      const done=ss.rounds[ri]?.courts.every(c=>c.score&&c.score.winner);
      h+='<button class="rd-pill'+(isV?' active':'')+'" onclick="viewRound('+(ri===ss.currentRound?-1:ri)+')">Rd '+(ri+1)+(done?' ✓':'')+'</button>'}
    h+='</div>'}
  const timerPct=(timer/(ss.config.roundMin*60))*100;
  const timerColor=timer<=60?'#ff5c47':timer<=180?'#ffcc00':'#c8ff00';
  h+='<div style="background:var(--surf2);border-bottom:1px solid var(--border);padding:8px 14px;display:flex;align-items:center;gap:12px">';
  h+='<div><div style="font-family:\'Sora\',sans-serif;font-size:22px;font-weight:900;color:var(--lime);font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1">'+fmtT(timer)+'</div>';
  h+='<div style="font-size:.65rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.07em;margin-top:2px">On clock</div></div>';
  h+='<div style="flex:1"><div style="height:4px;background:var(--surf4);border-radius:2px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:'+timerPct+'%;background:'+timerColor+';border-radius:2px;transition:width 1s linear"></div></div>';
  h+='<div style="font-size:.78rem;color:var(--muted)">Finish rally when timer hits zero</div></div></div>';
  h+='<div class="pv-tabs">';
  h+='<button class="pv-tab'+(pvTab==='now'?' on':'')+'" onclick="setPvTab(\'now\')">Now Playing</button>';
  h+='<button class="pv-tab'+(pvTab==='next'?' on':'')+'" onclick="setPvTab(\'next\')">Up Next</button>';
  h+='</div>';
  // Now Playing
  h+='<div class="pv-panel'+(pvTab==='now'?' active':'')+'" id="pv-now">';
  h+='<div class="pv-sec-label">Round '+(vr+1)+' — all courts</div>';
  h+='<div class="court-grid">';
  [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
    h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,false)});
  h+='</div>';
  h+=rRoundMVPs(round,vr,ss,l);
  const scored=round.courts.filter(c=>c.score&&c.score.winner).length;
  const total=round.courts.length;
  h+='<div class="round-progress"><div class="rp-label">Round progress</div><div class="rp-dots">';
  round.courts.forEach((_,i)=>{
    const done=round.courts[i].score&&round.courts[i].score.winner;
    const partial=round.courts[i].score&&(round.courts[i].score.t1!==null||round.courts[i].score.t2!==null)&&!done;
    h+='<div class="rp-dot'+(done?' done':partial?' partial':'')+'"></div>'});
  h+='</div><div class="rp-pct">'+scored+' / '+total+' courts</div></div>';
  h+='</div>';
  // Up Next
  h+='<div class="pv-panel'+(pvTab==='next'?' active':'')+'" id="pv-next">';
  const nextRd=vr+1;
  const isFinalRound=nextRd>=ss.config.rounds;
  const nextRoundExists=ss.rounds[nextRd]!=null;
  if(isFinalRound){
    h+='<div class="card" style="text-align:center;padding:32px 24px"><div style="font-size:2rem;margin-bottom:10px">🥒</div>';
    h+='<div style="font-weight:900;font-size:1.1rem;color:var(--lime);margin-bottom:6px">See you at the next ladder!</div>';
    h+='<div class="subtext">This is the final round. Check the Stats tab for final standings.</div></div>';
  } else if(nextRoundExists){
    h+='<div class="pv-sec-label">Round '+nextRd+' — lineups</div>';
    h+='<div class="court-grid">';
    [...ss.rounds[nextRd].courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      h+=rCourtCard(ct,ss.rounds[nextRd].courts.indexOf(ct),nextRd,ss,l,false)});
    h+='</div>';
  } else {
    h+='<div class="pv-sec-label">Round '+nextRd+' — projected</div>';
    const allScored=round.courts.every(c=>c.score&&c.score.winner);
    if(!allScored){h+='<div class="upnext-banner"><div class="upnext-banner-icon">⏳</div><div><div class="upnext-banner-top">Waiting on scores</div><div class="upnext-banner-bot">Lineups lock in once all courts are scored</div></div></div>'}
    [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      const sc=ct.score;const w=sc?.winner;const nm=cName(ct.court,ss);
      const isTop=ct.court===nC;const isBot=ct.court===1;
      const ltrCls=ct.court===nC?'cc-ltr-gold':ct.court===nC-1?'cc-ltr-cyan':ct.court===nC-2?'cc-ltr-blue':'cc-ltr-gray';
      h+='<div class="next-cc"><div class="next-cc-hdr"><div style="display:flex;align-items:center;gap:7px"><div class="cc-ltr '+ltrCls+'" style="width:24px;height:24px;border-radius:6px;font-size:12px">'+nm+'</div>';
      h+='<span class="next-cc-title">Court '+nm+(isTop?' · Owns the Kitchen':'')+'</span></div>';
      if(isTop)h+='<span class="next-cc-cond next-cond-win">Winners stay</span>';
      else if(isBot)h+='<span class="next-cc-cond next-cond-lose">Losers stay</span>';
      else h+='<span class="next-cc-cond" style="color:var(--muted)">Mixed movement</span>';
      h+='</div><div class="next-cc-body"><div class="next-team-col">';
      if(isTop){
        h+='<div class="next-from"><div class="cc-ltr '+ltrCls+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+nm+'</div><span class="next-from-txt">Winners split</span></div>';
        if(w){(w==='A'?ct.team1:ct.team2).filter(Boolean).forEach(p=>h+='<div class="next-name">'+p.name+'</div>')}
        else h+='<div class="next-name tbd">Pending...</div>'}
      else{const fromNm=cName(Math.min(nC,ct.court+1),ss);const fromCls=ct.court+1===nC?'cc-ltr-gold':ct.court+1===nC-1?'cc-ltr-cyan':'cc-ltr-blue';
        h+='<div class="next-from"><div class="cc-ltr '+fromCls+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+fromNm+'</div><span class="next-from-txt">Winners of '+fromNm+'</span></div><div class="next-name tbd">Pending...</div>'}
      h+='</div><div class="next-vs">VS</div><div class="next-team-col">';
      if(isBot){
        h+='<div class="next-from"><div class="cc-ltr '+ltrCls+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+nm+'</div><span class="next-from-txt">Losers split</span></div>';
        if(w){(w==='A'?ct.team2:ct.team1).filter(Boolean).forEach(p=>h+='<div class="next-name">'+p.name+'</div>')}
        else h+='<div class="next-name tbd">Pending...</div>'}
      else{const fromNm2=cName(Math.max(1,ct.court-1),ss);const fromCls2=ct.court-1===0?'cc-ltr-gray':ct.court-1===nC-2?'cc-ltr-blue':'cc-ltr-cyan';
        h+='<div class="next-from"><div class="cc-ltr '+fromCls2+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+fromNm2+'</div><span class="next-from-txt">Losers of '+fromNm2+'</span></div><div class="next-name tbd">Pending...</div>'}
      h+='</div></div></div>'});}
  h+='</div>';
  return h}

// ═══════════════════════════════════════════════════
// ADMIN PLAY VIEW
// ═══════════════════════════════════════════════════
function rPlay(l,ss){
  const nC=ss.config.courts;const parts=gParts(ss,l);
  if(!ss.started)return'<div class="card fu" style="text-align:center;padding:28px"><h3 class="heading" style="font-size:1.05rem;color:var(--lime);margin-bottom:6px">'+(ss.name||'Ladder')+'</h3><p class="subtext" style="margin-bottom:2px">'+fmtDate(ss.date)+(ss.config.startTime?' · '+fmt12(ss.config.startTime):'')+'</p><p class="subtext" style="margin-bottom:14px">'+parts.length+' players · '+nC+' courts · '+ss.config.rounds+' rounds</p>'+(isAdmin?(parts.length>=4?'<button class="bp full" style="padding:14px;font-size:.92rem" onclick="startSessionAction()">Generate lineups &amp; start</button>':'<p style="color:var(--warn);font-size:.82rem">Need at least 4 participants. Go to Roster tab to select players.</p>'):'<p class="subtext">Lineups will appear when the ladder starts.</p>')+'</div>';
  const isCurrent=viewingRound===-1||viewingRound===ss.currentRound,vr=isCurrent?ss.currentRound:viewingRound;
  const round=ss.rounds[vr];if(!round)return'';let h='';

  // Sticky timer
  if(isCurrent&&ss.started&&!ss.finished){
    h+='<div class="sticky-timer" id="stickyTimer"><div class="sticky-timer-inner">';
    h+='<div class="sticky-timer-rd">Rd '+(ss.currentRound+1)+'/'+ss.config.rounds+'</div>';
    h+='<div class="sticky-timer-time'+(timer<=60?' urgent':'')+'" id="stickyTd">'+fmtT(timer)+'</div>';
    h+='<div class="sticky-timer-bar"><div class="sticky-timer-fill" id="stickyTf" style="width:'+(timer/(ss.config.roundMin*60))*100+'%;background:'+(timer<=60?'#ff5c47':timer<=180?'#ffcc00':'#c8ff00')+'"></div></div>';
    h+='</div></div>'}

  // Text size strip
  h+='<div class="size-strip">';
  h+='<span class="size-strip-label">Text size</span>';
  h+='<div class="sz-btns">';
  ['sm','md','lg'].forEach(s=>h+='<button class="sz-btn '+s+(textSize===s?' active':'')+'" id="szBtn-'+s+'" onclick="setTextSize(\''+s+'\')">A</button>');
  h+='</div></div>';

  // Round header + timer
  if(isCurrent){
    h+='<div class="round-hdr fu"><div><div class="overline">Round</div><div class="round-num">'+(ss.currentRound+1)+' <span class="round-of">of '+ss.config.rounds+'</span></div></div>';
    h+='<div id="td" class="timer-disp'+(timer<=60?' urgent':'')+'">'+fmtT(timer)+'</div></div>';
    h+='<div class="timer-bar"><div id="tf" class="timer-fill" style="width:'+(timer/(ss.config.roundMin*60))*100+'%;background:'+(timer<=60?'#ff5c47':timer<=180?'#ffcc00':'#c8ff00')+'"></div></div>';
    if(isAdmin){
      h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
      h+=timerOn?'<button class="bw" style="flex:1;padding:11px" onclick="pauseTimer()">⏸ Pause</button>':'<button class="bp" style="flex:2;padding:11px" onclick="startTimer()">'+(timer===0?'Start timer':'Resume')+'</button>';
      h+='<button class="bg-btn" style="flex:1;padding:11px" onclick="editTimer()">Edit</button>';
      h+='<button class="bds" style="flex:1;padding:11px" onclick="endTimer()">End</button></div>';
      h+='<div style="display:flex;gap:8px;margin-bottom:12px">';
      h+='<button class="bg-btn" style="flex:1" onclick="reshuffleRound()">Reshuffle</button>';
      h+='<button class="bp" style="flex:2" onclick="nextRound()">'+(ss.currentRound>=ss.config.rounds-1?'Finish ladder':'Next round')+'</button>';
      h+='</div>';
      if(ss.currentRound<ss.config.rounds-1)h+='<div style="margin-bottom:12px"><button class="bds full" onclick="finishLadderEarly()">End ladder early</button></div>';
    }}
  else{
    h+='<div class="viewing-banner fu"><div class="subtext" style="font-size:.7rem">Viewing</div>';
    h+='<h3 class="heading" style="font-size:.98rem;color:var(--lime);margin:3px 0">Round '+(vr+1)+'</h3>';
    h+=(isAdmin?'<button class="bds" style="margin-top:8px;font-size:.78rem;padding:7px 14px" onclick="restartRound('+vr+')">Restart this round</button>':'')+'</div>'}

  // Round selector
  h+='<div class="round-pills">';
  for(let ri=0;ri<=ss.currentRound;ri++){
    const isV=(isCurrent&&ri===ss.currentRound)||(!isCurrent&&ri===vr);
    const done=ss.rounds[ri]?.courts.every(c=>c.score&&c.score.winner);
    h+='<button class="rd-pill'+(isV?' active':'')+'" onclick="viewRound('+(ri===ss.currentRound?-1:ri)+')">Rd '+(ri+1)+(ri===ss.currentRound?' ·':done?' ✓':'')+'</button>'}
  h+='</div>';

  // Swap banner
  if(swapMode){
    const srcR=ss.rounds[swapMode.ri];const srcCt=srcR?.courts[swapMode.ci];
    const srcT=swapMode.ti===0?srcCt?.team1:srcCt?.team2;const srcP=srcT?.[swapMode.pi];
    h+='<div class="swap-banner fu">Swapping <strong>'+(srcP?.name||'?')+'</strong> — tap another player <button class="edit-btn" style="color:var(--warn);text-decoration:underline;margin-left:8px" onclick="cancelSwap()">Cancel</button></div>'}

  // MVPs
  h+=rRoundMVPs(round,vr,ss,l);

  // Court map (collapsible)
  const isOpen=mapOpen||shouldMapOpen(ss);
  h+='<div class="map-toggle'+(isOpen?' open':'')+'" onclick="toggleMap()"><span class="label">Court map — Rd '+(vr+1)+'</span><span class="arrow">▼</span></div>';
  h+='<div class="court-map'+(isOpen?' open':'')+'">';
  [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
    const nm=cName(ct.court,ss);const sc=ct.score;const hb=sc&&sc.t1!==null&&sc.t2!==null;
    h+='<div class="cmc'+(hb?' scored':'')+'"><div class="cmc-ltr">Ct '+nm+'</div><div class="cmc-match">'+ct.team1.filter(Boolean).map(p=>pTag(p,l)).join(' &amp; ')+'<span class="vs-s">vs</span>'+ct.team2.filter(Boolean).map(p=>pTag(p,l)).join(' &amp; ')+'</div>'+(hb?'<div class="cmc-score">'+sc.t1+' – '+sc.t2+'</div>':'')+'</div>'});
  h+='</div>';

  // Court cards — admin mode (2-col grid on iPad)
  h+='<div class="court-grid">';
  [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
    const ci=round.courts.indexOf(ct);
    h+=rCourtCard(ct,ci,vr,ss,l,true)});
  h+='</div>';

  // Next round / finish buttons also at bottom for convenience
  if(isAdmin&&isCurrent){
    h+='<div style="display:flex;gap:8px;margin-top:4px">';
    h+='<button class="bp full" onclick="nextRound()">'+(ss.currentRound>=ss.config.rounds-1?'Finish ladder':'Next round')+'</button>';
    h+='</div>';
    if(ss.currentRound<ss.config.rounds-1)h+='<div style="margin-top:8px"><button class="bds full" onclick="finishLadderEarly()">End ladder early</button></div>'}
  if(!isCurrent)h+='<div style="margin-top:10px"><button class="bp full" onclick="viewRound(-1)">Back to current round</button></div>';
  if(ss.finished)h+='<div class="card fu" style="margin-top:12px;text-align:center;padding:20px"><div style="font-size:1.6rem;margin-bottom:6px">🏆</div><h3 class="heading" style="font-size:1rem;color:var(--lime);margin-bottom:4px">Ladder complete!</h3><p class="subtext">Check the Stats tab for final results.</p></div>';
  return h}

// ── Stats, Rules, Players, Roster, Admin — unchanged logic, updated styling ──
function rStats(stats,season,l,ss){const has=stats.length>0&&stats.some(s=>s.w+s.l+s.t>0);let h='';const sessions=ss?[ss]:(season?season.sessions:[]);const isFinished=ss?ss.finished:false;
  if(has&&stats.length>=3){const sp=isFinished?'<span class="status-pill final">Final</span>':(ss?'<span class="status-pill live"><span class="dot"></span>Rd '+(ss.currentRound+1)+' of '+ss.config.rounds+'</span>':'<span class="status-pill live"><span class="dot"></span>In progress</span>');
    h+='<div class="card fu"><div class="card-t">Standings '+sp+'</div><div class="podium-wrap">';
    [{i:1,medal:'2nd',cls:'p2'},{i:0,medal:'1st',cls:'p1 first'},{i:2,medal:'3rd',cls:'p3'}].forEach(p=>{const x=stats[p.i];if(!x)return;const pn=pNum(x,l);h+='<div class="pod-col"><div class="pod-medal'+(p.i===0?' first':'')+'">'+p.medal+'</div><div class="pod-bar '+p.cls.split(' ')[0]+'"><div class="pod-num">#'+pn+'</div><div class="pod-name">'+x.name+'</div><div class="pod-stat">'+x.w+'W '+x.l+'L</div><div class="pod-pts">'+x.pf+'</div></div></div>'});
    h+='</div></div>'}
  if(has){
    const topCtName=(s)=>{if(!s.courtHist.length)return'—';const best=Math.max(...s.courtHist.map(x=>x.court));const refSS=ss||(season?.sessions?.slice().reverse().find(x=>x.started));const nC=refSS?.config?.courts||4;const idx=(refSS?.config?.courtNames?.length||0)-best;return refSS?.config?.courtNames?.[idx]||String.fromCharCode(65+nC-best)};
    h+='<div class="card fu"><h3 class="card-t">'+(ss?(ss.name||'Results'):'Season standings')+'</h3>';
    h+='<div style="overflow-x:auto;margin:0 -18px;padding:0 18px"><table class="st"><thead><tr>'+['#','Player','LP','W','L','Pts','+/-','Avg','Top Ct','Strk'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>';
    stats.filter(s=>s.w+s.l+s.t>0).forEach((s,i)=>{const d=s.pf-s.pa;const pn=pNum(s,l);const sk=s.streak;const skStr=sk>0?'W'+sk:sk<0?'L'+Math.abs(sk):'—';const avg=s.roundPts.length?(Math.round(s.pf/s.roundPts.length*10)/10).toFixed(1):0;const tc=topCtName(s);
      h+='<tr><td class="'+(i<3?'rt':'')+'">'+(["1st","2nd","3rd"][i]||(i+1))+'</td>';
      h+='<td style="font-weight:600"><span style="font-family:\'Sora\',sans-serif;color:var(--lime);font-weight:700;font-size:.72rem;margin-right:4px">#'+pn+'</span>'+s.name+'</td>';
      h+='<td style="color:var(--lime);font-weight:700">'+s.attended+'</td>';
      h+='<td class="at">'+s.w+'</td><td class="rdt">'+s.l+'</td><td>'+s.pf+'</td>';
      h+='<td style="font-weight:700;color:'+(d>=0?'var(--lime)':'var(--loss)')+'">'+(d>0?'+':'')+d+'</td>';
      h+='<td style="color:var(--text-sec)">'+avg+'</td>';
      h+='<td style="color:var(--cyan);font-size:.72rem;font-weight:700">'+tc+'</td>';
      h+='<td style="color:'+(sk>0?'var(--lime)':sk<0?'var(--loss)':'var(--muted)')+';font-weight:600">'+skStr+'</td></tr>'});
    h+='</tbody></table></div></div>'}
  if(has){const ac=stats.filter(s=>s.w+s.l+s.t>0);const avg=ac.length?Math.round(stats.reduce((a,x)=>a+x.pf,0)/ac.length):0;h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'+[{l:'High score',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)},{l:'Avg pts/player',v:avg}].map(c=>'<div class="chip"><div class="chip-n">'+c.v+'</div><div class="chip-l">'+c.l+'</div></div>').join('')+'</div>'}
  if(has){const ws=stats.filter(s=>Math.abs(s.streak)>=2||s.maxStreak>=3).sort((a,b)=>Math.abs(b.streak)-Math.abs(a.streak)).slice(0,5);
    if(ws.length){h+='<div class="card fu"><h3 class="card-t">Streaks</h3>';ws.forEach(s=>{const pn=pNum(s,l);const hot=s.streak>0;h+='<div class="streak-row"><div class="streak-badge '+(hot?'hot':'cold')+'">'+(hot?'W':'L')+Math.abs(s.streak)+'</div><div class="streak-name">#'+pn+' '+s.name+'</div><div class="streak-detail">'+(s.streak===s.w&&s.l===0?'Undefeated':'Current')+'</div></div>'});h+='</div>'}}
  if(has&&stats.some(s=>s.roundRes.length>=3)){const l3=stats.filter(s=>s.roundRes.length>=3).map(s=>{const r=s.roundRes.slice(-3);return{...s,l3diff:r.reduce((a,x)=>a+x.diff,0)}});const hot=[...l3].sort((a,b)=>b.l3diff-a.l3diff)[0];const cold=[...l3].sort((a,b)=>a.l3diff-b.l3diff)[0];const bestRd={p:stats[0],rd:0,diff:0};stats.forEach(s=>s.roundRes.forEach((r,i)=>{if(r.diff>bestRd.diff){bestRd.p=s;bestRd.rd=i;bestRd.diff=r.diff}}));const con=stats.filter(s=>s.roundPts.length>=3).map(s=>{const avg=s.pf/s.roundPts.length;const v=s.roundPts.reduce((a,p)=>a+Math.pow(p-avg,2),0)/s.roundPts.length;return{...s,variance:v}}).sort((a,b)=>a.variance-b.variance)[0];
    h+='<div class="card fu"><h3 class="card-t">Hot and cold</h3><div class="hot-grid"><div class="hot-card"><div class="hot-label">On fire</div><div class="hot-name">#'+pNum(hot,l)+' '+hot.name+'</div><div class="hot-val up">'+(hot.l3diff>0?'+':'')+hot.l3diff+' last 3 rds</div></div><div class="hot-card"><div class="hot-label">Ice cold</div><div class="hot-name">#'+pNum(cold,l)+' '+cold.name+'</div><div class="hot-val down">'+(cold.l3diff>0?'+':'')+cold.l3diff+' last 3 rds</div></div><div class="hot-card"><div class="hot-label">Round MVP</div><div class="hot-name">#'+pNum(bestRd.p,l)+' '+bestRd.p.name+'</div><div class="hot-val up">+'+bestRd.diff+' in Rd '+(bestRd.rd+1)+'</div></div>'+(con?'<div class="hot-card"><div class="hot-label">Most consistent</div><div class="hot-name">#'+pNum(con,l)+' '+con.name+'</div><div class="hot-val up">'+Math.round(con.pf/con.roundPts.length)+' avg</div></div>':'')+'</div></div>'}
  if(has){const prs=calcPartners(sessions,l.players).filter(p=>p.w+p.l>=2).slice(0,5);if(prs.length){h+='<div class="card fu"><h3 class="card-t">Best partnerships</h3><div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">Win rate when paired together</div>';prs.forEach(p=>{const wr=Math.round(p.w/(p.w+p.l)*100);h+='<div class="partner-row"><div class="partner-pair">#'+pNum(p.p1,l)+' '+p.p1.name.split(' ')[0]+' + #'+pNum(p.p2,l)+' '+p.p2.name.split(' ')[0]+'</div><div class="partner-rec">'+p.w+'-'+p.l+'</div><div class="partner-bar"><div class="partner-fill" style="width:'+wr+'%"></div></div></div>'});h+='</div>'}}
  if(has&&stats.some(s=>s.roundPts.length>0)){h+='<div class="card fu"><h3 class="card-t">Player tracker</h3><div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">Cumulative points across rounds</div><div class="tk-controls"><div class="tk-toggle"><button class="'+(tkMode==='top50'&&tkPicked.size===0?'active':'')+'" onclick="tkSetMode(\'top50\')">Top 50%</button><button class="'+(tkMode==='all'&&tkPicked.size===0?'active':'')+'" onclick="tkSetMode(\'all\')">All</button></div><button class="tk-picker-btn'+(tkPicked.size>0?' has-picks':'')+'" id="tkPickerBtn" onclick="tkTogglePicker()">Pick players</button><span class="tk-count" id="tkCount"></span></div><div class="tk-player-list'+(tkPickerOpen?' open':'')+'" id="tkChips"></div><div class="tk-legend" id="tkLegend"></div><div style="position:relative;width:100%;height:240px"><canvas id="tkCanvas" role="img" aria-label="Cumulative points tracker"></canvas></div></div>'}
  return h}

function rRules(ss){const nC=ss.config.courts;const names=ss.config.courtNames||defaultCourtNames(nC);
  return'<div class="card fu"><h3 class="card-t">Ladder format</h3>'+[['Round time',ss.config.roundMin+' min'],['Courts',names.join(', ')],['Rounds',ss.config.rounds],['Start',ss.config.startTime?fmt12(ss.config.startTime):'—'],['Scoring',ss.config.scoreMode==='points'?'Points':'Win / Loss'],['Location',ss.config.place||'—']].map(([k,v])=>'<div class="cfg-row"><span class="subtext">'+k+'</span><span style="font-weight:600">'+v+'</span></div>').join('')+'</div><div class="card fu"><h3 class="card-t">Movement</h3><div class="rt-text"><p><strong style="color:var(--lime)">Winners</strong> move up one court</p><p><strong style="color:var(--loss)">Losers</strong> move down one court</p><p><strong style="color:var(--gold)">Winner on top court (Owns the Kitchen — '+names[0]+')</strong> stays but <strong>splits partners</strong></p><p><strong style="color:var(--loss)">Loser on bottom court ('+names[names.length-1]+')</strong> stays but <strong>splits partners</strong></p><p>Partners split each round</p><p><strong style="color:var(--danger)">No ties</strong> — there is always a winner</p></div></div><div class="card fu"><h3 class="card-t">How to win</h3><div class="rt-text"><p>Most <strong>cumulative points</strong> at the end wins</p><p>Tiebreaker: point differential</p><p>Every round counts equally</p></div></div><div class="card fu"><h3 class="card-t">Each round</h3><div class="rt-text"><p>Play the full round duration</p><p>When timer sounds, finish the rally in progress</p><p>If the score is tied when time expires, the <strong>last point does NOT count</strong> — whoever was ahead before it wins</p><p>There must always be a winner and a loser</p><p>Receiving team makes line calls</p></div></div>'}

function rPlayers(l){let h='';const active=l.players.filter(p=>p.active!==false);const inactive=l.players.filter(p=>p.active===false);
  if(isAdmin)h+='<div class="card fu"><h3 class="card-t">Add player to league</h3><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key===\'Enter\')addPlayer()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addPlayer()">Add</button></div>';
  h+='<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Active players</h3><span class="pill ok">'+active.length+'</span></div>';
  if(!active.length)h+='<p class="subtext" style="text-align:center;padding:20px">No active players.</p>';
  else h+=active.map((p,i)=>'<div class="pr"><div class="pn">'+(l.players.indexOf(p)+1)+'</div><span style="flex:1;font-weight:600;font-size:.88rem">'+p.name+'</span><span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span>'+(isAdmin?'<button class="edit-btn" onclick="openEditPlayer(\''+p.id+'\')">Edit</button><button class="edit-btn" style="color:var(--loss)" onclick="deactivatePlayer(\''+p.id+'\')">Deactivate</button>':'')+'</div>').join('');
  h+='</div>';
  if(inactive.length){h+='<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Inactive players</h3><span class="pill">'+inactive.length+'</span></div>';
    h+=inactive.map(p=>'<div class="pr" style="opacity:.5"><div class="pn" style="background:var(--surf4);color:var(--muted)">'+(l.players.indexOf(p)+1)+'</div><span style="flex:1;font-weight:600;font-size:.88rem">'+p.name+'</span><span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span>'+(isAdmin?'<button class="edit-btn" onclick="openEditPlayer(\''+p.id+'\')">Edit</button><button class="edit-btn" style="color:var(--lime)" onclick="reactivatePlayer(\''+p.id+'\')">Activate</button>':'')+'</div>').join('');
    h+='</div>'}
  return h}

function rSessionRoster(l,ss){let h='';const parts=ss.participants||[];const activePlayers=l.players.filter(p=>p.active!==false);const nSelected=parts.length;
  if(isAdmin)h+='<div class="card fu"><h3 class="card-t">Add new player</h3><div style="font-size:.72rem;color:var(--muted);margin-bottom:8px">Adds to league roster and selects for this ladder</div><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key===\'Enter\')addAndSelect()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addAndSelect()">Add &amp; select</button></div>';
  h+='<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 class="card-t" style="margin:0">Ladder participants</h3><span class="pill '+(nSelected>=4?'ok':'')+'" style="'+(nSelected<4?'background:var(--warn-bg);color:var(--warn);border-color:var(--warn-bd)':'')+'">'+nSelected+' selected</span></div>';
  h+='<div style="font-size:.72rem;color:var(--muted);margin-bottom:12px">Tap to select who is playing this ladder'+(ss.started?' (locked — ladder started)':'')+'</div>';
  if(isAdmin&&!ss.started)h+='<div style="display:flex;gap:8px;margin-bottom:12px"><button class="bg-btn" style="flex:1;font-size:.74rem;padding:8px" onclick="selectAllParticipants()">Select all</button><button class="bg-btn" style="flex:1;font-size:.74rem;padding:8px" onclick="deselectAllParticipants()">Deselect all</button></div>';
  h+=activePlayers.map(p=>{const isIn=parts.includes(p.id);const pn=l.players.indexOf(p)+1;const canToggle=isAdmin&&!ss.started;return'<div class="pr pick-row'+(isIn?' pick-in':'')+'"'+(canToggle?' onclick="toggleParticipant(\''+p.id+'\')" style="cursor:pointer"':'')+'><div class="pick-check">'+(isIn?'✓':'')+'</div><div class="pn'+(isIn?'':'" style="background:var(--surf4);color:var(--muted)')+'">'+pn+'</div><span style="flex:1;font-weight:600;font-size:.88rem">'+p.name+'</span><span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span>'+(isAdmin?'<button class="edit-btn" onclick="event.stopPropagation();openEditPlayer(\''+p.id+'\')">Edit</button>':'')+(isAdmin&&ss.started?'<button class="edit-btn" style="color:var(--warn)" onclick="event.stopPropagation();replacePlayer(\''+p.id+'\')">Swap</button>':'')+'</div>'}).join('');
  h+='</div>';
  if(nSelected<4)h+='<div style="text-align:center;padding:10px"><p style="color:var(--warn);font-size:.82rem">Need at least 4 participants to start.</p></div>';
  return h}

function rAdmin(l,s){let h='';
  h+='<div class="admin-hierarchy fu"><div class="ah-title">Setup hierarchy</div><div class="ah-row"><div class="ah-num">1</div><div class="ah-info"><div class="ah-label">League</div><div class="ah-desc">Top level. All stats roll up here.</div></div></div><div class="ah-line"></div><div class="ah-row"><div class="ah-num">2</div><div class="ah-info"><div class="ah-label">Season</div><div class="ah-desc">Time period. Stats combine across all ladders.</div></div></div><div class="ah-line"></div><div class="ah-row"><div class="ah-num">3</div><div class="ah-info"><div class="ah-label">Ladder</div><div class="ah-desc">A single play event.</div></div></div></div>';
  h+='<div class="admin-section fu s1"><div class="admin-section-t"><span class="ah-badge">1</span> League</div><div class="cfg-row"><span class="subtext">Name</span><span style="font-weight:600">'+l.name+' <button class="edit-btn" onclick="renameLadder()">Edit</button></span></div><div style="display:flex;gap:6px;margin-top:10px"><button class="bp" style="flex:1" onclick="go(\'newLadder\')">New league</button><button class="bd" style="flex:1" onclick="deleteLadderAction()">Delete</button></div></div>';
  const active=l.seasons.filter(x=>!x.archived),archived=l.seasons.filter(x=>x.archived);
  h+='<div class="admin-section fu s2"><div class="admin-section-t"><span class="ah-badge">2</span> Season</div><div class="cfg-row"><span class="subtext">Current</span><span style="font-weight:600">'+s.name+' <button class="edit-btn" onclick="renameSeason()">Edit</button></span></div>'+(active.length>1?'<div style="margin-top:8px"><label class="lbl">Switch season</label><select class="inp" onchange="gL().activeSeason=this.value;save(gL())">'+active.map(x=>'<option value="'+x.id+'"'+(x.id===l.activeSeason?' selected':'')+'>'+x.name+'</option>').join('')+'</select></div>':'')+'<div style="display:flex;gap:6px;margin-top:10px"><button class="bp" style="flex:1" onclick="go(\'newSeason\')">New season</button><button class="bg-btn" style="flex:1" onclick="archiveSeason(\''+s.id+'\')">Archive</button></div>'+(archived.length?'<div style="margin-top:10px"><label class="lbl">Archived</label>'+archived.map(a=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600;color:var(--muted)">'+a.name+'</span><button class="edit-btn" onclick="unarchiveSeason(\''+a.id+'\')">Restore</button><button class="edit-btn" style="color:var(--danger)" onclick="deleteSeason(\''+a.id+'\')">Delete</button></div>').join('')+'</div>':'')+'</div>';
  const al=s.sessions.filter(x=>!x.archived),arl=s.sessions.filter(x=>x.archived);
  h+='<div class="admin-section fu s3"><div class="admin-section-t"><span class="ah-badge">3</span> Ladders</div><button class="bp full" onclick="go(\'newSession\')" style="margin-bottom:10px">New ladder</button>'+(al.length?al.map(x=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600">'+(x.name||fmtDate(x.date))+'</span><button class="edit-btn" onclick="archiveSession(\''+x.id+'\')">Archive</button></div>').join(''):'<p class="subtext" style="font-size:.78rem">No active ladders.</p>')+(arl.length?'<div style="margin-top:10px"><label class="lbl">Archived</label>'+arl.map(x=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600;color:var(--muted)">'+(x.name||fmtDate(x.date))+'</span><button class="edit-btn" onclick="unarchiveSession(\''+x.id+'\')">Restore</button><button class="edit-btn" style="color:var(--danger)" onclick="deleteSession(\''+x.id+'\')">Delete</button></div>').join('')+'</div>':'')+'</div>';
  return h}

function rSessionAdmin(l,ss){let h='<div class="admin-bar-bottom">Ladder admin</div>';
  h+='<div class="admin-section"><div class="admin-section-t">Ladder settings</div>'+[['Name',ss.name||'Untitled','<button class="edit-btn" onclick="editSessionName()">Edit</button>'],['Date',fmtDate(ss.date),'<button class="edit-btn" onclick="editSessionDate()">Edit</button>'],['Start',ss.config.startTime?fmt12(ss.config.startTime):'—','<button class="edit-btn" onclick="editSessionTime()">Edit</button>'],['Location',ss.config.place||'—','<button class="edit-btn" onclick="editSessionPlace()">Edit</button>'],['Courts',ss.config.courtNames?.join(', ')||ss.config.courts,''],['Rounds',ss.config.rounds,''],['Round time',ss.config.roundMin+' min',''],['Scoring',ss.config.scoreMode==='points'?'Points':'Win/Loss',''],['Participants',gParts(ss,l).length+' players','']].map(([k,v,eb])=>'<div class="cfg-row"><span class="subtext">'+k+'</span><span style="font-weight:600">'+v+' '+(eb||'')+'</span></div>').join('')+'</div>';
  h+='<div class="admin-section"><div class="admin-section-t">Danger zone</div><div style="display:flex;gap:6px"><button class="bg-btn" style="flex:1" onclick="archiveSession(\''+ss.id+'\');go(\'dashboard\',\'overview\')">Archive</button><button class="bd" style="flex:1" onclick="deleteSession(\''+ss.id+'\');go(\'dashboard\',\'overview\')">Delete</button></div></div>';return h}

function rNoLadder(){return'<div style="text-align:center;padding:60px 20px" class="fu"><div style="font-size:2.5rem;margin-bottom:12px">🥒</div><h2 class="heading" style="font-size:1.4rem;color:var(--lime);margin-bottom:8px">Pickle Friends</h2><p class="subtext" style="margin-bottom:24px;line-height:1.6;max-width:320px;margin:0 auto 24px">Pickleball ladder play — automatic lineups, live scoring, and season stats.</p>'+(isAdmin?'<button class="bp" onclick="go(\'newLadder\')" style="padding:14px 28px">Create league</button>':'<p class="subtext">No active leagues yet.</p>')+'</div>'}
function rNoSeason(){let h='<div class="card fu" style="text-align:center;padding:32px"><h3 class="heading" style="font-size:1.1rem;margin-bottom:6px">No seasons yet</h3>'+(isAdmin?'<button class="bp" onclick="go(\'newSeason\')">Create first season</button>':'<p class="subtext">Check back soon!</p>')+'</div>';if(isAdmin){const l=gL();h+='<div class="admin-section fu" style="margin-top:12px"><div class="admin-section-t">League settings</div><div class="cfg-row"><span class="subtext">Name</span><span style="font-weight:600">'+(l?.name||'')+' <button class="edit-btn" onclick="renameLadder()">Edit</button></span></div><div style="display:flex;gap:6px;margin-top:10px"><button class="bp" style="flex:1" onclick="go(\'newLadder\')">New league</button><button class="bd" style="flex:1" onclick="deleteLadderAction()">Delete</button></div></div>'}return h}

function rOverview(l,s,stats){const as=s.sessions.filter(x=>!x.archived);let h='<div class="card fu"><div class="overline">Current season</div><h2 class="heading" style="font-size:1.2rem;color:var(--lime)">'+s.name+'</h2><div class="subtext" style="margin-top:4px">'+as.length+' ladder'+(as.length!==1?'s':'')+' · '+l.players.filter(p=>p.active!==false).length+' active players</div></div>';
  if(stats.some(x=>x.w+x.l+x.t>0))h+='<div class="chip-grid fu">'+[{l:'Ladders',v:as.filter(x=>x.started).length},{l:'Games',v:Math.floor(stats.reduce((a,x)=>a+x.w+x.l+x.t,0)/2)},{l:'Players',v:l.players.filter(p=>p.active!==false).length},{l:'High Pts',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)}].map(c=>'<div class="chip"><div class="chip-n">'+c.v+'</div><div class="chip-l">'+c.l+'</div></div>').join('')+'</div>';
  if(isAdmin)h+='<button class="bp full" onclick="go(\'newSession\')" style="margin-bottom:12px">New ladder</button>';
  const ladderBtn=(x,dim)=>{const nParts=x.participants?x.participants.length:l.players.filter(p=>p.active!==false).length;const st=x.finished?'<span class="pill ok">Complete</span>':x.started?'<span class="pill live"><span class="dot"></span>Rd '+(x.currentRound+1)+'</span>':'<span class="pill draft">Upcoming</span>';return'<button class="sc" style="'+(dim?'opacity:.6':'')+';" onclick="openSession(\''+x.id+'\')">'+'<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;font-size:.9rem">'+(x.name||fmtDate(x.date))+'</div><div class="subtext" style="font-size:.72rem;margin-top:2px">'+fmtDate(x.date)+(x.config.startTime?' · '+fmt12(x.config.startTime):'')+' · '+nParts+' players · '+x.config.courts+' courts'+(x.config.place?' · '+x.config.place:'')+'</div></div>'+st+'</div></button>'};
  if(!as.length){h+='<div class="card fu"><h3 class="card-t">Ladders</h3><p class="subtext" style="text-align:center;padding:20px">No ladders scheduled yet.</p></div>'}
  else{
    const active_ls=[...as].filter(x=>!x.finished).sort((a,b)=>a.date.localeCompare(b.date));
    const done_ls=[...as].filter(x=>x.finished).sort((a,b)=>b.date.localeCompare(a.date));
    if(active_ls.length)h+='<div class="card fu"><h3 class="card-t">Active</h3>'+active_ls.map(x=>ladderBtn(x,false)).join('')+'</div>';
    if(done_ls.length)h+='<div class="card fu"><h3 class="card-t" style="color:var(--muted)">Completed</h3>'+done_ls.map(x=>ladderBtn(x,true)).join('')+'</div>';}
  return h}

function rNewLadder(){return'<div class="card fu"><h2 class="card-t">Create league</h2><input id="fLN" class="inp" placeholder="League name" autofocus><div class="btn-row"><button class="bg-btn" onclick="go(\'dashboard\',\'overview\')">Cancel</button><button class="bp" onclick="createLadder()">Create</button></div></div>'}
function rNewSeason(){return'<div class="card fu"><h2 class="card-t">New season</h2><input id="fSN" class="inp" placeholder="Season name" autofocus><div class="btn-row"><button class="bg-btn" onclick="go(\'dashboard\',\'overview\')">Cancel</button><button class="bp" onclick="createSeason()">Create</button></div></div>'}
function rNewSession(){const td=new Date().toISOString().split('T')[0];return'<div class="card fu"><h2 class="card-t">New ladder</h2><div style="display:flex;flex-direction:column;gap:10px"><div><label class="lbl">Ladder name</label><input id="fSName" class="inp" placeholder="e.g. Friday Night Lights Mix Ladder" autofocus></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Date</label><input id="fSD" class="inp" type="date" value="'+td+'"></div><div><label class="lbl">Start time</label><input id="fST" class="inp" type="time" value="18:00"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Courts</label><select id="fSC" class="inp" onchange="updateCourtInputs()">'+[2,3,4,5,6,7,8,10,12].map(n=>'<option value="'+n+'"'+(n===4?' selected':'')+'>'+n+'</option>').join('')+'</select></div><div><label class="lbl">Rounds</label><select id="fSR" class="inp">'+[3,4,5,6,7,8,10,12].map(n=>'<option value="'+n+'"'+(n===6?' selected':'')+'>'+n+'</option>').join('')+'</select></div><div><label class="lbl">Round time (min)</label><input id="fSM" class="inp" type="number" min="1" max="20" value="12"></div><div><label class="lbl">Scoring</label><select id="fSO" class="inp"><option value="points">Points</option><option value="winloss">Win / Loss</option></select></div></div><div id="courtNamesContainer"></div><input id="fSP" class="inp" placeholder="Location (optional)"></div><div class="btn-row"><button class="bg-btn" onclick="go(\'dashboard\',\'overview\')">Cancel</button><button class="bp" onclick="createSessionAction()">Create</button></div></div>'}

// ── MAIN RENDER ──
function render(){
  const app=document.getElementById('app');
  const l=gL(),s=gS(),ss=gSS();
  const stats=(s&&l)?calcStats(s.sessions,l.players):[];
  const sStats=ss?calcStats([ss],l?.players||[]):[];
  let h='';

  // Header
  h+='<header class="hdr"><div class="hdr-row"><div class="hdr-left">';
  h+='<div class="hdr-logo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div>';
  h+='<div><h1 class="hdr-title">'+(l?.name||'Pickle Friends')+'</h1>'+(s?'<div class="hdr-sub">'+s.name+'</div>':'')+'</div></div></div>';

  if(view==='session'){
    // Admin sees Play/Roster/Stats/Rules + optional Admin
    // Non-admin sees Court Board / Stats / Rules
    if(isAdmin){
      const tabs=['Play','Roster','Stats','Rules','Admin'];
      h+='<div class="tabs">'+tabs.map(t=>'<button class="tab'+(tab===t.toLowerCase()?' active':'')+'" onclick="tab=\''+t.toLowerCase()+'\';render()">'+t+'</button>').join('');
      h+='<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go(\'dashboard\',\'overview\')">← Back</button></div>'}
    else{
      const tabs=['Court Board','Stats','Rules'];
      h+='<div class="tabs">'+tabs.map(t=>'<button class="tab'+(tab===t.replace(' ','').toLowerCase()?' active':'')+'" onclick="tab=\''+t.replace(' ','').toLowerCase()+'\';render()">'+t+'</button>').join('');
      h+='<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go(\'dashboard\',\'overview\')">← Back</button></div>'}}
  else if(view==='dashboard'&&s){
    const tabs=isAdmin?['Overview','Stats','Players','Admin']:['Overview','Stats','Players'];
    h+='<div class="tabs">'+tabs.map(t=>'<button class="tab'+(tab===t.toLowerCase()?' active':'')+'" onclick="tab=\''+t.toLowerCase()+'\';render()">'+t+'</button>').join('')+'</div>'}
  h+='</header><div class="content">';

  if(view==='dashboard'&&ladders.length>1)h+='<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">'+ladders.map(x=>'<button onclick="selectLadder(\''+x.id+'\')" style="padding:7px 14px;border-radius:var(--rx);border:1.5px solid '+(x.id===activeLadderId?'var(--lime-bd)':'var(--border-s)')+';background:'+(x.id===activeLadderId?'var(--lime-dim)':'var(--surf1)')+';color:'+(x.id===activeLadderId?'var(--lime)':'var(--muted)')+';font-family:\'Sora\',sans-serif;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">'+x.name+'</button>').join('')+'</div>';

  if(view==='newLadder')h+=rNewLadder();
  else if(view==='newSeason')h+=rNewSeason();
  else if(view==='newSession')h+=rNewSession();
  else if(!l)h+=rNoLadder();
  else if(view==='dashboard'){
    if(!s)h+=rNoSeason();
    else if(tab==='overview')h+=rOverview(l,s,stats);
    else if(tab==='stats')h+=rStats(stats,s,l);
    else if(tab==='players')h+=rPlayers(l);
    else if(tab==='admin'&&isAdmin)h+=rAdmin(l,s)}
  else if(view==='session'&&ss){
    if(isAdmin){
      if(tab==='play')h+=rPlay(l,ss);
      else if(tab==='roster')h+=rSessionRoster(l,ss);
      else if(tab==='stats')h+=rStats(sStats,null,l,ss);
      else if(tab==='rules')h+=rRules(ss);
      else if(tab==='admin')h+=rSessionAdmin(l,ss)}
    else{
      if(tab==='courtboard')h+=rPlayerView(l,ss);
      else if(tab==='stats')h+=rStats(sStats,null,l,ss);
      else if(tab==='rules')h+=rRules(ss);
      // default to court board
      else{tab='courtboard';h+=rPlayerView(l,ss)}}}

  // Admin footer
  h+='<div class="admin-footer">';
  if(!isAdmin)h+='<button class="admin-lock-btn" onclick="openPin()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="15" x2="12" y2="18"/></svg> Admin</button>';
  else h+='<button class="admin-lock-btn unlocked" onclick="lockAdmin()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Lock admin</button>';
  h+='</div></div>';
  // ── Centered score modal overlay ──
  if(npState&&isAdmin){
    const ss2=gSS();const l2=gL();
    if(ss2&&l2){
      const ct2=ss2.rounds[npState.ri]?.courts[npState.ci];
      const t1names=(ct2?.team1||[]).filter(Boolean).map(p=>p.name).join(' + ')||'Team A';
      const t2names=(ct2?.team2||[]).filter(Boolean).map(p=>p.name).join(' + ')||'Team B';
      const sc2=ct2?.score;
      const t1val=sc2?.t1!=null?sc2.t1:null;
      const t2val=sc2?.t2!=null?sc2.t2:null;
      const nm2=cName(ct2?.court,ss2);
      const acc2={[ss2.config.courts]:'#ffcc00',[ss2.config.courts-1]:'#00e5ff',[ss2.config.courts-2]:'#3b82f6'};
      const col2=acc2[ct2?.court]||'#a78bfa';
      const bothDone=t1val!==null&&t2val!==null;
      const cur=npState.value===''?'--':npState.value;
      let ov='<div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:500;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:16px;backdrop-filter:blur(6px)" onclick="npCancel()">';
      ov+='<div style="background:#111118;border-radius:20px;width:100%;max-width:380px;border:1px solid rgba(255,255,255,0.1);overflow:hidden" onclick="event.stopPropagation()">';
      // header
      ov+='<div style="background:#0e0e1a;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center">';
      ov+='<div><div style="font-size:9px;font-weight:900;color:'+col2+';text-transform:uppercase;letter-spacing:.1em">Court '+nm2+'</div><div style="font-size:13px;font-weight:700;color:#f4f4f0;margin-top:2px">Enter scores</div></div>';
      ov+='<button onclick="npCancel()" style="background:rgba(255,255,255,0.07);border:none;color:#7a7a8a;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2715;</button>';
      ov+='</div>';
      // score display — both teams side by side
      ov+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:12px 14px 0;border-radius:12px;overflow:hidden">';
      // Team 1
      const t1active=npState.field==='t1';
      const t1border=t1active?'border:2px solid '+col2+';':'border:2px solid rgba(255,255,255,0.1);';
      const t1bg=t1active?'background:#000e18':'background:#0a0a14';
      const t1score=t1val!==null&&!t1active?String(t1val):(t1active?cur:'--');
      const t1col=t1val!==null&&!t1active?col2:'rgba(255,255,255,0.15)';
      ov+='<div style="'+t1bg+';padding:12px 8px;text-align:center;'+t1border+'border-radius:12px 0 0 12px;cursor:pointer" onclick="npSwitchField(\'t1\',' + (t1val!==null?t1val:'null') + ')">';
      ov+='<div style="font-size:8px;font-weight:900;color:'+(t1active?col2:'#555')+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">'+t1names+'</div>';
      ov+='<div style="font-size:44px;font-weight:900;color:'+(t1active?col2:t1col)+';line-height:1;letter-spacing:-.03em">'+(t1active?cur:t1score)+'</div>';
      ov+='<div style="font-size:8px;margin-top:5px;color:'+(t1val!==null&&!t1active?col2:'#444')+';">'+(t1val!==null&&!t1active?'✓ Entered':t1active?'← Entering now':'--')+'</div>';
      ov+='</div>';
      // Team 2
      const t2active=npState.field==='t2';
      const t2border=t2active?'border:2px solid '+col2+';':'border:2px solid rgba(255,255,255,0.1);';
      const t2bg=t2active?'background:#000e18':'background:#0a0a14';
      const t2score=t2val!==null&&!t2active?String(t2val):(t2active?cur:'--');
      const t2col=t2val!==null&&!t2active?col2:'rgba(255,255,255,0.15)';
      ov+='<div style="'+t2bg+';padding:12px 8px;text-align:center;'+t2border+'border-radius:0 12px 12px 0;cursor:pointer" onclick="npSwitchField(\'t2\',' + (t2val!==null?t2val:'null') + ')">';
      ov+='<div style="font-size:8px;font-weight:900;color:'+(t2active?col2:'#555')+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">'+t2names+'</div>';
      ov+='<div style="font-size:44px;font-weight:900;color:'+(t2active?col2:t2col)+';line-height:1;letter-spacing:-.03em">'+(t2active?cur:t2score)+'</div>';
      ov+='<div style="font-size:8px;margin-top:5px;color:'+(t2val!==null&&!t2active?col2:'#444')+';">'+(t2val!==null&&!t2active?'✓ Entered':t2active?'← Entering now':'--')+'</div>';
      ov+='</div></div>';
      // Confirm or numpad
      if(bothDone){
        ov+='<div style="padding:14px 14px 16px"><button onclick="npState=null;render()" style="width:100%;background:#c8ff00;border:none;border-radius:12px;padding:16px;font-size:15px;font-weight:900;color:#000;cursor:pointer">✓ Confirm '+t1val+' – '+t2val+'</button></div>';
      } else {
        // numpad grid
        ov+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,0.06);margin:0 14px 14px;border-radius:12px;overflow:hidden">';
        [1,2,3,4,5,6,7,8,9].forEach(d=>{ov+='<button onclick="npPress(\''+d+'\')" style="background:#0e0e1a;padding:16px 0;text-align:center;font-size:20px;font-weight:700;color:#f4f4f0;cursor:pointer;border:none;width:100%">'+d+'</button>'});
        ov+='<button onclick="npDel()" style="background:#0e0e1a;padding:16px 0;text-align:center;font-size:16px;color:#ff5c47;cursor:pointer;border:none">⌫</button>';
        ov+='<button onclick="npPress(\'0\')" style="background:#0e0e1a;padding:16px 0;text-align:center;font-size:20px;font-weight:700;color:#f4f4f0;cursor:pointer;border:none">0</button>';
        ov+='<button onclick="npConfirm()" style="background:#c8ff00;padding:16px 0;text-align:center;font-size:12px;font-weight:900;color:#000;cursor:pointer;border:none">SET →</button>';
        ov+='</div>';}
      ov+='</div></div>';
      h+=ov;}}

  // ── Swap mode banner (fixed top) ──
  if(swapMode&&isAdmin){
    const ss3=gSS();
    if(ss3){const srcRound=ss3.rounds[swapMode.ri];const srcCt=srcRound?.courts[swapMode.ci];
      const srcT=swapMode.ti===0?srcCt?.team1:srcCt?.team2;const srcP=srcT?.[swapMode.pi];
      h+='<div style="position:fixed;top:0;left:0;right:0;z-index:400;background:rgba(255,204,0,0.15);border-bottom:2px solid rgba(255,204,0,0.4);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(8px)">';
      h+='<div><div style="font-size:8px;font-weight:900;color:#ffcc00;text-transform:uppercase;letter-spacing:.08em">Swapping player</div>';
      h+='<div style="font-size:14px;font-weight:700;color:#f4f4f0;margin-top:1px">'+(srcP?.name||'?')+' → tap any player to swap</div></div>';
      h+='<button onclick="cancelSwap()" style="background:rgba(255,92,71,0.15);border:1px solid rgba(255,92,71,0.3);color:#ff5c47;font-size:9px;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer">Cancel</button>';
      h+='</div>';}}

  app.innerHTML=h;
  applyTextSize();
  renderSizeBtns();
  if(view==='newSession')setTimeout(updateCourtInputs,0);
  if(tab==='stats')setTimeout(tkRenderChart,10);
  // attach keyboard handler for score modal when open on PC
  if(npState&&isAdmin){
    const handler=(e)=>{
      if(!npState)return;
      if(e.key>='0'&&e.key<='9'){npPress(e.key)}
      else if(e.key==='Backspace'){npDel()}
      else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();npConfirm()}
      else if(e.key==='Escape'){npCancel()}
    };
    // remove any prior listener then add fresh
    document.removeEventListener('keydown',window._npKeyHandler);
    window._npKeyHandler=handler;
    document.addEventListener('keydown',handler);
  } else {
    document.removeEventListener('keydown',window._npKeyHandler);
    window._npKeyHandler=null;
  }}

async function init(){
  applyTextSize();
  // Show loading with status so we can diagnose
  document.getElementById('app').innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0a0a0f;gap:16px;padding:24px"><div style="font-family:Inter,sans-serif;font-size:1.1rem;font-weight:700;color:#c8ff00" id="initStatus">Connecting...</div><div style="font-size:.75rem;color:#7a7a8a;text-align:center;max-width:280px" id="initDetail">Reaching the server</div></div>';
  const setStatus=(msg,detail)=>{const s=document.getElementById('initStatus');const d=document.getElementById('initDetail');if(s)s.textContent=msg;if(d)d.textContent=detail||''};
  try{
    setStatus('Connecting...','Reaching the server');
    const res=await Promise.race([
      fetch('/api?action=list'),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('Server took too long to respond (>8s)')),8000))
    ]);
    setStatus('Loading data...','Parsing response');
    if(!res.ok)throw new Error('Server error: '+res.status+' '+res.statusText);
    const data=await res.json();
    ladders=data.ladders||[];
    if(ladders.length){activeLadderId=ladders[0].id;const l=gL();if(l?.activeSeason)tab='overview'}
    render();
  }catch(e){
    console.error('Init failed:',e);
    document.getElementById('app').innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0a0a0f;gap:16px;padding:24px"><div style="font-size:2rem">⚠️</div><div style="font-family:Inter,sans-serif;font-size:1rem;font-weight:700;color:#ff5c47;text-align:center">Could not connect</div><div style="font-size:.8rem;color:#7a7a8a;text-align:center;max-width:300px;line-height:1.6">'+e.message+'</div><button onclick="init()" style="margin-top:8px;padding:10px 24px;background:#c8ff00;color:#0a0a0f;border:none;border-radius:8px;font-weight:700;font-size:.9rem;cursor:pointer">Retry</button></div>';
  }}
document.addEventListener('DOMContentLoaded',init);
