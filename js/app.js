// PICKLE FRIENDS — Full rebuild
// MVP = best point differential. Tracker = cumulative points. Admin tab for all management.
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b};
const fmtT=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}};
const fmt12=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);return`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
function cName(n,ss){if(!ss?.config?.courtNames?.length)return String.fromCharCode(65+(ss?.config?.courts||4)-n);const idx=ss.config.courtNames.length-n;return ss.config.courtNames[idx]||String.fromCharCode(65+idx)}
function defaultCourtNames(n){return Array.from({length:n},(_,i)=>String.fromCharCode(65+i))}
const pTag=(p,l)=>{if(!p||!l)return'?';const i=l.players.findIndex(x=>x.id===p.id);return'#'+(i>=0?i+1:'?')};
const pNum=(p,l)=>{const i=l.players.findIndex(x=>x.id===p.id);return i>=0?i+1:0};

// State
let ladders=[],activeLadderId=null,activeSessionId=null,isAdmin=false,adminPin='';
let view='dashboard',tab='overview',timer=0,timerOn=false,timerInt=null,pinEntry='',editingPid=null,mapOpen=false;
let formCourtCount=4,viewingRound=-1;
let tkMode='top50',tkPickerOpen=false,tkPicked=new Set(),tkChart=null;
const tkPal=['#0F6E56','#1D9E75','#BA7517','#A32D2D','#534AB7','#993C1D','#085041','#993556','#185FA5','#5F5E5A','#5DCAA5','#ED93B1'];
const tkDash=[[],[5,5],[2,3],[8,4],[4,2,1,2],[1,4],[6,3],[3,6],[10,3],[2,6],[6,2],[4,4]];

// API
async function apiList(){try{return(await(await fetch('/api?action=list')).json()).ladders||[]}catch{return[]}}
async function apiSave(l){try{const r=await fetch('/api?action=save',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':adminPin},body:JSON.stringify({ladder:l})});if(!r.ok){const d=await r.json();throw new Error(d.error)}return await r.json()}catch(e){console.error(e);alert('Save failed: '+e.message);return null}}
async function apiDel(id){try{return await(await fetch(`/api?action=delete&id=${id}`,{method:'DELETE',headers:{'X-Admin-Pin':adminPin}})).json()}catch{return null}}
async function apiVerifyPin(pin){try{const r=await fetch('/api?action=verify-pin',{headers:{'X-Admin-Pin':pin}});return(await r.json()).valid}catch{return false}}

function gL(){return ladders.find(l=>l.id===activeLadderId)||null}
function gS(){const l=gL();if(!l)return null;if(l.activeSeason){const s=l.seasons.find(x=>x.id===l.activeSeason);if(s)return s}return l.seasons.find(x=>!x.archived)||null}
function gSS(){const s=gS();return s?.sessions.find(ss=>ss.id===activeSessionId)||null}
async function save(l,skipRender){const i=ladders.findIndex(x=>x.id===l.id);if(i>=0)ladders[i]=l;else ladders.push(l);const r=await apiSave(l);if(r&&!skipRender)render();return r}
// Debounced score save — updates local state instantly, delays API call, never re-renders
let scoreTimer=null;
function saveScoreDebounced(l){clearTimeout(scoreTimer);scoreTimer=setTimeout(()=>{apiSave(l)},800)}

// Coed lineup
function makeCoed(group,pp){const males=group.filter(p=>p?.gender==='M'),females=group.filter(p=>p?.gender==='F');let t1,t2;if(males.length>=2&&females.length>=2){t1=[males[0],females[0]];t2=[males[1],females[1]];if(pp&&(pp[t1[0]?.id]===t1[1]?.id||pp[t2[0]?.id]===t2[1]?.id)){t1=[males[0],females[1]];t2=[males[1],females[0]]}}else if(males.length>=1&&females.length>=1){const others=group.filter(p=>p!==males[0]&&p!==females[0]);t1=[males[0],females[0]];t2=[others[0]||null,others[1]||null]}else{t1=[group[0]||null,group[1]||null];t2=[group[2]||null,group[3]||null];if(pp&&(pp[t1[0]?.id]===t1[1]?.id||pp[t2[0]?.id]===t2[1]?.id)){t1=[group[0]||null,group[2]||null];t2=[group[1]||null,group[3]||null]}}return{t1,t2}}
function genR1(players,nC){const males=shuffle(players.filter(p=>p.gender==='M')),females=shuffle(players.filter(p=>p.gender==='F'));const courts=[];let mi=0,fi=0;for(let c=0;c<nC;c++){const g=[];for(let x=0;x<2;x++){if(mi<males.length)g.push(males[mi++])}for(let x=0;x<2;x++){if(fi<females.length)g.push(females[fi++])}while(g.length<4&&mi<males.length)g.push(males[mi++]);while(g.length<4&&fi<females.length)g.push(females[fi++]);const{t1,t2}=makeCoed(g,null);courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}return{courts,completed:false}}
function genNR(prev,nC){const mvs=[];prev.courts.forEach(c=>{const all=[...(c.team1||[]),...(c.team2||[])].filter(Boolean);if(!c.score||c.score.winner==='T'){all.forEach(p=>mvs.push({p,to:c.court}));return}const w=c.score.winner==='A'?c.team1:c.team2,lo=c.score.winner==='A'?c.team2:c.team1;w.filter(Boolean).forEach(p=>mvs.push({p,to:Math.min(nC,c.court+1)}));lo.filter(Boolean).forEach(p=>mvs.push({p,to:Math.max(1,c.court-1)}))});const bk={};for(let i=1;i<=nC;i++)bk[i]=[];mvs.forEach(m=>bk[m.to]?.push(m.p));for(let i=1;i<=nC;i++)bk[i]=shuffle(bk[i]);const pp={};prev.courts.forEach(c=>{[c.team1,c.team2].forEach(t=>{if(t[0]&&t[1]){pp[t[0].id]=t[1].id;pp[t[1].id]=t[0].id}})});const courts=[];for(let c=0;c<nC;c++){const g=bk[c+1]||[];const{t1,t2}=makeCoed(g.slice(0,4),pp);courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}return{courts,completed:false}}

// Stats engine
function calcStats(sessions,players){
  const s={};players.forEach(p=>{s[p.id]={id:p.id,name:p.name,gender:p.gender,w:0,l:0,t:0,pf:0,pa:0,best:0,attended:0,courtHist:[],roundRes:[],streak:0,maxStreak:0,roundPts:[]}});
  sessions.forEach(sess=>{const played=new Set();
    sess.rounds.forEach((round,ri)=>{round.courts.forEach(c=>{if(!c.score||c.score.t1===null||c.score.t1===undefined||c.score.t2===null||c.score.t2===undefined)return;const{t1,t2,winner}=c.score;const tied=winner==='T';
      [[c.team1,t1,t2,winner==='A'],[c.team2,t2,t1,winner==='B']].forEach(([team,sc,al,won])=>{team.filter(Boolean).forEach(p=>{if(!s[p.id])return;played.add(p.id);s[p.id].pf+=sc;s[p.id].pa+=al;
        if(tied){s[p.id].t++;s[p.id].streak=0}else if(won){s[p.id].w++;s[p.id].streak=s[p.id].streak>0?s[p.id].streak+1:1;s[p.id].maxStreak=Math.max(s[p.id].maxStreak,s[p.id].streak)}else{s[p.id].l++;s[p.id].streak=s[p.id].streak<0?s[p.id].streak-1:-1}
        s[p.id].best=Math.max(s[p.id].best,c.court);s[p.id].courtHist.push({round:ri+1,court:c.court});s[p.id].roundRes.push({round:ri+1,court:c.court,won,tied,pf:sc,pa:al,diff:sc-al});s[p.id].roundPts.push(sc)})})})});
    played.forEach(id=>{if(s[id])s[id].attended++})});
  return Object.values(s).sort((a,b)=>b.pf!==a.pf?b.pf-a.pf:(b.pf-b.pa)-(a.pf-a.pa))}

// Round MVPs — best diff by gender
function getRoundMVPs(round,ladder){
  if(!round)return{m:null,f:null};
  const perfs=[];
  round.courts.forEach(c=>{if(!c.score||c.score.t1===null||c.score.t1===undefined||c.score.t2===null||c.score.t2===undefined)return;const{t1,t2,winner}=c.score;
    [[c.team1,t1-t2],[c.team2,t2-t1]].forEach(([team,diff])=>{team.filter(Boolean).forEach(p=>{perfs.push({p,diff,pts:diff>0?Math.max(t1,t2):Math.min(t1,t2),court:c.court})})})});
  const males=perfs.filter(x=>x.p.gender==='M').sort((a,b)=>b.diff-a.diff);
  const females=perfs.filter(x=>x.p.gender==='F').sort((a,b)=>b.diff-a.diff);
  return{m:males[0]||null,f:females[0]||null};
}

// Partnership tracking
function calcPartners(sessions,players){
  const pairs={};
  sessions.forEach(sess=>{sess.rounds.forEach(round=>{round.courts.forEach(c=>{if(!c.score||c.score.t1===null||c.score.t2===null)return;const won=c.score.winner;
    [c.team1,c.team2].forEach((team,ti)=>{if(team[0]&&team[1]){const key=[team[0].id,team[1].id].sort().join('-');if(!pairs[key])pairs[key]={p1:team[0],p2:team[1],w:0,l:0};
      const teamWon=(ti===0&&won==='A')||(ti===1&&won==='B');if(teamWon)pairs[key].w++;else if(won!=='T')pairs[key].l++}})})})});
  return Object.values(pairs).sort((a,b)=>(b.w/(b.w+b.l||1))-(a.w/(a.w+a.l||1)));
}

// Timer
function startTimer(){const ss=gSS();if(!ss)return;if(timer===0)timer=ss.config.roundMin*60;timerOn=true;clearInterval(timerInt);timerInt=setInterval(()=>{timer--;if(timer<=0){timer=0;timerOn=false;clearInterval(timerInt)}rTimer()},1000);render()}
function pauseTimer(){timerOn=false;clearInterval(timerInt);render()}
function endTimer(){timerOn=false;clearInterval(timerInt);timer=0;render()}
function resetTimer(ss){clearInterval(timerInt);timerOn=false;timer=(ss?.config?.roundMin||12)*60}
function rTimer(){const el=document.getElementById('td');if(el){el.textContent=fmtT(timer);el.style.color=timer<=60?'#dc2626':'#fff'}const bar=document.getElementById('tf');const ss=gSS();if(bar&&ss){bar.style.width=(timer/(ss.config.roundMin*60))*100+'%';bar.style.background=timer<=60?'#dc2626':timer<=180?'#d4a030':'#1a7a5c'}}
function shouldMapOpen(ss){if(!ss?.config?.startTime||!ss.date)return false;try{const[h,m]=ss.config.startTime.split(':').map(Number);const start=new Date(ss.date+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00');return(start-new Date())/60000<=60&&(start-new Date())/60000>=-120}catch{return false}}

// PIN
function openPin(){pinEntry='';document.getElementById('pinModal').style.display='flex';rPD()}
function closePin(){pinEntry='';document.getElementById('pinModal').style.display='none';document.getElementById('pinErr').textContent=''}
function pinPress(d){if(pinEntry.length>=4)return;pinEntry+=d;rPD();if(pinEntry.length===4)setTimeout(checkPin,150)}
function pinDel(){pinEntry=pinEntry.slice(0,-1);rPD();document.getElementById('pinErr').textContent=''}
function rPD(){for(let i=0;i<4;i++){const d=document.getElementById('pd'+i);if(d){d.style.background=i<pinEntry.length?'#1a7a5c':'transparent';d.style.borderColor=i<pinEntry.length?'#1a7a5c':'#a3b8ac'}}}
async function checkPin(){const v=await apiVerifyPin(pinEntry);if(v){adminPin=pinEntry;isAdmin=true;closePin();render()}else{document.getElementById('pinErr').textContent='Incorrect PIN';pinEntry='';rPD();setTimeout(()=>{const e=document.getElementById('pinErr');if(e)e.textContent=''},2000)}}
function lockAdmin(){isAdmin=false;adminPin='';render()}

// Edit player
function openEditPlayer(pid){const l=gL();if(!l)return;const p=l.players.find(x=>x.id===pid);if(!p)return;editingPid=pid;document.getElementById('edName').value=p.name;document.getElementById('edGender').value=p.gender;document.getElementById('editModal').classList.add('open')}
function closeEditModal(){document.getElementById('editModal').classList.remove('open');editingPid=null}
async function saveEditPlayer(){const l=gL();if(!l||!editingPid)return;const p=l.players.find(x=>x.id===editingPid);if(!p)return;p.name=document.getElementById('edName').value.trim()||p.name;p.gender=document.getElementById('edGender').value;closeEditModal();await save(l)}
function toggleMap(){mapOpen=!mapOpen;render()}
function viewRound(ri){viewingRound=ri;render()}

// Court name inputs
function updateCourtInputs(){const n=parseInt(document.getElementById('fSC')?.value)||4;formCourtCount=n;const c=document.getElementById('courtNamesContainer');if(!c)return;const names=defaultCourtNames(n);c.innerHTML=`<label class="lbl">Court names (top to bottom)</label><div style="display:grid;grid-template-columns:repeat(${Math.min(n,4)},1fr);gap:6px">${names.map((nm,i)=>`<input id="fCN${i}" class="inp" value="${nm}" style="text-align:center;font-family:'Sora',sans-serif;font-weight:700;font-size:.9rem;padding:8px 4px">`).join('')}</div>`}
function getFormCourtNames(){const n=formCourtCount;const names=[];for(let i=0;i<n;i++){const el=document.getElementById('fCN'+i);names.push(el?.value?.trim()||String.fromCharCode(65+i))}return names}

// Actions
async function createLadder(){const n=document.getElementById('fLN')?.value?.trim();if(!n)return;const l={id:uid(),name:n,players:[],seasons:[],activeSeason:null,createdAt:Date.now()};const r=await save(l);if(r){activeLadderId=l.id;view='dashboard';tab='overview';render()}}
async function deleteLadderAction(){const l=gL();if(!l||!confirm('Delete this league permanently?'))return;await apiDel(l.id);ladders=ladders.filter(x=>x.id!==l.id);activeLadderId=ladders[0]?.id||null;view='dashboard';render()}
async function createSeason(){const n=document.getElementById('fSN')?.value?.trim();const l=gL();if(!l||!n)return;const s={id:uid(),name:n,sessions:[],createdAt:Date.now()};l.seasons.push(s);l.activeSeason=s.id;await save(l);view='dashboard';tab='overview';render()}
async function createSessionAction(){const l=gL();const s=gS();if(!l||!s)return;const cn=getFormCourtNames();const ss={id:uid(),name:document.getElementById('fSName')?.value?.trim()||'',date:document.getElementById('fSD')?.value||new Date().toISOString().split('T')[0],config:{courts:formCourtCount,rounds:parseInt(document.getElementById('fSR')?.value)||6,roundMin:parseInt(document.getElementById('fSM')?.value)||12,scoreMode:document.getElementById('fSO')?.value||'points',place:document.getElementById('fSP')?.value||'',startTime:document.getElementById('fST')?.value||'',courtNames:cn},rounds:[],currentRound:-1,started:false,finished:false,createdAt:Date.now()};s.sessions.push(ss);await save(l);activeSessionId=ss.id;view='session';tab='roster';render()}
async function addPlayer(){const l=gL();if(!l)return;const n=document.getElementById('fPN')?.value?.trim();const g=document.getElementById('fPG')?.value||'M';if(!n)return;l.players.push({id:uid(),name:n,gender:g});document.getElementById('fPN').value='';await save(l)}
async function removePlayer(pid){const l=gL();if(!l||!confirm('Remove this player?'))return;l.players=l.players.filter(p=>p.id!==pid);await save(l)}
async function startSessionAction(){const l=gL();const ss=gSS();if(!l||!ss||l.players.length<4)return alert('Need at least 4 players.');ss.rounds=[genR1(l.players,ss.config.courts)];ss.currentRound=0;ss.started=true;resetTimer(ss);tab='play';mapOpen=true;await save(l)}
async function submitScoreRound(ri,ci,f,v){const l=gL();const ss=gSS();if(!l||!ss||!ss.rounds[ri])return;const ct=ss.rounds[ri].courts[ci];const sc=ct.score||{t1:null,t2:null,winner:'T'};const num=v===''?null:parseInt(v)||0;sc[f]=num;if(sc.t1!==null&&sc.t2!==null){sc.winner=sc.t1>sc.t2?'A':sc.t2>sc.t1?'B':'T'}else{sc.winner='T'}ct.score=sc;const idx=ladders.findIndex(x=>x.id===l.id);if(idx>=0)ladders[idx]=l;saveScoreDebounced(l)}
async function setWLRound(ri,ci,w){const l=gL();const ss=gSS();if(!l||!ss||!ss.rounds[ri])return;ss.rounds[ri].courts[ci].score={t1:w==='A'?1:0,t2:w==='B'?1:0,winner:w};await save(l)}
async function finishLadderEarly(){const l=gL();const ss=gSS();if(!l||!ss)return;if(!confirm('End this ladder now? Unplayed rounds will not be scored.'))return;ss.finished=true;tab='stats';await save(l)}
async function nextRound(){const l=gL();const ss=gSS();if(!l||!ss)return;const un=ss.rounds[ss.currentRound].courts.filter(c=>!c.score);if(un.length&&!confirm(`${un.length} court(s) unscored. Continue?`))return;if(ss.currentRound>=ss.config.rounds-1){ss.finished=true;tab='stats';await save(l);return}ss.rounds.push(genNR(ss.rounds[ss.currentRound],ss.config.courts));ss.currentRound++;resetTimer(ss);await save(l)}
async function reshuffleRound(){const l=gL();const ss=gSS();if(!l||!ss||!confirm('Reshuffle? Scores cleared.'))return;const all=[];ss.rounds[ss.currentRound].courts.forEach(c=>[...c.team1,...c.team2].filter(Boolean).forEach(p=>all.push(p)));ss.rounds[ss.currentRound]=genR1(all,ss.config.courts);await save(l)}

// Edits
async function renameLadder(){const l=gL();if(!l)return;const n=prompt('League name:',l.name);if(n?.trim()){l.name=n.trim();await save(l)}}
async function renameSeason(){const l=gL();const s=gS();if(!l||!s)return;const n=prompt('Season name:',s.name);if(n?.trim()){s.name=n.trim();await save(l)}}
async function editSessionName(){const l=gL();const ss=gSS();if(!l||!ss)return;const n=prompt('Ladder name:',ss.name||'');if(n!==null){ss.name=n.trim();await save(l)}}
async function editSessionDate(){const l=gL();const ss=gSS();if(!l||!ss)return;const d=prompt('Date (YYYY-MM-DD):',ss.date);if(d?.trim()){ss.date=d.trim();await save(l)}}
async function editSessionTime(){const l=gL();const ss=gSS();if(!l||!ss)return;const t=prompt('Start time (HH:MM):',ss.config.startTime||'');if(t!==null){ss.config.startTime=t.trim();await save(l)}}
async function editSessionPlace(){const l=gL();const ss=gSS();if(!l||!ss)return;const p=prompt('Location:',ss.config.place||'');if(p!==null){ss.config.place=p.trim();await save(l)}}
async function archiveSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s||!confirm(`Archive "${s.name}"?`))return;s.archived=true;if(l.activeSeason===sid){const a=l.seasons.find(x=>!x.archived);l.activeSeason=a?.id||null}await save(l)}
async function unarchiveSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s)return;s.archived=false;l.activeSeason=sid;await save(l)}
async function deleteSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s||!confirm(`Delete "${s.name}" permanently?`))return;l.seasons=l.seasons.filter(x=>x.id!==sid);if(l.activeSeason===sid)l.activeSeason=l.seasons[0]?.id||null;await save(l)}

function go(v,t){view=v;if(t)tab=t;viewingRound=-1;if(v==='newSession')formCourtCount=4;render();if(v==='newSession')setTimeout(updateCourtInputs,10)}
function selectLadder(id){activeLadderId=id;activeSessionId=null;view='dashboard';tab='overview';viewingRound=-1;render()}
function openSession(id){activeSessionId=id;view='session';tab='play';viewingRound=-1;const ss=gSS();mapOpen=ss?shouldMapOpen(ss)||ss.started:false;render()}

// Tracker chart
function tkSetMode(m){tkMode=m;tkPicked.clear();render();setTimeout(tkRenderChart,10)}
function tkTogglePicker(){tkPickerOpen=!tkPickerOpen;render();setTimeout(tkRenderChart,10)}
function tkTogglePlayer(id){if(tkPicked.has(id))tkPicked.delete(id);else tkPicked.add(id);render();setTimeout(tkRenderChart,10)}

function tkRenderChart(){
  const canvas=document.getElementById('tkCanvas');if(!canvas||!window.Chart)return;
  const l=gL();const ss=gSS();const s=gS();if(!l)return;
  const sessions=ss?[ss]:(s?s.sessions:[]);
  const stats=calcStats(sessions,l.players).filter(x=>x.roundPts.length>0);
  if(!stats.length)return;
  const ranked=[...stats].sort((a,b)=>b.pf-a.pf);
  let visible;
  if(tkPicked.size>0)visible=ranked.filter(p=>tkPicked.has(p.id));
  else if(tkMode==='top50')visible=ranked.slice(0,Math.ceil(ranked.length/2));
  else visible=ranked;

  const cntEl=document.getElementById('tkCount');if(cntEl)cntEl.textContent=`Showing ${visible.length} of ${ranked.length}`;
  const pkBtn=document.getElementById('tkPickerBtn');if(pkBtn)pkBtn.classList.toggle('has-picks',tkPicked.size>0);

  const maxRounds=Math.max(...visible.map(p=>p.roundPts.length));
  const labels=Array.from({length:maxRounds},(_,i)=>'Rd '+(i+1));
  const datasets=visible.map((p,i)=>{
    const ci=ranked.indexOf(p)%tkPal.length;let cum=0;const data=p.roundPts.map(r=>{cum+=r;return cum});
    return{label:'#'+pNum(p,l)+' '+p.name,data,borderColor:tkPal[ci],backgroundColor:tkPal[ci]+'15',borderWidth:2.5,borderDash:tkDash[ci%tkDash.length],pointRadius:5,pointBackgroundColor:tkPal[ci],pointBorderColor:'#fff',pointBorderWidth:2,pointHoverRadius:7,tension:.25,fill:false,roundPts:p.roundPts}});

  if(tkChart)tkChart.destroy();
  tkChart=new Chart(canvas,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#1a2e23',bodyColor:'#3d5a4a',borderColor:'rgba(0,0,0,.06)',borderWidth:1,padding:10,cornerRadius:8,
      callbacks:{label:ctx=>{const rp=ctx.dataset.roundPts[ctx.dataIndex];return ctx.dataset.label+': '+Math.round(ctx.raw)+' pts (+'+rp+')'}}}},
    scales:{y:{beginAtZero:true,ticks:{color:'rgba(0,0,0,.3)',font:{size:11}},grid:{color:'rgba(0,0,0,.04)'},border:{display:false}},
      x:{ticks:{color:'rgba(0,0,0,.3)',font:{size:11},autoSkip:false},grid:{display:false},border:{display:false}}},layout:{padding:{top:4,right:8}}}});

  // Legend
  const lgEl=document.getElementById('tkLegend');
  if(lgEl)lgEl.innerHTML=visible.map((p,i)=>{const ci=ranked.indexOf(p)%tkPal.length;return`<span class="tk-legend-item"><span class="tk-legend-swatch" style="background:${tkPal[ci]}"></span>#${pNum(p,l)} ${p.name}</span>`}).join('');
  // Chips
  const chEl=document.getElementById('tkChips');
  if(chEl)chEl.innerHTML=ranked.map(p=>`<button class="tk-chip${tkPicked.has(p.id)?' on':''}" onclick="tkTogglePlayer('${p.id}')">#${pNum(p,l)} ${p.name}</button>`).join('');
}

// ═══════ RENDER ═══════
function render(){
  const app=document.getElementById('app');const l=gL(),s=gS(),ss=gSS();
  const stats=(s&&l)?calcStats(s.sessions,l.players):[];
  const sStats=ss?calcStats([ss],l?.players||[]):[];
  let h='';

  // Header
  h+=`<header class="hdr"><div class="hdr-row"><div class="hdr-left"><div class="hdr-logo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><div><h1 class="hdr-title">${l?.name||'Pickle Friends'}</h1>${s?`<div class="hdr-sub">${s.name}</div>`:''}</div></div></div>`;

  // Tabs
  if(view==='session'){
    const tabs=isAdmin?['Play','Roster','Stats','Rules','Admin']:['Play','Roster','Stats','Rules'];
    h+=`<div class="tabs">${tabs.map(t=>`<button class="tab${tab===t.toLowerCase()?' active':''}" onclick="tab='${t.toLowerCase()}';render()">${t}</button>`).join('')}<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go('dashboard','overview')">← Back</button></div>`;
  } else if(view==='dashboard'&&s){
    const tabs=isAdmin?['Overview','Stats','Players','Admin']:['Overview','Stats','Players'];
    h+=`<div class="tabs">${tabs.map(t=>`<button class="tab${tab===t.toLowerCase()?' active':''}" onclick="tab='${t.toLowerCase()}';render()">${t}</button>`).join('')}</div>`;
  }
  h+=`</header><div class="content">`;

  // League selector
  if(view==='dashboard'&&ladders.length>1)h+=`<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">${ladders.map(x=>`<button onclick="selectLadder('${x.id}')" style="padding:8px 16px;border-radius:var(--rx);border:1.5px solid ${x.id===activeLadderId?'var(--green)':'var(--border-s)'};background:${x.id===activeLadderId?'var(--green-pale)':'var(--bg-card)'};color:${x.id===activeLadderId?'var(--green)':'var(--muted)'};font-family:'Sora',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">${x.name}</button>`).join('')}</div>`;

  // Forms
  if(view==='newLadder')h+=`<div class="card fu"><h2 class="card-t">Create league</h2><input id="fLN" class="inp" placeholder="League name" autofocus><div class="btn-row"><button class="bg-btn" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createLadder()">Create</button></div></div>`;
  else if(view==='newSeason')h+=`<div class="card fu"><h2 class="card-t">New season</h2><input id="fSN" class="inp" placeholder="Season name" autofocus><div class="btn-row"><button class="bg-btn" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createSeason()">Create</button></div></div>`;
  else if(view==='newSession'){const td=new Date().toISOString().split('T')[0];h+=`<div class="card fu"><h2 class="card-t">New ladder</h2><div style="display:flex;flex-direction:column;gap:10px"><div><label class="lbl">Ladder name</label><input id="fSName" class="inp" placeholder="e.g. Friday Night Lights Mix Ladder" autofocus></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Date</label><input id="fSD" class="inp" type="date" value="${td}"></div><div><label class="lbl">Start time</label><input id="fST" class="inp" type="time" value="18:00"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Courts</label><select id="fSC" class="inp" onchange="updateCourtInputs()">${[2,3,4,5,6,7,8,10,12].map(n=>`<option value="${n}"${n===4?' selected':''}>${n}</option>`).join('')}</select></div><div><label class="lbl">Rounds</label><select id="fSR" class="inp">${[3,4,5,6,7,8,10,12].map(n=>`<option value="${n}"${n===6?' selected':''}>${n}</option>`).join('')}</select></div><div><label class="lbl">Round time (min)</label><input id="fSM" class="inp" type="number" min="1" max="20" value="12"></div><div><label class="lbl">Scoring</label><select id="fSO" class="inp"><option value="points">Points</option><option value="winloss">Win / Loss</option></select></div></div><div id="courtNamesContainer"></div><input id="fSP" class="inp" placeholder="Location (optional)"></div><div class="btn-row"><button class="bg-btn" onclick="go('dashboard','overview')">Cancel</button><button class="bp" onclick="createSessionAction()">Create</button></div></div>`}

  // No ladder
  else if(!l){h+=`<div style="text-align:center;padding:70px 20px" class="fu"><h2 class="heading" style="font-size:1.4rem;color:var(--green);margin-bottom:8px">Pickle Friends</h2><p class="subtext" style="margin-bottom:24px;line-height:1.6;max-width:320px;margin:0 auto 24px">Pickleball ladder play — automatic lineups, live scoring, and season stats.</p>${isAdmin?'<button class="bp" onclick="go(\'newLadder\')" style="padding:14px 28px">Create league</button>':'<p class="subtext">No active leagues yet.</p>'}</div>`}

  // Dashboard
  else if(view==='dashboard'){
    if(!s){h+=`<div class="card fu" style="text-align:center;padding:32px"><h3 class="heading" style="font-size:1.1rem;margin-bottom:6px">No seasons yet</h3>${isAdmin?'<button class="bp" onclick="go(\'newSeason\')">Create first season</button>':'<p class="subtext">Check back soon!</p>'}</div>`}
    else if(tab==='overview')h+=rOverview(l,s,stats);
    else if(tab==='stats')h+=rStats(stats,s,l);
    else if(tab==='players')h+=rPlayers(l);
    else if(tab==='admin'&&isAdmin)h+=rAdmin(l,s);
  }

  // Session
  else if(view==='session'&&ss){
    if(tab==='play')h+=rPlay(l,ss);
    else if(tab==='roster')h+=rPlayers(l,ss);
    else if(tab==='stats')h+=rStats(sStats,null,l,ss);
    else if(tab==='rules')h+=rRules(ss);
    else if(tab==='admin'&&isAdmin)h+=rSessionAdmin(l,ss);
  }

  // Admin footer (bottom of every page)
  h+=`<div class="admin-footer">`;
  if(!isAdmin)h+=`<button class="admin-lock-btn" onclick="openPin()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><line x1="12" y1="15" x2="12" y2="18"/></svg> Admin</button>`;
  else h+=`<button class="admin-lock-btn unlocked" onclick="lockAdmin()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Lock admin</button>`;
  h+=`</div></div>`;
  app.innerHTML=h;
  if(view==='newSession')setTimeout(updateCourtInputs,0);
  if(tab==='stats')setTimeout(tkRenderChart,10);
}

// ── OVERVIEW ──
function rOverview(l,s,stats){
  let h=`<div class="card fu"><div class="overline">Current season</div><h2 class="heading" style="font-size:1.2rem;color:var(--green)">${s.name}</h2><div class="subtext" style="margin-top:4px">${s.sessions.length} ladder${s.sessions.length!==1?'s':''} · ${l.players.length} players</div></div>`;
  if(stats.some(x=>x.w+x.l+x.t>0))h+=`<div class="chip-grid fu">${[{l:'Ladders',v:s.sessions.filter(x=>x.started).length},{l:'Games',v:Math.floor(stats.reduce((a,x)=>a+x.w+x.l+x.t,0)/2)},{l:'Players',v:l.players.length},{l:'High Pts',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)}].map(c=>`<div class="chip"><div class="chip-n">${c.v}</div><div class="chip-l">${c.l}</div></div>`).join('')}</div>`;
  if(isAdmin)h+=`<button class="bp full" onclick="go('newSession')" style="margin-bottom:14px">New ladder</button>`;
  h+=`<div class="card fu"><h3 class="card-t">Ladders</h3>`;
  if(!s.sessions.length)h+='<p class="subtext" style="text-align:center;padding:20px">No ladders scheduled yet.</p>';
  else h+=[...s.sessions].reverse().map(x=>{const st=x.finished?'<span class="pill ok">Complete</span>':x.started?`<span class="pill live"><span class="dot"></span>Rd ${x.currentRound+1}</span>`:'<span class="pill draft">Upcoming</span>';const dn=x.name||fmtDate(x.date);return`<button class="sc" onclick="openSession('${x.id}')"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;font-size:.9rem">${dn}</div><div class="subtext" style="font-size:.72rem;margin-top:2px">${fmtDate(x.date)}${x.config.startTime?' · '+fmt12(x.config.startTime):''} · ${x.config.courts} courts${x.config.place?' · '+x.config.place:''}</div></div>${st}</div></button>`}).join('');
  h+='</div>';return h;
}

// ── PLAYERS ──
function rPlayers(l,ss){
  let h='';
  if(isAdmin)h+=`<div class="card fu"><h3 class="card-t">Add player</h3><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key==='Enter')addPlayer()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addPlayer()">Add</button></div>`;
  h+=`<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Roster</h3><span class="pill ok">${l.players.length}</span></div>`;
  if(!l.players.length)h+='<p class="subtext" style="text-align:center;padding:20px">No players yet.</p>';
  else h+=l.players.map((p,i)=>`<div class="pr"><div class="pn">${i+1}</div><span style="flex:1;font-weight:600;font-size:.86rem">${p.name}</span><span class="gt ${p.gender==='F'?'f':'m'}">${p.gender}</span>${isAdmin?`<button class="edit-btn" onclick="openEditPlayer('${p.id}')">Edit</button>`:''}${isAdmin&&(!ss||!ss.started)?`<button class="rm" onclick="removePlayer('${p.id}')">×</button>`:''}</div>`).join('');
  h+='</div>';return h;
}

// ── ADMIN TAB (dashboard) ──
function rAdmin(l,s){
  let h='<div class="admin-bar-bottom">Admin</div>';
  // League
  h+=`<div class="admin-section"><div class="admin-section-t">League</div>
    <div class="cfg-row"><span class="subtext">Name</span><span style="font-weight:600">${l.name} <button class="edit-btn" onclick="renameLadder()">Edit</button></span></div>
    <div style="margin-top:8px"><button class="bp full" onclick="go('newLadder')">New league</button></div>
    <div style="margin-top:6px"><button class="bd full" onclick="deleteLadderAction()">Delete league</button></div>
  </div>`;
  // Season
  const active=l.seasons.filter(x=>!x.archived);const archived=l.seasons.filter(x=>x.archived);
  h+=`<div class="admin-section"><div class="admin-section-t">Season</div>
    <div class="cfg-row"><span class="subtext">Current</span><span style="font-weight:600">${s.name} <button class="edit-btn" onclick="renameSeason()">Edit</button></span></div>
    ${active.length>1?`<div style="margin-top:8px"><label class="lbl">Switch season</label><select class="inp" onchange="gL().activeSeason=this.value;save(gL())">${active.map(x=>`<option value="${x.id}"${x.id===l.activeSeason?' selected':''}>${x.name}</option>`).join('')}</select></div>`:''}
    <div style="display:flex;gap:6px;margin-top:8px"><button class="bp" style="flex:1" onclick="go('newSeason')">New season</button><button class="bg-btn" style="flex:1" onclick="archiveSeason('${s.id}')">Archive</button></div>
    ${archived.length?`<div style="margin-top:10px"><label class="lbl">Archived</label>${archived.map(a=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--bg-card);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600;color:var(--muted)">${a.name}</span><button class="edit-btn" onclick="unarchiveSeason('${a.id}')">Restore</button><button class="edit-btn" style="color:var(--danger)" onclick="deleteSeason('${a.id}')">Delete</button></div>`).join('')}</div>`:''}
  </div>`;
  // Ladder
  h+=`<div class="admin-section"><div class="admin-section-t">Ladders</div><button class="bp full" onclick="go('newSession')">New ladder</button></div>`;
  return h;
}

// ── ADMIN TAB (session) ──
function rSessionAdmin(l,ss){
  let h='<div class="admin-bar-bottom">Ladder admin</div>';
  const edB=(fn,label)=>`<button class="edit-btn" onclick="${fn}">${label||'Edit'}</button>`;
  h+=`<div class="admin-section"><div class="admin-section-t">Ladder settings</div>
    ${[['Name',ss.name||'Untitled',edB("editSessionName()")],['Date',fmtDate(ss.date),edB("editSessionDate()")],['Start',ss.config.startTime?fmt12(ss.config.startTime):'—',edB("editSessionTime()")],['Location',ss.config.place||'—',edB("editSessionPlace()")],['Courts',ss.config.courtNames?.join(', ')||ss.config.courts,''],['Rounds',ss.config.rounds,''],['Round time',ss.config.roundMin+' min',''],['Scoring',ss.config.scoreMode==='points'?'Points':'Win/Loss','']].map(([k,v,eb])=>`<div class="cfg-row"><span class="subtext">${k}</span><span style="font-weight:600">${v} ${eb}</span></div>`).join('')}
  </div>`;
  h+=`<div class="admin-section"><div class="admin-section-t">Players</div>
    <div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key==='Enter')addPlayer()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div>
    <button class="bp full" onclick="addPlayer()" style="margin-bottom:10px">Add player</button>
    ${l.players.map((p,i)=>`<div class="pr"><div class="pn">${i+1}</div><span style="flex:1;font-weight:600;font-size:.84rem">${p.name}</span><span class="gt ${p.gender==='F'?'f':'m'}">${p.gender}</span><button class="edit-btn" onclick="openEditPlayer('${p.id}')">Edit</button>${!ss.started?`<button class="rm" onclick="removePlayer('${p.id}')">×</button>`:''}</div>`).join('')}
  </div>`;
  return h;
}

// ── PLAY ──
function rPlay(l,ss){
  const nC=ss.config.courts;
  if(!ss.started)return`<div class="card fu" style="text-align:center;padding:28px"><h3 class="heading" style="font-size:1.05rem;color:var(--green);margin-bottom:6px">${ss.name||'Ladder'}</h3><p class="subtext" style="margin-bottom:2px">${fmtDate(ss.date)}${ss.config.startTime?' · '+fmt12(ss.config.startTime):''}</p><p class="subtext" style="margin-bottom:14px">${l.players.length} players · ${nC} courts · ${ss.config.rounds} rounds</p>${isAdmin?(l.players.length>=4?'<button class="bp full" style="padding:14px;font-size:.92rem" onclick="startSessionAction()">Generate lineups & start</button>':'<p style="color:var(--warn);font-size:.82rem">Add at least 4 players first.</p>'):'<p class="subtext">Lineups will appear when the ladder starts.</p>'}</div>`;

  const isCurrent=viewingRound===-1||viewingRound===ss.currentRound;
  const vr=isCurrent?ss.currentRound:viewingRound;
  const round=ss.rounds[vr];if(!round)return'';
  let h='';

  // Round header
  if(isCurrent){h+=`<div class="round-hdr fu"><div><div class="overline">Round</div><div class="round-num">${ss.currentRound+1} <span class="round-of">of ${ss.config.rounds}</span></div></div><div id="td" class="timer-disp" style="color:${timer<=60?'#dc2626':'#fff'}">${fmtT(timer)}</div></div><div class="timer-bar"><div id="tf" class="timer-fill" style="width:${(timer/(ss.config.roundMin*60))*100}%;background:${timer<=60?'#dc2626':timer<=180?'#d4a030':'#1a7a5c'}"></div></div>`;
    if(isAdmin)h+=`<div style="display:flex;gap:8px;margin-bottom:14px">${!timerOn?`<button class="bp" style="flex:2;padding:11px" onclick="startTimer()">${timer===0?'Start timer':'Resume'}</button>`:'<button class="bw" style="flex:1;padding:11px" onclick="pauseTimer()">Pause</button>'}<button class="bds" style="flex:1;padding:11px" onclick="endTimer()">End round</button></div>`;
  }else{h+=`<div class="card fu" style="text-align:center;padding:14px"><div class="subtext" style="font-size:.72rem">Viewing</div><h3 class="heading" style="font-size:1rem;color:var(--green);margin:4px 0">Round ${vr+1}</h3></div>`}

  // Round tabs
  h+=`<div style="display:flex;gap:4px;margin-bottom:10px;overflow-x:auto;padding-bottom:2px">`;
  for(let ri=0;ri<=ss.currentRound;ri++){const isV=(isCurrent&&ri===ss.currentRound)||(!isCurrent&&ri===vr);const done=ss.rounds[ri]?.courts.every(c=>!!c.score);
    h+=`<button onclick="viewRound(${ri===ss.currentRound?-1:ri})" style="padding:6px 12px;border-radius:var(--rx);border:1.5px solid ${isV?'var(--green)':'var(--border-s)'};background:${isV?'var(--green-pale)':'var(--bg-card)'};color:${isV?'var(--green)':'var(--muted)'};font-family:'Sora',sans-serif;font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">Rd ${ri+1}${ri===ss.currentRound?' •':done?' ✓':''}</button>`}
  h+=`</div>`;

  // Round MVPs
  const mvps=getRoundMVPs(round,l);
  const hasMVPs=mvps.m||mvps.f;
  const allScored=round.courts.every(c=>!!c.score);
  if(allScored&&hasMVPs){
    h+=`<div style="font-size:.72rem;font-weight:600;color:var(--muted);margin-bottom:6px">Round ${vr+1} top performers</div><div class="mvp-grid">`;
    if(mvps.m){const n=pNum(mvps.m.p,l);h+=`<div class="mvp-card"><div class="mvp-header"><div class="mvp-icon m"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#185FA5" stroke-width="3"><path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9Z"/></svg></div><span class="mvp-label">Top male</span></div><div class="mvp-name">#${n} ${mvps.m.p.name}</div><div class="mvp-val">${mvps.m.diff>0?'+':''}${mvps.m.diff} diff</div><div class="mvp-sub">Court ${cName(mvps.m.court,ss)}</div></div>`}
    else h+=`<div class="mvp-empty"><div class="mvp-header"><div class="mvp-icon m"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="3"><path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9Z"/></svg></div><span class="mvp-label">Top male</span></div><div class="mvp-name">—</div></div>`;
    if(mvps.f){const n=pNum(mvps.f.p,l);h+=`<div class="mvp-card"><div class="mvp-header"><div class="mvp-icon f"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#993556" stroke-width="3"><path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9Z"/></svg></div><span class="mvp-label">Top female</span></div><div class="mvp-name">#${n} ${mvps.f.p.name}</div><div class="mvp-val">${mvps.f.diff>0?'+':''}${mvps.f.diff} diff</div><div class="mvp-sub">Court ${cName(mvps.f.court,ss)}</div></div>`}
    else h+=`<div class="mvp-empty"><div class="mvp-header"><div class="mvp-icon f"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="3"><path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9Z"/></svg></div><span class="mvp-label">Top female</span></div><div class="mvp-name">—</div></div>`;
    h+=`</div>`;
  }

  // Court map
  const isOpen=mapOpen||shouldMapOpen(ss);
  h+=`<div class="map-toggle${isOpen?' open':''}" onclick="toggleMap()"><span class="label">Court map — Rd ${vr+1}</span><span class="arrow">▼</span></div><div class="court-map${isOpen?' open':''}">`;
  [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{const nm=cName(ct.court,ss);const sc=ct.score;const hasBoth=sc&&sc.t1!==null&&sc.t1!==undefined&&sc.t2!==null&&sc.t2!==undefined;h+=`<div class="cmc${hasBoth?' scored':''}"><div class="cmc-ltr">Ct ${nm}</div><div class="cmc-match">${ct.team1.filter(Boolean).map(p=>pTag(p,l)).join(' & ')}<span class="vs-s">vs</span>${ct.team2.filter(Boolean).map(p=>pTag(p,l)).join(' & ')}</div>${hasBoth?`<div class="cmc-score">${sc.t1} – ${sc.t2}</div>`:''}</div>`});
  h+='</div>';

  // Court cards
  let tabIdx=1;
  round.courts.slice().sort((a,b)=>b.court-a.court).forEach(ct=>{
    const ci=round.courts.indexOf(ct);const sc=ct.score;const hasT1=sc&&sc.t1!==null&&sc.t1!==undefined;const hasT2=sc&&sc.t2!==null&&sc.t2!==undefined;const hasBoth=hasT1&&hasT2;const w=hasBoth?sc.winner:null;const nm=cName(ct.court,ss);
    const dispScore=hasBoth?`${sc.t1} – ${sc.t2}`:(hasT1?`${sc.t1} – --`:(hasT2?`-- – ${sc.t2}`:''));
    h+=`<div class="cc${hasBoth?' scored':''} fu"><div class="cc-hdr"><div class="cc-ltr">${nm}</div><span class="cc-label">Court ${nm}</span>${dispScore?`<div class="cc-score">${dispScore}</div>`:''}</div>
    <div class="tg"><div class="tb${w==='A'?' wg':''}">${ct.team1.filter(Boolean).map(p=>`<div class="tn"><span class="num">${pTag(p,l)}</span>${p.name}<span class="gtag">${p.gender}</span></div>`).join('')}${w==='A'?'<div class="wl g">WINNER</div>':''}</div><div class="vs">VS</div><div class="tb${w==='B'?' wb':''}">${ct.team2.filter(Boolean).map(p=>`<div class="tn"><span class="num">${pTag(p,l)}</span>${p.name}<span class="gtag">${p.gender}</span></div>`).join('')}${w==='B'?'<div class="wl b">WINNER</div>':''}</div></div>`;
    if(isAdmin){if(ss.config.scoreMode==='points'){const v1=hasT1?sc.t1:'';const v2=hasT2?sc.t2:'';h+=`<div class="sr"><div class="scol"><input type="number" class="si${w==='A'?' wa':''}" min="0" max="99" placeholder="--" value="${v1}" tabindex="${tabIdx++}" oninput="submitScoreRound(${vr},${ci},'t1',this.value)"><div class="sl">TEAM A</div></div><div class="sd">—</div><div class="scol"><input type="number" class="si${w==='B'?' swb':''}" min="0" max="99" placeholder="--" value="${v2}" tabindex="${tabIdx++}" oninput="submitScoreRound(${vr},${ci},'t2',this.value)"><div class="sl">TEAM B</div></div></div>`}else h+=`<div style="display:flex;gap:8px;margin-top:14px"><button class="wlb${w==='A'?' aa':''}" onclick="setWLRound(${vr},${ci},'A')">${w==='A'?'Winner — ':''}Team A</button><button class="wlb${w==='B'?' ab':''}" onclick="setWLRound(${vr},${ci},'B')">${w==='B'?'Winner — ':''}Team B</button></div>`}
    if(hasBoth&&w!=='T')h+=`<div class="mh">Winners → Ct ${cName(Math.min(nC,ct.court+1),ss)} · Losers → Ct ${cName(Math.max(1,ct.court-1),ss)}</div>`;
    if(w==='T'&&hasBoth)h+='<div class="th">Tie — all stay</div>';h+='</div>'});

  if(isAdmin&&isCurrent)h+=`<div style="display:flex;gap:8px;margin-top:4px"><button class="bg-btn" style="flex:1" onclick="reshuffleRound()">Reshuffle</button><button class="bp" style="flex:2" onclick="nextRound()">${ss.currentRound>=ss.config.rounds-1?'Finish ladder':'Next round'}</button></div>`;
  if(isAdmin&&isCurrent&&ss.currentRound<ss.config.rounds-1)h+=`<div style="margin-top:8px"><button class="bds full" onclick="finishLadderEarly()">End ladder early</button></div>`;
  if(!isCurrent)h+=`<div style="margin-top:10px"><button class="bp full" onclick="viewRound(-1)">Back to current round</button></div>`;
  if(ss.finished)h+=`<div class="card fu" style="margin-top:14px;text-align:center;padding:22px"><h3 class="heading" style="font-size:1rem;color:var(--green);margin-bottom:4px">Ladder complete</h3><p class="subtext">Check the Stats tab for final results.</p></div>`;
  return h;
}

// ── STATS ──
function rStats(stats,season,l,ss){
  const has=stats.length>0&&stats.some(s=>s.w+s.l+s.t>0);let h='';
  const sessions=ss?[ss]:(season?season.sessions:[]);
  const isFinished=ss?ss.finished:false;

  // Podium (top)
  if(has&&stats.length>=3){
    const statusPill=isFinished?'<span class="status-pill final">Final</span>':(ss?`<span class="status-pill live"><span class="dot"></span>Rd ${ss.currentRound+1} of ${ss.config.rounds}</span>`:'<span class="status-pill live"><span class="dot"></span>In progress</span>');
    h+=`<div class="card fu"><div class="card-t">Standings ${statusPill}</div><div class="podium-wrap">`;
    [{i:1,medal:'2nd',cls:'p2'},{i:0,medal:'1st',cls:'p1 first'},{i:2,medal:'3rd',cls:'p3'}].forEach(p=>{
      const x=stats[p.i];if(!x)return;const pn=pNum(x,l);
      h+=`<div class="pod-col"><div class="pod-medal${p.i===0?' first':''}">${p.medal}</div><div class="pod-bar ${p.cls.split(' ')[0]}"><div class="pod-num">#${pn}</div><div class="pod-name">${x.name}</div><div class="pod-stat">${x.w}W ${x.l}L</div><div class="pod-pts">${x.pf}</div></div></div>`;
    });
    h+=`</div></div>`;
  }

  // Quick stats
  if(has){const ac=stats.filter(s=>s.w+s.l+s.t>0);const avgPts=ac.length?Math.round(stats.reduce((a,x)=>a+x.pf,0)/ac.length):0;
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">${[{l:'High score',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)},{l:'Avg pts/player',v:avgPts}].map(c=>`<div class="chip"><div class="chip-n">${c.v}</div><div class="chip-l">${c.l}</div></div>`).join('')}</div>`}

  // Streaks
  if(has){
    const withStreaks=stats.filter(s=>Math.abs(s.streak)>=2||s.maxStreak>=3).sort((a,b)=>Math.abs(b.streak)-Math.abs(a.streak)).slice(0,5);
    if(withStreaks.length){h+=`<div class="card fu"><h3 class="card-t">Streaks</h3>`;
      withStreaks.forEach(s=>{const pn=pNum(s,l);const isHot=s.streak>0;h+=`<div class="streak-row"><div class="streak-badge ${isHot?'hot':'cold'}">${isHot?'W':'L'}${Math.abs(s.streak)}</div><div class="streak-name">#${pn} ${s.name}</div><div class="streak-detail">${s.streak===s.w&&s.l===0?'Undefeated':'Current'}</div></div>`});
      h+='</div>'}
  }

  // Hot & cold
  if(has&&stats.some(s=>s.roundRes.length>=3)){
    const last3=stats.filter(s=>s.roundRes.length>=3).map(s=>{const r=s.roundRes.slice(-3);return{...s,l3diff:r.reduce((a,x)=>a+x.diff,0),l3pts:r.reduce((a,x)=>a+x.pf,0)}});
    const hot=last3.sort((a,b)=>b.l3diff-a.l3diff)[0];
    const cold=last3.sort((a,b)=>a.l3diff-b.l3diff)[0];
    const bestRd={p:stats[0],rd:0,pts:0,diff:0};stats.forEach(s=>s.roundRes.forEach((r,i)=>{if(r.diff>bestRd.diff){bestRd.p=s;bestRd.rd=i;bestRd.pts=r.pf;bestRd.diff=r.diff}}));
    const consistent=stats.filter(s=>s.roundPts.length>=3).map(s=>{const avg=s.pf/s.roundPts.length;const variance=s.roundPts.reduce((a,p)=>a+Math.pow(p-avg,2),0)/s.roundPts.length;return{...s,variance}}).sort((a,b)=>a.variance-b.variance)[0];

    h+=`<div class="card fu"><h3 class="card-t">Hot and cold</h3><div class="hot-grid">
      <div class="hot-card"><div class="hot-label">On fire</div><div class="hot-name">#${pNum(hot,l)} ${hot.name}</div><div class="hot-val up">${hot.l3diff>0?'+':''}${hot.l3diff} last 3 rds</div></div>
      <div class="hot-card"><div class="hot-label">Ice cold</div><div class="hot-name">#${pNum(cold,l)} ${cold.name}</div><div class="hot-val down">${cold.l3diff>0?'+':''}${cold.l3diff} last 3 rds</div></div>
      <div class="hot-card"><div class="hot-label">Round MVP</div><div class="hot-name">#${pNum(bestRd.p,l)} ${bestRd.p.name}</div><div class="hot-val up">+${bestRd.diff} in Rd ${bestRd.rd+1}</div></div>
      ${consistent?`<div class="hot-card"><div class="hot-label">Most consistent</div><div class="hot-name">#${pNum(consistent,l)} ${consistent.name}</div><div class="hot-val up">${Math.round(consistent.pf/consistent.roundPts.length)} avg</div></div>`:''}</div></div>`;
  }

  // Best partnerships
  if(has){
    const partners=calcPartners(sessions,l.players).filter(p=>p.w+p.l>=2).slice(0,5);
    if(partners.length){h+=`<div class="card fu"><h3 class="card-t">Best partnerships</h3><div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">Win rate when paired together</div>`;
      partners.forEach(p=>{const wr=Math.round(p.w/(p.w+p.l)*100);h+=`<div class="partner-row"><div class="partner-pair">#${pNum(p.p1,l)} ${p.p1.name.split(' ')[0]} + #${pNum(p.p2,l)} ${p.p2.name.split(' ')[0]}</div><div class="partner-rec">${p.w}-${p.l}</div><div class="partner-bar"><div class="partner-fill" style="width:${wr}%"></div></div></div>`});
      h+='</div>'}
  }

  // Player tracker chart
  if(has&&stats.some(s=>s.roundPts.length>0)){
    h+=`<div class="card fu"><h3 class="card-t">Player tracker</h3><div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">Cumulative points across rounds</div>
      <div class="tk-controls"><div class="tk-toggle"><button class="${tkMode==='top50'&&tkPicked.size===0?'active':''}" onclick="tkSetMode('top50')">Top 50%</button><button class="${tkMode==='all'&&tkPicked.size===0?'active':''}" onclick="tkSetMode('all')">All</button></div><button class="tk-picker-btn${tkPicked.size>0?' has-picks':''}" id="tkPickerBtn" onclick="tkTogglePicker()">Pick players</button><span class="tk-count" id="tkCount"></span></div>
      <div class="tk-player-list${tkPickerOpen?' open':''}" id="tkChips"></div><div class="tk-legend" id="tkLegend"></div>
      <div style="position:relative;width:100%;height:240px"><canvas id="tkCanvas" role="img" aria-label="Cumulative points tracker">Player tracker.</canvas></div></div>`;
  }

  // Full standings table
  h+=`<div class="card fu"><h3 class="card-t">${ss?(ss.name||'Results'):'Season standings'}</h3>`;
  if(!has)h+='<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';
  else{h+=`<div style="overflow-x:auto;margin:0 -18px;padding:0 18px"><table class="st"><thead><tr>${['#','Player','W','L','Pts','+/-','Strk'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>`;
    stats.filter(s=>s.w+s.l+s.t>0).forEach((s,i)=>{const d=s.pf-s.pa;const pn=pNum(s,l);const sk=s.streak;const skStr=sk>0?`W${sk}`:sk<0?`L${Math.abs(sk)}`:'—';
      h+=`<tr><td class="${i<3?'rt':''}">${['1st','2nd','3rd'][i]||(i+1)}</td><td style="font-weight:600"><span style="font-family:'Sora',sans-serif;color:var(--green);font-weight:700;font-size:.72rem;margin-right:4px">#${pn}</span>${s.name}</td><td class="at">${s.w}</td><td class="rdt">${s.l}</td><td>${s.pf}</td><td style="font-weight:700;color:${d>=0?'var(--green)':'var(--loss)'}">${d>0?'+':''}${d}</td><td style="color:${sk>0?'var(--green)':sk<0?'var(--loss)':'var(--muted)'};font-weight:600">${skStr}</td></tr>`});
    h+='</tbody></table></div>'}
  h+='</div>';return h;
}

// ── RULES ──
function rRules(ss){const nC=ss.config.courts;const names=ss.config.courtNames||defaultCourtNames(nC);
  return`<div class="card fu"><h3 class="card-t">Ladder format</h3>${[['Round time',ss.config.roundMin+' min'],['Courts',names.join(', ')],['Rounds',ss.config.rounds],['Start',ss.config.startTime?fmt12(ss.config.startTime):'—'],['Scoring',ss.config.scoreMode==='points'?'Points':'Win / Loss'],['Location',ss.config.place||'—']].map(([k,v])=>`<div class="cfg-row"><span class="subtext">${k}</span><span style="font-weight:600">${v}</span></div>`).join('')}</div>
  <div class="card fu"><h3 class="card-t">Movement</h3><div class="rt-text"><p><strong style="color:var(--green)">Winners</strong> move up one court</p><p><strong style="color:var(--loss)">Losers</strong> move down one court</p><p>Partners split each round</p><p><strong style="color:var(--tie)">Ties</strong> — all stay</p></div></div>
  <div class="card fu"><h3 class="card-t">How to win</h3><div class="rt-text"><p>Most <strong>cumulative points</strong> at the end wins</p><p>Tiebreaker: point differential</p><p>Every round counts equally</p></div></div>
  <div class="card fu"><h3 class="card-t">Each round</h3><div class="rt-text"><p>Play the full round duration</p><p>When timer sounds, finish the rally in progress</p><p>If the score is tied when time expires, do <strong>NOT</strong> count the last point — the game is a tie</p><p>Receiving team makes line calls</p></div></div>`}

// INIT
async function init(){ladders=await apiList();if(ladders.length){activeLadderId=ladders[0].id;const l=gL();if(l?.activeSeason)tab='overview'}render()}
document.addEventListener('DOMContentLoaded',init);
