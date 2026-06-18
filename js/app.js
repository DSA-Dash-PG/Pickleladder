// PICKLE FRIENDS — v4: Gamified dark theme, numpad scoring, court cards, player board
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b};
const fmtT=s=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}catch{return d}};
const fmt12=t=>{if(!t)return'';const[h,m]=t.split(':').map(Number);return`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`};
function cName(n,ss,tC){const base=tC!==undefined?tC:(ss?.config?.courts||4);const idx=base-n;if(!ss?.config?.courtNames?.length)return String.fromCharCode(65+idx);return ss.config.courtNames[idx]||String.fromCharCode(65+idx)}
function defaultCourtNames(n){return Array.from({length:n},(_,i)=>String.fromCharCode(65+i))}
const pTag=(p,l)=>{if(!p||!l)return'?';const i=l.players.findIndex(x=>x.id===p.id);return'#'+(i>=0?i+1:'?')};
const pNum=(p,l)=>{const i=l.players.findIndex(x=>x.id===p.id);return i>=0?i+1:0};

// ── Text size preference (persisted) ──
let textSize=localStorage.getItem('pf_textSize')||'lg';
function setTextSize(s){textSize=s;localStorage.setItem('pf_textSize',s);applyTextSize();render()}
function applyTextSize(){
  const m={
    sm: {'--cc-pname':'11px','--cc-score':'34px','--cc-score-empty':'22px','--cc-pad':'8px 7px 9px',  '--st-hdr':'7px', '--st-stat':'11px','--st-name':'11px','--st-rank':'10px','--ui-num':'15px'},
    md: {'--cc-pname':'13px','--cc-score':'40px','--cc-score-empty':'26px','--cc-pad':'10px 8px 11px','--st-hdr':'8px', '--st-stat':'12px','--st-name':'12px','--st-rank':'11px','--ui-num':'20px'},
    lg: {'--cc-pname':'15px','--cc-score':'48px','--cc-score-empty':'30px','--cc-pad':'13px 10px 14px','--st-hdr':'8px', '--st-stat':'12px','--st-name':'13px','--st-rank':'11px','--ui-num':'22px'},
    xl: {'--cc-pname':'19px','--cc-score':'58px','--cc-score-empty':'36px','--cc-pad':'15px 11px 16px','--st-hdr':'10px','--st-stat':'14px','--st-name':'15px','--st-rank':'13px','--ui-num':'26px'},
    xxl:{'--cc-pname':'23px','--cc-score':'70px','--cc-score-empty':'42px','--cc-pad':'17px 12px 18px','--st-hdr':'11px','--st-stat':'16px','--st-name':'18px','--st-rank':'15px','--ui-num':'32px'},
  };
  const vars=m[textSize]||m.lg;
  Object.entries(vars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v))}
function renderSizeBtns(){
  ['sm','md','lg','xl','xxl'].forEach(s=>{const b=document.getElementById('szBtn-'+s);if(b)b.classList.toggle('active',s===textSize)})}

// ── Theme preference (persisted) ──
let theme=localStorage.getItem('pf_theme')||'hc-dark';
function setTheme(t){theme=t;localStorage.setItem('pf_theme',t);applyTheme();render()}
function applyTheme(){document.documentElement.setAttribute('data-theme',theme)}

// ── Numpad state ──
let npState=null; // {ri, ci, field, value}
function openNumpad(ri,ci,field){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const ct=ss.rounds[ri].courts[ci];
  const existing=ct.score?(field==='t1'?ct.score.t1:ct.score.t2):null;
  npState={ri,ci,field,value:existing!=null?String(existing):''};
  render()}
function npPress(d){if(!npState)return;if(npState.value.length>=2)return;npState.value+=d;_npUpdateDisplay()}
function npDel(){if(!npState)return;npState.value=npState.value.slice(0,-1);_npUpdateDisplay()}
function npQuick(v){if(!npState)return;npState.value=String(v);_npUpdateDisplay()}
function renderNpDisplay(){_npUpdateDisplay()}
function _npUpdateDisplay(){
  const val=npState?.value===''?'--':npState?.value||'--';
  const el=document.getElementById('npActiveScore');
  if(el){el.textContent=val;return}
  render()}
async function npConfirm(){
  if(!npState)return;
  const v=npState.value===''?null:parseInt(npState.value);
  await _applyScore(npState.ri,npState.ci,npState.field,v);
  const other=npState.field==='t1'?'t2':'t1';
  const l=gL();const ss=gSS();
  if(l&&ss){
    const sc=ss.rounds[npState.ri].courts[npState.ci].score;
    const otherVal=other==='t1'?sc?.t1:sc?.t2;
    const myVal=npState.field==='t1'?sc?.t1:sc?.t2;
    if(otherVal===null||otherVal===undefined){
      // Other team not entered yet — flip to it
      npState={...npState,field:other,value:''};render();
    } else if(myVal!=null&&otherVal!=null&&myVal===otherVal){
      // Tied — keep numpad open so admin can press Moves Up
      render();
    } else {
      npState=null;render();
    }
  } else {
    npState=null;render();
  }
}
function npCancel(){npState=null;render()}
function setTieWinner(ri,ci,side){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const sc=ss.rounds[ri]?.courts[ci]?.score;if(!sc)return;
  sc.winner=side;
  const idx=ladders.findIndex(x=>x.id===l.id);if(idx>=0)ladders[idx]=l;
  clearTimeout(scoreTimer);scoreTimer=setTimeout(()=>apiSave(l),800);
  npState=null;render();}
function setTieA(ri,ci){setTieWinner(ri,ci,'A')}
function setTieB(ri,ci){setTieWinner(ri,ci,'B')}
function npSwitchField(field,existingVal){if(!npState)return;npState.field=field;npState.value=(existingVal!==null&&existingVal!==undefined&&existingVal!=='null')?String(existingVal):'';render()}

let ladders=[],activeLadderId=null,activeSessionId=null,isAdmin=false,adminPin='';
let accessPanelOpen=false;
function toggleAccessPanel(){accessPanelOpen=!accessPanelOpen;render()}
function closeAccessPanel(){if(accessPanelOpen){accessPanelOpen=false;render()}}
let view='dashboard',tab='overview',timer=0,timerOn=false,timerInt=null,pinEntry='',editingPid=null,mapOpen=false;
let formCourtCount=4,viewingRound=-1;
let swapMode=null;
let tkMode='top50',tkPickerOpen=false,tkPicked=new Set(),tkChart=null;
// Player board tab state
let pvTab='now'; // 'now' | 'next'
let statsInnerTab='standings';
let statsRankMode='pts';
let statsSearchQ='';
function setStatsInnerTab(t){statsInnerTab=t;statsSearchQ='';render()}
function setStatsRankMode(m){statsRankMode=m;render()}

// ── Player profile modal (public-side only) ──
// Tapping a player's name in standings/leaderboard opens a card with their
// season stats. Admin is intentionally excluded — admins are mid-flow during a
// ladder (entering scores, swapping players, advancing rounds) and an
// accidental tap on a name shouldn't pop a modal over their workflow.
let playerStatsModalId=null;
let playerLadderOpen=new Set([0]);
// In-round Sub modal: opens from the [Sub] button on an admin court chip.
let subModalState=null; // {ri,ci,ti,pi,pid,name}
function openSubModal(ri,ci,ti,pi){
  if(!isAdmin)return;
  const ss=gSS();const round=ss?.rounds?.[ri];if(!round)return;
  const team=ti===0?round.courts[ci].team1:round.courts[ci].team2;
  const p=team&&team[pi];
  // Allow opening for an empty slot too — modal becomes "Fill slot" instead
  // of "Sub out". Lets admins fill back in after a "Just sub out" earlier.
  subModalState={ri,ci,ti,pi,pid:p?p.id:null,name:p?p.name:''};
  render();
}
function closeSubModal(){subModalState=null;render();}
async function _subAt(replacement){
  const s=subModalState;if(!s)return;
  const l=gL();const ss=gSS();if(!l||!ss)return;
  // Only mark subbedOut if there was actually a player in this slot. Empty
  // slots being filled don't sub anyone out.
  if(s.pid){const target=l.players.find(x=>x.id===s.pid);if(target)target.subbedOut=true;}
  let newP=null;
  if(replacement.kind==='bench'){
    newP=l.players.find(x=>x.id===replacement.pid);
    if(newP){
      if(!ss.participants)ss.participants=[];
      if(!ss.participants.includes(newP.id))ss.participants.push(newP.id);
    }
  } else if(replacement.kind==='perm'){
    if(!replacement.name)return;
    newP={id:uid(),name:replacement.name,gender:replacement.gender,active:true,subbedOut:false};
    l.players.push(newP);
    if(!ss.participants)ss.participants=[];
    ss.participants.push(newP.id);
  } else if(replacement.kind==='temp'){
    if(!replacement.name)return;
    newP={id:uid(),name:replacement.name,gender:replacement.gender,active:true,subbedOut:false,temp:true};
    l.players.push(newP);
    if(!ss.participants)ss.participants=[];
    ss.participants.push(newP.id);
  }
  const round=ss.rounds[s.ri];const ct=round.courts[s.ci];
  const team=s.ti===0?ct.team1:ct.team2;
  team[s.pi]=newP?{...newP}:null;
  subModalState=null;
  await save(l);
}
async function subBenchAt(pid){await _subAt({kind:'bench',pid});}
async function subAddPermAt(){
  const n=document.getElementById('subModalPermName')?.value?.trim();
  const g=document.getElementById('subModalPermGender')?.value||'M';
  if(!n)return;
  await _subAt({kind:'perm',name:n,gender:g});
}
async function subAddTempAt(){
  const n=document.getElementById('subModalTempName')?.value?.trim();
  const g=document.getElementById('subModalTempGender')?.value||'M';
  if(!n)return;
  await _subAt({kind:'temp',name:n,gender:g});
}
async function subClearAt(){await _subAt({kind:'clear'});}

// Player profile popup is now available to everyone (admin + public). Admins
// can still tap names in standings/leaderboard tables to inspect stats; the
// risk that earlier worried us — accidental taps interrupting score entry —
// is mitigated because admin court chips now use explicit Move/Sub BUTTONS
// (not name-tap), so the standings name-tap is in a different surface.
function openPlayerStats(pid){playerStatsModalId=pid;playerLadderOpen=new Set([0]);render()}
function closePlayerStats(){playerStatsModalId=null;render()}
function togglePlayerLadder(idx){if(playerLadderOpen.has(idx))playerLadderOpen.delete(idx);else playerLadderOpen.add(idx);render()}
// Build a court-movement SVG for a single ladder's roundRes data.
// Per-round match history cards for the player modal
function buildPlayerRoundCards(se,playerId,isLight){
  const textCol=isLight?'#111':'#f4f4f0';
  const mutedCol=isLight?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.4)';
  const cardBg=isLight?'#ffffff':'#1a1a28';
  const borderCol=isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.08)';
  const winCol=isLight?'#3d6600':'#c8ff00';
  const lossCol=isLight?'#cc2200':'#ff5c47';
  let h='<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px">';
  (se.rounds||[]).forEach((round,ri)=>{
    (round.courts||[]).forEach(ct=>{
      if(!ct.score||ct.score.t1===null||ct.score.t2===null)return;
      const inT1=(ct.team1||[]).some(p=>p?.id===playerId);
      const inT2=(ct.team2||[]).some(p=>p?.id===playerId);
      if(!inT1&&!inT2)return;
      const myTeam=inT1?ct.team1:ct.team2;
      const oppTeam=inT1?ct.team2:ct.team1;
      const myScore=inT1?ct.score.t1:ct.score.t2;
      const oppScore=inT1?ct.score.t2:ct.score.t1;
      const won=myScore>oppScore;
      const partner=(myTeam||[]).find(p=>p?.id!==playerId);
      const opps=(oppTeam||[]).filter(Boolean);
      const courtLabel=cName(ct.court,se);
      const scoreCol=won?winCol:lossCol;
      h+='<div style="background:'+cardBg+';border:0.5px solid '+borderCol+';border-radius:8px">';
      h+='<div style="display:grid;grid-template-columns:28px 1fr auto;align-items:center;padding:7px 10px;gap:8px">';
      h+='<div style="font-size:9px;font-weight:500;color:'+mutedCol+';text-align:center;line-height:1.4">Rd<br><span style="font-size:12px;font-weight:700;color:'+textCol+'">'+(ri+1)+'</span></div>';
      h+='<div>';
      h+='<div style="font-size:10px;color:'+mutedCol+';margin-bottom:1px">Ct '+courtLabel+' &middot; w\/ <span style="color:'+textCol+';font-weight:500">'+(partner?.name||'—')+'<\/span><\/div>';
      h+='<div style="font-size:11px;color:'+mutedCol+'">vs <span style="color:'+textCol+'">'+opps.map(p=>p.name).join(' + ')+'<\/span><\/div>';
      h+='<\/div>';
      h+='<div style="text-align:right">';
      h+='<div style="font-size:16px;font-weight:700;color:'+scoreCol+';line-height:1">'+myScore+'<\/div>';
      h+='<div style="font-size:11px;color:'+mutedCol+';margin-top:1px">– '+oppScore+'<\/div>';
      h+='<\/div>';
      h+='<\/div><\/div>';
    });
  });
  h+='<\/div>';
  return h;
}

// roundRes: [{round,court,won},...], courtNames: string[], nCourts: number
function buildLadderChartSVG(roundRes,isLight,courtNames,nCourts){
  const n=roundRes.length;if(n<1)return'';
  const nC=Math.max(nCourts||2,courtNames?.length||2,...roundRes.map(r=>r.court));
  const W=320,xL=22,xR=314,yT=14,yB=98;
  const xStep=n>1?(xR-xL)/(n-1):0;
  const labelFor=court=>{if(courtNames&&courtNames.length>0){const idx=nC-court;if(idx>=0&&idx<courtNames.length)return courtNames[idx];}return String.fromCharCode(65+nC-court);};
  const yFor=court=>nC>1?yT+(nC-court)*((yB-yT)/(nC-1)):(yT+yB)/2;
  const gridCol=isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.06)';
  const axisCol=isLight?'rgba(0,0,0,0.55)':'rgba(255,255,255,0.4)';
  const lineCol=isLight?'#005f70':'#00e5ff';
  const winCol=isLight?'#3d6600':'#c8ff00';
  const lossCol=isLight?'#cc2200':'#ff5c47';
  let s='<svg viewBox="0 0 '+W+' 128" style="width:100%;height:128px;display:block">';
  for(let c=1;c<=nC;c++){const y=yFor(c);s+='<line x1="'+xL+'" y1="'+y+'" x2="'+xR+'" y2="'+y+'" stroke="'+gridCol+'" stroke-dasharray="2,3"/>';s+='<text x="'+(xL-8)+'" y="'+(y+3)+'" font-size="8" fill="'+axisCol+'" text-anchor="end" font-family="Sora,sans-serif" font-weight="700">'+labelFor(c)+'</text>';}
  const pts=roundRes.map((r,i)=>(xL+i*xStep)+','+yFor(r.court)).join(' ');
  s+='<polyline fill="none" stroke="'+lineCol+'" stroke-width="1.5" points="'+pts+'"/>';
  roundRes.forEach((r,i)=>{
    const x=xL+i*xStep;const y=yFor(r.court);
    const scoreCol=r.won?winCol:lossCol;
    const scoreStr=(r.pf!=null&&r.pa!=null)?r.pf+'–'+r.pa:'';
    const above=i%2===0;const ty=above?y-7:y+11;
    s+='<circle cx="'+x+'" cy="'+y+'" r="2.5" fill="'+scoreCol+'" stroke="'+(isLight?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.5)')+'" stroke-width="1"/>';
    if(scoreStr)s+='<text x="'+x+'" y="'+ty+'" font-size="7.5" fill="'+scoreCol+'" text-anchor="middle" font-family="Sora,sans-serif" font-weight="700">'+scoreStr+'</text>';
    s+='<text x="'+x+'" y="120" font-size="7" fill="'+(isLight?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.3)')+'" text-anchor="middle" font-family="Sora,sans-serif">R'+(r.round||i+1)+'</text>';
  });
  s+='</svg>';
  return s;
}
// Helper: returns an `onclick=...` attribute string for a player name row —
// but ONLY for non-admins. Admins get an empty string so the row is inert.
// Callers should ALSO append ';cursor:pointer' to their existing style attr
// (gated by !isAdmin) so the affordance is visible.
function pClick(pid){return ' onclick="event.stopPropagation();openPlayerStats(\''+pid+'\')"';}
function pCur(){return ';cursor:pointer';}
// Render a position-change badge for the leaderboard. hasPrev says whether ANY
// prior ladder exists in the season — without that flag, "no rank found" looks
// the same as "no prior ladder existed", and we'd flag the first ladder's
// players all as "new".
function renderDelta(prevRank,currentRank,hasPrev){
  if(!hasPrev)return'<span style="color:rgba(255,255,255,0.2)">\u2014</span>';
  if(!prevRank)return'<span style="color:#4ade80;font-weight:700;font-size:9px">new</span>';
  if(prevRank===currentRank)return'<span style="color:rgba(255,255,255,0.2)">\u2014</span>';
  if(prevRank>currentRank)return'<span style="color:#4ade80;font-weight:800">\u25b2'+(prevRank-currentRank)+'</span>';
  return'<span style="color:#ff5c47;font-weight:800">\u25bc'+(currentRank-prevRank)+'</span>';}
// Build the inner HTML for the #searchResults container.
// Used by both the initial render (rFullStats / rSearch) AND the live updateSearch
// patching path so they produce IDENTICAL markup (no flicker on first keystroke).
function _buildSearchCardsHTML(q,sorted,bonusData,topCtName,mvpCount,courtNames){
  const isLight=theme==='hc-light';
  if(!q)return'<div style="text-align:center;padding:20px;font-size:.82rem;color:var(--muted)">Type a name to search</div>';
  const matches=sorted.filter(st=>st.name.toLowerCase().includes(q));
  if(!matches.length)return'<div style="text-align:center;padding:20px;font-size:.82rem;color:var(--muted)">No players found for "'+q+'"</div>';
  let h='';
  matches.forEach(st=>{
    const rank=sorted.indexOf(st)+1;
    const d=st.pf-st.pa;const sk=st.streak;const skStr=sk>0?'W'+sk:sk<0?'L'+Math.abs(sk):'--';
    const avg=st.roundPts.length?(Math.round(st.pf/st.roundPts.length*10)/10).toFixed(1):0;
    const tc=topCtName?topCtName(st):'--';const wins=bonusData[st.id]?.wins||0;const bonus=bonusData[st.id]?.bonus||0;const total=st.pf+bonus;const winPct=(st.w+st.l)>0?Math.round(100*st.w/(st.w+st.l))+'%':'\u2014';
    const lr=bonusData[st.id]?.ladderResults||[];
    h+='<div style="background:var(--surf1);border:0.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px">';
    h+='<div style="background:var(--surf2);padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)">';
    h+='<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#c8ff00,#4ade80);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#000;flex-shrink:0">'+st.name.slice(0,2).toUpperCase()+'</div>';
    h+='<div style="flex:1"><div style="font-size:var(--st-name,18px);font-weight:900;color:var(--text);line-height:1">'+st.name+(wins>0?' '+crownStr(wins):'')+'</div><div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap"><span style="font-size:10px;color:var(--muted)">'+st.gender+' \u00b7 Rank #'+rank+'</span>'+((mvpCount&&mvpCount[st.id])?'<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(167,139,250,0.12);color:#a78bfa;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px"><span>\u{1F3C5}</span><span>'+mvpCount[st.id]+'\u00d7 Top</span></span>':'')+'</div></div>';
    h+='<div style="text-align:right"><div style="font-size:28px;font-weight:900;color:'+(isLight?'#3d6600':'#c8ff00')+';line-height:1">'+total+'</div><div style="font-size:8px;color:'+(isLight?'rgba(0,100,0,0.55)':'rgba(200,255,0,0.5)')+';text-transform:uppercase;letter-spacing:.1em;margin-top:2px">season pts</div></div></div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border)">';
    [{v:st.w,l:'W',c:'var(--lime)'},{v:st.l,l:'L',c:'var(--loss)'},{v:avg,l:'Avg',c:'var(--text-sec)'},{v:winPct,l:'Win %',c:'var(--text-sec)'}].forEach((x,i)=>{
      h+='<div style="padding:12px 8px;text-align:center'+(i<3?';border-right:0.5px solid var(--border)':'')+'"><div style="font-size:18px;font-weight:900;color:'+x.c+';line-height:1">'+x.v+'</div><div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:3px">'+x.l+'</div></div>';});
    h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border)">';
    [{v:st.pf,l:'PS',c:'var(--text-sec)'},{v:st.pa,l:'PA',c:'var(--text-sec)'},{v:(d>0?'+':'')+d,l:'Diff',c:d>=0?'var(--lime)':'var(--loss)'},{v:skStr,l:'Streak',c:sk>0?'var(--lime)':sk<0?'var(--loss)':'var(--muted)'}].forEach((x,i)=>{
      h+='<div style="padding:12px 8px;text-align:center'+(i<3?';border-right:0.5px solid var(--border)':'')+'"><div style="font-size:16px;font-weight:900;color:'+x.c+';line-height:1">'+x.v+'</div><div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:3px">'+x.l+'</div></div>';});
    h+='</div>';
    // Last 10 rounds — bar chart of point margin per round, color-coded by W/L
    const rr=(st.roundRes||[]).slice(-10);
    if(rr.length){
      const maxAbs=Math.max(1,...rr.map(r=>Math.abs(r.diff||0)));
      const wCount=rr.filter(r=>r.won).length;
      const lCount=rr.length-wCount;
      const netDiff=rr.reduce((a,r)=>a+(r.diff||0),0);
      h+='<div style="padding:10px 14px;border-bottom:1px solid var(--border)">';
      h+='<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.1em">LAST '+rr.length+' ROUNDS</div><div style="font-size:8px;color:var(--muted)">point margin</div></div>';
      h+='<div style="display:flex;align-items:flex-end;gap:3px;height:48px;position:relative">';
      rr.forEach(r=>{
        const pct=Math.max(8,Math.round(Math.abs(r.diff||0)/maxAbs*100));
        const col=r.won?(isLight?'#3d6600':'#c8ff00'):(isLight?'#cc2200':'#ff5c47');
        if(r.won){
          h+='<div title="+'+r.diff+'" style="flex:1;background:'+col+';height:'+pct+'%;border-radius:2px 2px 0 0"></div>';
        } else {
          h+='<div title="'+r.diff+'" style="flex:1;background:'+col+';height:'+pct+'%;border-radius:0 0 2px 2px;align-self:flex-start;margin-top:'+(48-Math.round(48*pct/100))+'px"></div>';
        }
      });
      h+='</div>';
      h+='<div style="display:flex;align-items:center;gap:10px;margin-top:6px;font-size:9px;color:'+(isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.4)')+'">';
      h+='<span><span style="display:inline-block;width:8px;height:8px;background:'+(isLight?'#3d6600':'#c8ff00')+';border-radius:1px;vertical-align:-1px;margin-right:3px"></span>won</span>';
      h+='<span><span style="display:inline-block;width:8px;height:8px;background:'+(isLight?'#cc2200':'#ff5c47')+';border-radius:1px;vertical-align:-1px;margin-right:3px"></span>lost</span>';
      h+='<span style="margin-left:auto;font-weight:700;color:'+(isLight?'rgba(0,0,0,0.65)':'rgba(255,255,255,0.55)')+'">'+wCount+'W \u00b7 '+lCount+'L \u00b7 '+(netDiff>0?'+':'')+netDiff+' net</span>';
      h+='</div>';
      h+='</div>';
    }
    // \u2500\u2500 Court Movement line chart \u2500\u2500
    // Plots which court the player was on for every round across the season.
    // Y axis = court (top court at top), X axis = chronological rounds, dashed
    // verticals split sessions (detected by round-number resetting). Dots
    // colored by W/L. Pure SVG over data already in roundRes.
    const rrAll=st.roundRes||[];
    if(rrAll.length>=2){
      const boundaries=[];
      for(let bi=1;bi<rrAll.length;bi++){if(rrAll[bi].round<rrAll[bi-1].round)boundaries.push(bi);}
      const nC=Math.max(courtNames?.length||2,...rrAll.map(r=>r.court));
      const labelFor=(court)=>{
        if(courtNames&&courtNames.length>0){const idx=nC-court;if(idx>=0&&idx<courtNames.length)return courtNames[idx];}
        return String.fromCharCode(65+nC-court);
      };
      // Peak court counts
      const courtCounts={};
      rrAll.forEach(r=>{courtCounts[r.court]=(courtCounts[r.court]||0)+1;});
      const peakCourt=Math.max(...rrAll.map(r=>r.court));
      const peakCount=courtCounts[peakCourt]||0;
      const W=320,xL=22,xR=314,yT=14,yB=98;
      const n=rrAll.length;
      const xStep=n>1?(xR-xL)/(n-1):0;
      const yFor=(court)=>nC>1?yT+(nC-court)*((yB-yT)/(nC-1)):(yT+yB)/2;
      h+='<div style="padding:10px 14px;border-bottom:1px solid var(--border);background:'+(isLight?'rgba(0,150,184,0.04)':'rgba(0,229,255,0.025)')+'">';
      h+='<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><div style="font-size:8px;font-weight:700;color:'+(isLight?'#005f70':'#00e5ff')+';letter-spacing:.1em">COURT MOVEMENT</div><div style="font-size:8px;color:'+(isLight?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.3)')+'">round &rarr; court</div></div>';
      h+='<svg viewBox="0 0 '+W+' 110" style="width:100%;height:110px;display:block">';
      // Y grid + labels
      for(let c=1;c<=nC;c++){
        const y=yFor(c);
        h+='<line x1="'+xL+'" y1="'+y+'" x2="'+xR+'" y2="'+y+'" stroke="'+(isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.06)')+'" stroke-dasharray="2,3"/>';
        h+='<text x="'+(xL-8)+'" y="'+(y+3)+'" font-size="8" fill="'+(isLight?'rgba(0,0,0,0.55)':'rgba(255,255,255,0.4)')+'" text-anchor="end" font-family="Sora,sans-serif" font-weight="700">'+labelFor(c)+'</text>';
      }
      // Session dividers — solid line + "new ladder" label
      boundaries.forEach(bi=>{
        const x=xL+bi*xStep-xStep/2;
        const _dCol=isLight?'rgba(0,0,0,0.28)':'rgba(255,255,255,0.28)';
        const _lCol=isLight?'rgba(0,0,0,0.42)':'rgba(255,255,255,0.38)';
        const _lBg=isLight?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.09)';
        h+='<line x1="'+x+'" y1="12" x2="'+x+'" y2="102" stroke="'+_dCol+'" stroke-width="1" stroke-dasharray="4,3"/>';
        h+='<rect x="'+(x-20)+'" y="1" width="40" height="10" rx="3" fill="'+_lBg+'"/>';
        h+='<text x="'+x+'" y="8.5" font-size="6.5" fill="'+_lCol+'" text-anchor="middle" font-family="Sora,sans-serif" font-weight="700" letter-spacing=".04em">new ladder</text>';
      });
      // Polyline
      const points=rrAll.map((r,i)=>(xL+i*xStep)+','+yFor(r.court)).join(' ');
      h+='<polyline fill="none" stroke="'+(isLight?'#005f70':'#00e5ff')+'" stroke-width="1.5" points="'+points+'"/>';
      // Dots colored by W/L
      rrAll.forEach((r,i)=>{
        const x=xL+i*xStep;
        const y=yFor(r.court);
        h+='<circle cx="'+x+'" cy="'+y+'" r="2.5" fill="'+(r.won?(isLight?'#3d6600':'#c8ff00'):(isLight?'#cc2200':'#ff5c47'))+'"/>';
      });
      h+='</svg>';
      h+='<div style="display:flex;align-items:center;gap:10px;margin-top:6px;font-size:8px;color:'+(isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.4)')+'">';
      h+='<span><span style="display:inline-block;width:6px;height:6px;background:'+(isLight?'#3d6600':'#c8ff00')+';border-radius:50%;vertical-align:middle;margin-right:3px"></span>won</span>';
      h+='<span><span style="display:inline-block;width:6px;height:6px;background:'+(isLight?'#cc2200':'#ff5c47')+';border-radius:50%;vertical-align:middle;margin-right:3px"></span>lost</span>';
      h+='<span style="margin-left:auto;color:'+(isLight?'rgba(0,0,0,0.65)':'rgba(255,255,255,0.55)')+';font-weight:700">peak: '+labelFor(peakCourt)+' \u00b7 '+peakCount+' round'+(peakCount!==1?'s':'')+'</span>';
      h+='</div>';
      h+='</div>';
    }
    if(lr.length){
      const maxP=Math.max(...lr.map(x=>x.pts),1);
      h+='<div style="padding:12px 16px"><div style="font-size:8px;font-weight:700;color:'+(isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.3)')+';text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">Per-ladder</div>';
      lr.slice().reverse().forEach(r=>{
        const w2=Math.round(r.pts/maxP*100);
        const rs=['1st','2nd','3rd'][r.rank-1]||(r.rank+'th');
        const d3=new Date(r.date+'T12:00:00');const ds=(d3.getMonth()+1)+'/'+(d3.getDate());
        const bc=r.rank===1?'1':r.rank===2?'0.7':'0.45';
        h+='<div style="display:flex;align-items:center;gap:8px;padding:5px 0">';
        h+='<div style="font-size:10px;color:'+(isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.4)')+';width:28px;flex-shrink:0">'+ds+'</div>';
        h+='<div style="flex:1;height:4px;background:'+(isLight?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)')+';border-radius:2px;overflow:hidden"><div style="height:100%;background:'+(isLight?'rgba(0,100,0,'+bc+')':'rgba(200,255,0,'+bc+')')+';border-radius:2px;width:'+w2+'%"></div></div>';
        h+='<div style="font-size:11px;font-weight:800;color:'+(isLight?'rgba(0,100,0,'+bc+')':'rgba(200,255,0,'+bc+')')+';width:26px;text-align:right">'+r.pts+'</div>';
        h+='<div style="font-size:9px;font-weight:800;color:'+(isLight?'rgba(0,100,0,'+bc+')':'rgba(200,255,0,'+bc+')')+';width:26px;text-align:right">'+rs+'</div>';
        if(r.bonus)h+='<div style="font-size:9px;font-weight:800;color:'+(isLight?'rgba(0,100,0,0.6)':'rgba(200,255,0,0.6)')+';width:26px;text-align:right">+'+r.bonus+'</div>';
        h+='</div>';});
      h+='</div>';}
    h+='</div>';});
  return h;
}

// Live patch \u2014 DO NOT call render(). render() rebuilds the input element and
// kills focus on every keystroke (the bug we are fixing). If we cannot find
// the results container we silently bail; the next render() will pick up the
// new query string from statsSearchQ.
function updateSearch(val){
  statsSearchQ=val;
  const el=document.getElementById('searchResults');
  if(!el)return;
  const l=gL();const s=gS();if(!l||!s)return;
  const allStats=calcStats(s.sessions,l.players);
  const bonusData=calcBonusPts(s.sessions,l.players);
  const totalPts=(st)=>st.pf+(bonusData[st.id]?.bonus||0);
  // Match the same filter predicate used by initial render so live-patching the
  // results doesn't change which players appear once the user starts typing.
  const sorted=[...allStats].filter(st=>st.w+st.l+st.t>0).sort((a,b)=>totalPts(b)-totalPts(a)||(b.pf-b.pa)-(a.pf-a.pa));
  const topCtName=(st)=>{const wonCs=(st.roundRes||[]).filter(r=>r.won).map(r=>r.court);if(!wonCs.length)return'--';const best=Math.max(...wonCs);const refSS=s.sessions.slice().reverse().find(x=>x.started);const nC=refSS?.config?.courts||4;const idx=(refSS?.config?.courtNames?.length||0)-best;return refSS?.config?.courtNames?.[idx]||String.fromCharCode(65+nC-best)};
  el.innerHTML=_buildSearchCardsHTML(val.toLowerCase().trim(),sorted,bonusData,topCtName);
}
const tkPal=['#c8ff00','#00e5ff','#ffcc00','#ff5c47','#a78bfa','#34d399','#f472b6','#60a5fa','#fb923c','#4ade80','#e879f9','#38bdf8'];
const tkDash=[[],[5,5],[2,3],[8,4],[4,2,1,2],[1,4],[6,3],[3,6],[10,3],[2,6],[6,2],[4,4]];

// Persistent admin login: PIN saved to localStorage on success, restored
// in init() so admins stay logged in across refresh / tab close. Solves
// the 'I'm logged out and didn't notice, why won't scores enter' issue.
function _savePin(pin){try{localStorage.setItem('pl-admin-pin',pin||'');}catch{}}
function _loadPin(){try{return localStorage.getItem('pl-admin-pin')||'';}catch{return'';}}
function _clearPin(){try{localStorage.removeItem('pl-admin-pin');}catch{}}
async function apiList(){try{return(await(await fetch('/api?action=list')).json()).ladders||[]}catch{return[]}}
async function apiSave(l){try{const r=await fetch('/api?action=save',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Pin':adminPin},body:JSON.stringify({ladder:l})});if(!r.ok){const d=await r.json();throw new Error(d.error)}return await r.json()}catch(e){console.error(e);alert('Save failed: '+e.message);return null}}
async function apiDel(id){try{return await(await fetch(`/api?action=delete&id=${id}`,{method:'DELETE',headers:{'X-Admin-Pin':adminPin}})).json()}catch{return null}}
async function apiVerifyPin(pin){try{const r=await fetch('/api?action=verify-pin',{headers:{'X-Admin-Pin':pin}});return(await r.json()).valid}catch{return false}}

function gL(){return ladders.find(l=>l.id===activeLadderId)||null}
function gS(){const l=gL();if(!l)return null;if(l.activeSeason){const s=l.seasons.find(x=>x.id===l.activeSeason);if(s)return s}return l.seasons.find(x=>!x.archived)||null}
function gSS(){const s=gS();return s?.sessions.find(ss=>ss.id===activeSessionId)||null}
function gParts(ss,l){if(!ss||!l)return[];if(!ss.participants||!ss.participants.length)return l.players.filter(p=>p.active!==false&&!p.subbedOut);return ss.participants.map(id=>l.players.find(p=>p.id===id)).filter(p=>p&&p.active!==false&&!p.subbedOut)}
async function save(l,skipRender){const i=ladders.findIndex(x=>x.id===l.id);if(i>=0)ladders[i]=l;else ladders.push(l);const r=await apiSave(l);if(r&&!skipRender)render();return r}

let scoreTimer=null;
// Score mutation: no render on every digit; save+refresh only when both scores are set.
async function _applyScore(ri,ci,field,v){
  const l=gL();const ss=gSS();if(!l||!ss||!ss.rounds[ri])return;
  const ct=ss.rounds[ri].courts[ci];
  const sc=ct.score||{t1:null,t2:null,winner:null};
  sc[field]=v;
  if(sc.t1!==null&&sc.t2!==null){sc.winner=sc.t1===sc.t2?null:(sc.t1>sc.t2?'A':'B')}
  else{sc.winner=null}
  ct.score=sc;
  const idx=ladders.findIndex(x=>x.id===l.id);if(idx>=0)ladders[idx]=l;
  clearTimeout(scoreTimer);
  if(sc.t1!==null&&sc.t2!==null){
    // Both scores entered — persist silently in the background. We deliberately
    // do NOT re-fetch/refreshLadder() here: the local state already holds the
    // score and render() has shown it, so a re-fetch only causes the visible
    // "scores disappear then reappear" flicker and a wait between games. A solo
    // operator can now enter every game with no pause; data is still saved per
    // pair for safety. (Cross-device sync still happens via the 5 s poll.)
    scoreTimer=setTimeout(async()=>{
      await apiSave(l);
      scoreTimer=null;
    },500);
  }
  // Single score only: skip save until the pair is complete
}

// kept for win/loss mode (no numpad needed there)
async function submitScoreRound(ri,ci,f,v){await _applyScore(ri,ci,f,v===''?null:parseInt(v)||0);render()}
async function setWLRound(ri,ci,w){
  const l=gL();const ss=gSS();if(!l||!ss||!ss.rounds[ri])return;
  ss.rounds[ri].courts[ci].score={t1:w==='A'?1:0,t2:w==='B'?1:0,winner:w};await save(l)}

// Build the two teams for a single court.
//
// Priority of rules (highest → lowest):
//   1. Gender balance — if 2M+2F on the court, teams MUST be mixed (M+F vs
//      M+F). If 3M+1F (or 1M+3F), the lone player teams up with the strongest
//      opposite-gender player on the court so a single woman never has to
//      face two guys.
//   2. No-repeat-partner — among gender-balance-valid pairings, prefer ones
//      where neither team was together in the previous round.
//   3. Snake-draft for strength — among the remaining valid pairings, prefer
//      the one that splits playing strength most evenly (strongest paired
//      with weakest of the opposite-gender / different-tier player).
//
// `strength` is a `(playerId)=>number` lookup; falsy/missing → 0. Higher
// means stronger.
function makeCoed(group,pp,strength){
  const str=typeof strength==='function'?strength:(()=>0);
  const g=group.filter(Boolean);
  if(g.length<2)return{t1:[g[0]||null,null],t2:[null,null]};
  const males=g.filter(p=>p.gender==='M').slice().sort((a,b)=>str(b.id)-str(a.id));
  const females=g.filter(p=>p.gender==='F').slice().sort((a,b)=>str(b.id)-str(a.id));
  const noRepeat=(a,b,c,d)=>{if(!pp)return true;return pp[a?.id]!==b?.id&&pp[b?.id]!==a?.id&&pp[c?.id]!==d?.id&&pp[d?.id]!==c?.id};
  // teamStrength sum for snake-draft scoring; balance score = |Δ| (lower=better)
  const teamStr=(a,b)=>str(a?.id)+str(b?.id);
  const balanceScore=([a,b])=>Math.abs(teamStr(a[0],a[1])-teamStr(b[0],b[1]));

  const pairings=[];
  if(males.length===2&&females.length===2){
    // 2M+2F → mixed only. Two valid mixed pairings; rank by balance.
    pairings.push([[males[0],females[1]],[males[1],females[0]]]); // snake
    pairings.push([[males[0],females[0]],[males[1],females[1]]]); // straight
  } else if(males.length===3&&females.length===1){
    // 3M+1F → F always plays WITH a male. Prefer her with the strongest, then
    // 2nd strongest as fallback for no-repeat. Other team is the leftover Ms.
    pairings.push([[males[0],females[0]],[males[1],males[2]]]);
    pairings.push([[males[1],females[0]],[males[0],males[2]]]);
    pairings.push([[males[2],females[0]],[males[0],males[1]]]);
  } else if(males.length===1&&females.length===3){
    // 1M+3F mirror.
    pairings.push([[females[0],males[0]],[females[1],females[2]]]);
    pairings.push([[females[1],males[0]],[females[0],females[2]]]);
    pairings.push([[females[2],males[0]],[females[0],females[1]]]);
  } else if(males.length===4||females.length===4){
    // Single-gender court → snake-draft so the two strongest aren't paired.
    const arr=males.length===4?males:females;
    pairings.push([[arr[0],arr[3]],[arr[1],arr[2]]]); // snake
    pairings.push([[arr[0],arr[2]],[arr[1],arr[3]]]);
    pairings.push([[arr[0],arr[1]],[arr[2],arr[3]]]);
  } else {
    // Odd group sizes (court underfilled or stray sub). Fallback: keep the
    // existing 3-split logic, but if we have at least one M and one F, pair
    // them together first.
    if(g[0]&&g[1]&&g[2]&&g[3]){
      pairings.push([[g[0],g[1]],[g[2],g[3]]]);
      pairings.push([[g[0],g[2]],[g[1],g[3]]]);
      pairings.push([[g[0],g[3]],[g[1],g[2]]]);
    } else if(males.length>=1&&females.length>=1){
      const others=g.filter(p=>p!==males[0]&&p!==females[0]);
      pairings.push([[males[0],females[0]],[others[0]||null,others[1]||null]]);
    }
  }

  // Pick: first no-repeat pairing; if none, take the most balanced one we have.
  const noRepeatOpts=pairings.filter(([a,b])=>noRepeat(a[0],a[1],b[0],b[1]));
  let chosen;
  if(noRepeatOpts.length){
    // Among no-repeat options, prefer the most balanced
    chosen=noRepeatOpts.slice().sort((x,y)=>balanceScore(x)-balanceScore(y))[0];
  } else if(pairings.length){
    chosen=pairings.slice().sort((x,y)=>balanceScore(x)-balanceScore(y))[0];
  }
  if(!chosen)return{t1:[g[0]||null,g[1]||null],t2:[g[2]||null,g[3]||null]};
  return{t1:[chosen[0][0]||null,chosen[0][1]||null],t2:[chosen[1][0]||null,chosen[1][1]||null]};
}
function genR1(players,nC,strength){const tC=Math.min(Math.floor(players.length/4),2*nC);const males=shuffle(players.filter(p=>p.gender==='M')),females=shuffle(players.filter(p=>p.gender==='F'));const courts=[];let mi=0,fi=0;for(let c=0;c<tC;c++){const g=[];for(let x=0;x<2;x++){if(mi<males.length)g.push(males[mi++])}for(let x=0;x<2;x++){if(fi<females.length)g.push(females[fi++])}while(g.length<4&&mi<males.length)g.push(males[mi++]);while(g.length<4&&fi<females.length)g.push(females[fi++]);const{t1,t2}=makeCoed(g,null,strength);courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}const res={courts,completed:false,totalCourts:tC};if(tC>nC)res.wave2started=false;return res}
function genNR(prev,nC,strength){
  const tC=prev.courts.length; // total virtual courts from previous round
  // Build previous-partner map so we can guarantee splits
  const pp={};
  prev.courts.forEach(c=>{
    [c.team1,c.team2].forEach(t=>{
      if(t[0]&&t[1]){pp[t[0].id]=t[1].id;pp[t[1].id]=t[0].id}})});

  // Movement rules:
  // Court tC (top/king): winners STAY (move to tC), losers DROP to tC-1
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
    // Winners move up (capped at tC — top court winners stay)
    w.filter(Boolean).forEach(p=>mvs.push({p,to:Math.min(tC,c.court+1)}));
    // Losers move down (floor at 1 — bottom court losers stay)
    lo.filter(Boolean).forEach(p=>mvs.push({p,to:Math.max(1,c.court-1)}));
  });

  // Bucket players by destination court
  const bk={};for(let i=1;i<=tC;i++)bk[i]=[];
  mvs.forEach(m=>{if(bk[m.to])bk[m.to].push(m.p)});

  // Shuffle within each bucket (randomises team assignment within the court)
  // then pair with makeCoed which enforces no-repeat-partner rule
  for(let i=1;i<=tC;i++)bk[i]=shuffle(bk[i]);

  const courts=[];
  for(let c=0;c<tC;c++){
    const g=bk[c+1]||[];
    const{t1,t2}=makeCoed(g.slice(0,4),pp,strength);
    courts.push({court:c+1,team1:[t1[0]||null,t1[1]||null],team2:[t2[0]||null,t2[1]||null],score:null})}
  const res={courts,completed:false,totalCourts:tC};
  if(tC>nC)res.wave2started=false;
  return res}

function crownStr(wins){
  if(!wins||wins<1)return'';
  if(wins===1)return'👑';
  return'👑×'+wins;}

function calcBonusPts(sessions,players){
  const bonus={};
  players.forEach(p=>bonus[p.id]={bonus:0,wins:0,ladderResults:[]});
  sessions.forEach(sess=>{
    // NOTE: do NOT filter by `sess.started`. calcStats() doesn't filter by it
    // either, so a session whose `started` flag is missing/false but DOES have
    // scored rounds (e.g. an older ladder, or a session whose flag got cleared
    // by a restart/edit) was correctly counted in stats but silently skipped
    // for bonuses. That's why podium finishes from previous ladders were
    // missing (Clement +5 for 3rd, etc.). The empty-rounds case is harmless:
    // the inner court loop produces no points, so no one gets bonus anyway.
    if(!sess||!Array.isArray(sess.rounds)||!sess.rounds.length)return;
    // Track BOTH points scored and points against per player so we can break
    // intra-ladder ties on diff (matches the leaderboard sort: pts then PS-PA).
    // Without this, two players tied on intra-ladder pts get bonus assigned
    // by Object.entries iteration order — the Clement-vs-Rich case where
    // Rich got the +5 even though Clement had +31 diff vs Rich's +8.
    const pts={},pa={};players.forEach(p=>{pts[p.id]=0;pa[p.id]=0;});
    sess.rounds.forEach(round=>{round.courts.forEach(c=>{
      if(!c.score||c.score.t1===null||c.score.t2===null||!c.score.winner)return;
      const{t1,t2}=c.score;
      [[c.team1,t1,t2],[c.team2,t2,t1]].forEach(([team,sc,al])=>{team.filter(Boolean).forEach(p=>{if(pts[p.id]!==undefined){pts[p.id]+=sc;pa[p.id]+=al;}})})})});
    const ranked=Object.entries(pts).filter(([id,p])=>p>0).sort((a,b)=>b[1]-a[1]||((b[1]-pa[b[0]])-(a[1]-pa[a[0]])));
    if(!ranked.length)return; // no scored games in this session — nothing to award
    const bonusMap={0:15,1:10,2:5};
    ranked.forEach(([id],i)=>{
      if(!bonus[id])return;
      const b=bonusMap[i]||0;
      bonus[id].bonus+=b;
      if(i===0)bonus[id].wins++;
      bonus[id].ladderResults.push({date:sess.date,pts:pts[id],rank:i+1,bonus:b,sessId:sess.id})});
  });
  return bonus;}

function calcStats(sessions,players){
  const s={};players.forEach(p=>{s[p.id]={id:p.id,name:p.name,gender:p.gender,w:0,l:0,t:0,pf:0,pa:0,best:0,attended:0,courtHist:[],roundRes:[],streak:0,maxStreak:0,roundPts:[]}});
  sessions.forEach(sess=>{const played=new Set();
    sess.rounds.forEach((round,ri)=>{round.courts.forEach(c=>{if(!c.score||c.score.t1===null||c.score.t1===undefined||c.score.t2===null||c.score.t2===undefined||!c.score.winner)return;const{t1,t2,winner}=c.score;
      [[c.team1,t1,t2,winner==='A'],[c.team2,t2,t1,winner==='B']].forEach(([team,sc,al,won])=>{team.filter(Boolean).forEach(p=>{if(!s[p.id])return;played.add(p.id);s[p.id].pf+=sc;s[p.id].pa+=al;
        if(won){s[p.id].w++;s[p.id].streak=s[p.id].streak>0?s[p.id].streak+1:1;s[p.id].maxStreak=Math.max(s[p.id].maxStreak,s[p.id].streak)}else{s[p.id].l++;s[p.id].streak=s[p.id].streak<0?s[p.id].streak-1:-1}
        s[p.id].best=Math.max(s[p.id].best,c.court);s[p.id].courtHist.push({round:ri+1,court:c.court});s[p.id].roundRes.push({round:ri+1,court:c.court,won,pf:sc,pa:al,diff:sc-al});s[p.id].roundPts.push(sc)})})})});
    played.forEach(id=>{if(s[id])s[id].attended++})});
  return Object.values(s).sort((a,b)=>b.pf!==a.pf?b.pf-a.pf:(b.pf-b.pa)-(a.pf-a.pa))}

// Tally how many round Top-Performer awards each player has earned across the season.
// Returns {playerId: count}. Uses the existing getRoundMVPs which picks top
// 2 male + top 2 female by intra-round point margin.
function calcMvpCount(sessions,ladder){
  const cnt={};
  if(!sessions||!ladder)return cnt;
  sessions.forEach(sess=>{
    if(!sess||!Array.isArray(sess.rounds))return;
    sess.rounds.forEach(round=>{
      const{male,female}=getRoundMVPs(round,ladder);
      [...male,...female].forEach(x=>{const id=x.p?.id;if(id){cnt[id]=(cnt[id]||0)+1;}});
    });
  });
  return cnt;
}
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

// ── Dink Rating — composite 0–100 skill score ──
// 8 components: CourtPerf(25) OppoQuality(20) PartnerIndep(15) PointDiff(10) Consistency(10) CourtHold(10) Recovery(5) PartnerDiversity(5)
function calcDinkRating(statsArr, sessions, players) {
  if (!statsArr || !statsArr.length) return {};
  const pprMap = {};
  statsArr.forEach(s => { pprMap[s.id] = s.roundPts && s.roundPts.length ? s.pf / s.roundPts.length : 0; });
  const allPpr = Object.values(pprMap);
  const avgPpr = allPpr.length ? allPpr.reduce((a,b)=>a+b,0)/allPpr.length : 8;
  const roundDetail = {};
  if (sessions) {
    sessions.forEach(sess => {
      sess.rounds.forEach(round => {
        round.courts.forEach(c => {
          if (!c.score || c.score.t1 === null || c.score.t2 === null) return;
          [[c.team1, c.score.t1, c.score.t2], [c.team2, c.score.t2, c.score.t1]].forEach(([team, pf, pa]) => {
            const valid = team.filter(Boolean);
            if (valid.length < 2) return;
            const [p1, p2] = valid;
            const opp = team === c.team1 ? c.team2 : c.team1;
            const oppPpr = opp.filter(Boolean).reduce((a,p)=>a+(pprMap[p.id]??avgPpr),0)/Math.max(1,opp.filter(Boolean).length);
            [p1,p2].forEach((p,i)=>{
              if(!roundDetail[p.id])roundDetail[p.id]=[];
              roundDetail[p.id].push({court:c.court||1,pf,pa,partnerPpr:i===0?(pprMap[p2.id]??avgPpr):(pprMap[p1.id]??avgPpr),oppoPpr:oppPpr,partnerId:i===0?p2.id:p1.id});
            });
          });
        });
      });
    });
  }
  const maxCourt = Math.max(...statsArr.flatMap(s=>s.courtHist.map(x=>x.court)),1);
  const ratings = {};
  calcDinkRating._breakdown = {};
  statsArr.forEach(s => {
    if (s.w+s.l===0){ratings[s.id]=null;return;}
    const rd = roundDetail[s.id]||[];
    const nR = rd.length||1;
    const courtWts = rd.map(r=>r.court/maxCourt);
    const wWins = rd.reduce((a,r,i)=>a+(r.pf>r.pa?courtWts[i]:0),0);
    const wTotal = courtWts.reduce((a,w)=>a+w,0)||1;
    const c1 = wWins/wTotal;
    const avgOppo = rd.length?rd.reduce((a,r)=>a+r.oppoPpr,0)/rd.length:avgPpr;
    const c2 = Math.min(1,avgOppo/(avgPpr*1.5||1));
    const weakRounds = rd.filter(r=>r.partnerPpr<avgPpr);
    const c3 = weakRounds.length?weakRounds.filter(r=>r.pf>r.pa).length/weakRounds.length:(s.w/(s.w+s.l));
    const maxPts = Math.max(...statsArr.map(x=>x.pf),1);
    const c4 = Math.max(0,Math.min(1,((s.pf-s.pa)+maxPts*0.4)/(maxPts*0.8)));
    const pts = rd.map(r=>r.pf);
    const mean = pts.length?pts.reduce((a,b)=>a+b,0)/pts.length:0;
    const variance = pts.length?pts.reduce((a,b)=>a+Math.pow(b-mean,2),0)/pts.length:0;
    const c5 = Math.max(0,1-Math.sqrt(variance)/(mean||1));
    const c6 = rd.length?rd.filter(r=>r.court>maxCourt/2).length/rd.length:0;
    let recoveries=0,recOpps=0;
    for(let i=1;i<rd.length;i++){if(rd[i-1].pf<rd[i-1].pa){recOpps++;if(rd[i].pf>rd[i].pa)recoveries++;}}
    const c7 = recOpps>0?recoveries/recOpps:0.5;
    const c8 = Math.min(1,new Set(rd.map(r=>r.partnerId)).size/Math.max(nR*0.5,1));
    ratings[s.id] = Math.round((c1*0.25+c2*0.20+c3*0.15+c4*0.10+c5*0.10+c6*0.10+c7*0.05+c8*0.05)*1000)/10;
    calcDinkRating._breakdown[s.id] = {c1,c2,c3,c4,c5,c6,c7,c8};
  });
  return ratings;
}

// DR Legend modal
function openDRLegend(){
  if(document.getElementById('drLegendModal'))return;
  const isLight=document.body.classList.contains('light');
  const bg=isLight?'rgba(0,0,0,0.55)':'rgba(0,0,0,0.75)';
  const surf=isLight?'#fff':'#1a1a2e';
  const txt=isLight?'#111':'#e8e8f0';
  const muted=isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.45)';
  const border=isLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.08)';
  const components=[
    {emoji:'🏆',label:'Court-Weighted Performance',weight:'25%',desc:'Win rate at each court, scaled by how prestigious that court is. Winning at the top court counts more than winning at the bottom.'},
    {emoji:'⚔️',label:'Opposition Quality',weight:'20%',desc:'Average skill of the opponents you faced (by points per round). Beating strong opponents boosts this score.'},
    {emoji:'🧠',label:'Partner Independence',weight:'15%',desc:'Your win rate specifically in rounds where your partner is below average. Shows how much you carry your side.'},
    {emoji:'📈',label:'Point Differential',weight:'10%',desc:'Your net points (scored minus allowed), normalized across all players. Bigger margin wins score higher.'},
    {emoji:'🎯',label:'Consistency',weight:'10%',desc:'Low variance in your per-round point totals. Steady performers score higher than boom-or-bust ones.'},
    {emoji:'🔝',label:'Court Hold Rate',weight:'10%',desc:'Percentage of your rounds played on the top half of courts. Staying at high courts reflects sustained performance.'},
    {emoji:'💪',label:'Recovery Rate',weight:'5%',desc:'How often you win the round immediately after a loss. Measures mental resilience and bounce-back ability.'},
    {emoji:'🤝',label:'Partner Diversity',weight:'5%',desc:"How many unique partners you've played with relative to your total rounds. Adapting to different partners shows versatility."},
  ];
  let rows=components.map(c=>'<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid '+border+'">'
    +'<div style="font-size:20px;line-height:1;padding-top:2px">'+c.emoji+'</div>'
    +'<div style="flex:1">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
        +'<span style="font-weight:700;font-size:13px;color:'+txt+'">'+c.label+'</span>'
        +'<span style="background:#a78bfa;color:#fff;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;flex-shrink:0">'+c.weight+'</span>'
      +'</div>'
      +'<div style="font-size:12px;color:'+muted+';line-height:1.5">'+c.desc+'</div>'
    +'</div>'
  +'</div>').join('');
  const html='<div id="drLegendModal" onclick="if(event.target.id===\'drLegendModal\')closeDRLegend()" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:'+bg+'">'
    +'<div style="background:'+surf+';border-radius:18px 18px 0 0;width:100%;max-width:520px;max-height:88vh;overflow-y:auto;padding:20px 18px 32px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
        +'<div style="font-size:18px;font-weight:800;color:'+txt+'">⬡ D(r)ink Rating</div>'
        +'<button onclick="closeDRLegend()" style="background:none;border:none;font-size:22px;cursor:pointer;color:'+muted+';padding:4px 6px;line-height:1">✕</button>'
      +'</div>'
      +'<div style="font-size:12px;color:'+muted+';margin-bottom:14px">A composite 0–100 skill score across 8 components. Recalculated after every round.</div>'
      +rows
    +'</div>'
  +'</div>';
  document.body.insertAdjacentHTML('beforeend',html);
}
function closeDRLegend(){const m=document.getElementById('drLegendModal');if(m)m.remove();}

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
async function checkPin(){const v=await apiVerifyPin(pinEntry);if(v){adminPin=pinEntry;isAdmin=true;_savePin(pinEntry);closePin();render()}else{document.getElementById('pinErr').textContent='Incorrect PIN';pinEntry='';rPD();setTimeout(()=>{const e=document.getElementById('pinErr');if(e)e.textContent=''},2000)}}
function lockAdmin(){isAdmin=false;adminPin='';_clearPin();render()}

// Player management
function openEditPlayer(pid){const l=gL();if(!l)return;const p=l.players.find(x=>x.id===pid);if(!p)return;editingPid=pid;document.getElementById('edName').value=p.name;document.getElementById('edGender').value=p.gender;document.getElementById('editModal').classList.add('open')}
function closeEditModal(){document.getElementById('editModal').classList.remove('open');editingPid=null}
async function saveEditPlayer(){const l=gL();if(!l||!editingPid)return;const p=l.players.find(x=>x.id===editingPid);if(!p)return;const nn=document.getElementById('edName').value.trim()||p.name;const ng=document.getElementById('edGender').value;p.name=nn;p.gender=ng;const s=gS();if(s){s.sessions.forEach(sess=>{sess.rounds.forEach(round=>{round.courts.forEach(ct=>{[ct.team1,ct.team2].forEach(team=>{team.forEach((tp,i)=>{if(tp&&tp.id===editingPid){team[i]={...tp,name:nn,gender:ng}}})})})})})}closeEditModal();await save(l)}
async function replacePlayer(oldPid){const l=gL();if(!l)return;const oldP=l.players.find(x=>x.id===oldPid);if(!oldP)return;const n=prompt('New player name to replace '+oldP.name+':');if(!n?.trim())return;const g=prompt('Gender (M/F):','M');if(g!=='M'&&g!=='F')return;const newP={id:uid(),name:n.trim(),gender:g,active:true};l.players.push(newP);oldP.active=false;const ss=gSS();if(ss){if(ss.participants){const idx=ss.participants.indexOf(oldPid);if(idx>=0)ss.participants[idx]=newP.id}ss.rounds.forEach(round=>{round.courts.forEach(ct=>{[ct.team1,ct.team2].forEach(team=>{team.forEach((tp,i)=>{if(tp&&tp.id===oldPid){team[i]={...newP}}})})})})}await save(l)}
// Sub out: mark the player as subbedOut AND actually remove them from the
// current round's courts. If there's a bench player (a participant who
// isn't currently on any court — same gender preferred), drop them in to
// fill the empty slot. Otherwise the slot becomes null and admin can swap
// someone in manually.
async function subOutPlayer(pid){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const p=l.players.find(x=>x.id===pid);if(!p)return;
  p.subbedOut=true;
  // Pull them out of the current round's courts (only if a round is active)
  const round=ss.rounds&&ss.rounds[ss.currentRound];
  if(round){
    // Build a bench: active participants who are NOT currently on a court
    const onCourt=new Set();
    round.courts.forEach(c=>{[...(c.team1||[]),...(c.team2||[])].forEach(x=>{if(x)onCourt.add(x.id);});});
    // Bench tier 1: participants of THIS ladder who aren\u2019t on a court right now
    const partBench=(ss.participants||[]).map(id=>l.players.find(x=>x.id===id))
      .filter(x=>x&&x.active!==false&&!x.subbedOut&&!x.temp&&x.id!==pid&&!onCourt.has(x.id));
    // Bench tier 2: active league players not in this ladder. Pulled in
    // automatically as a participant so their stats accumulate normally.
    const partIds=new Set(ss.participants||[]);
    const leagueBench=l.players
      .filter(x=>x&&x.active!==false&&!x.subbedOut&&!x.temp&&x.id!==pid&&!partIds.has(x.id));
    const bench=[...partBench,...leagueBench];
    const benchIsLeague=(b)=>!partIds.has(b.id);
    // Replace the subbedOut player on each court team slot
    round.courts.forEach(c=>{
      [c.team1,c.team2].forEach(team=>{
        team.forEach((slot,i)=>{
          if(slot&&slot.id===pid){
            // Prefer same-gender bench player so gender balance survives
            const same=bench.findIndex(b=>b.gender===p.gender);
            const idx=same>=0?same:(bench.length?0:-1);
            if(idx>=0){const picked=bench[idx];if(benchIsLeague(picked)){if(!ss.participants)ss.participants=[];ss.participants.push(picked.id);partIds.add(picked.id);}team[i]={...picked};bench.splice(idx,1);}
            else{team[i]=null;}
          }
        });
      });
    });
  }
  await save(l);
}
// Sub back in: clear the flag. Player is now eligible for the next round.
// (We don't auto-insert into the current round — admin can swap them in if
// they want, since someone else may already be filling the slot.)
async function subInPlayer(pid){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const p=l.players.find(x=>x.id===pid);if(!p)return;
  p.subbedOut=false;await save(l)}
// Two kinds of sub-in additions:
//   - Permanent sub: full league member, stats roll up to season leaderboard.
//   - Temp sub (one-night): marked `temp:true`, plays this ladder, counts in
//     this ladder\u2019s stats, but excluded from season leaderboard. Useful
//     for "a friend showed up to fill in" so the score keeping stays clean.
async function _addSub(name,gender,opts){
  const l=gL();const ss=gSS();if(!l||!ss)return null;
  const p={id:uid(),name:name,gender:gender,active:true,subbedOut:false};
  if(opts&&opts.temp)p.temp=true;
  l.players.push(p);
  if(!ss.participants)ss.participants=[];
  ss.participants.push(p.id);
  return p;
}
async function addSubPlayer(){
  const n=document.getElementById('fSubName')?.value?.trim();
  const g=document.getElementById('fSubGender')?.value||'M';
  if(!n)return;
  await _addSub(n,g,{temp:false});
  const fld=document.getElementById('fSubName');if(fld)fld.value='';
  const l=gL();await save(l);
}
async function addTempSubPlayer(){
  const n=document.getElementById('fTempSubName')?.value?.trim();
  const g=document.getElementById('fTempSubGender')?.value||'M';
  if(!n)return;
  await _addSub(n,g,{temp:true});
  const fld=document.getElementById('fTempSubName');if(fld)fld.value='';
  const l=gL();await save(l);
}
// Pull an existing-but-not-in-ladder league player into the active ladder.
// They become a participant and (if there\u2019s an empty slot in the current
// round) get auto-placed there. Otherwise they sit on the bench until the
// next round generation picks them up.
async function pullFromBench(pid){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const p=l.players.find(x=>x.id===pid);if(!p)return;
  if(!ss.participants)ss.participants=[];
  if(!ss.participants.includes(p.id))ss.participants.push(p.id);
  // Try to fill an empty court slot in the current round
  const round=ss.rounds&&ss.rounds[ss.currentRound];
  if(round){
    let placed=false;
    round.courts.forEach(c=>{
      [c.team1,c.team2].forEach(team=>{
        team.forEach((slot,i)=>{
          if(!slot&&!placed){team[i]={...p};placed=true;}
        });
      });
    });
  }
  await save(l);
}
async function addPlayer(){const l=gL();if(!l)return;const n=document.getElementById('fPN')?.value?.trim();const g=document.getElementById('fPG')?.value||'M';if(!n)return;l.players.push({id:uid(),name:n,gender:g,active:true});document.getElementById('fPN').value='';await save(l)}
async function deactivatePlayer(pid){const l=gL();if(!l||!confirm('Deactivate this player? They will be hidden from the picker but their historical stats are preserved.'))return;const p=l.players.find(x=>x.id===pid);if(p)p.active=false;await save(l)}
// Hard-delete a player from the league. Intended for duplicates / mistaken adds.
// Guarded: refuses if the player appears in ANY game lineup, since removing them
// would leave dangling references and corrupt standings/history (use Deactivate
// for someone who has actually played). Also strips them from any session's
// participant list so no upcoming ladder still references the deleted id.
async function deletePlayer(pid){
  const l=gL();if(!l)return;
  const p=l.players.find(x=>x.id===pid);if(!p)return;
  let refs=0;
  (l.seasons||[]).forEach(s=>(s.sessions||[]).forEach(sess=>(sess.rounds||[]).forEach(rd=>(rd.courts||[]).forEach(ct=>{[ct.team1,ct.team2].forEach(team=>(team||[]).forEach(tp=>{if(tp&&tp.id===pid)refs++}))}))));
  if(refs>0){alert('"'+p.name+'" appears in '+refs+' game lineup(s), so deleting would corrupt the standings and history. Use "Deactivate" instead to hide them while keeping their record.');return}
  if(!confirm('Permanently delete "'+p.name+'"? This cannot be undone. Use this only for duplicates or players who have never played.'))return;
  l.players=l.players.filter(x=>x.id!==pid);
  (l.seasons||[]).forEach(s=>(s.sessions||[]).forEach(sess=>{if(sess.participants)sess.participants=sess.participants.filter(id=>id!==pid)}));
  await save(l);
}
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
// Strength = average season game pts per round, used for pairing balance.
// New players (no roundPts yet) score 0 → end up at the bottom of the snake
// draft, which is fair: they get matched up before being trusted as anchors.
function _buildStrengthFn(l){
  const s=gS();
  if(!s||!l)return()=>0;
  const stats=calcStats(s.sessions,l.players);
  const m={};
  stats.forEach(x=>{m[x.id]=x.roundPts.length?x.pf/x.roundPts.length:0;});
  return(id)=>m[id]||0;
}
async function startSessionAction(){const l=gL();const ss=gSS();if(!l||!ss)return;const parts=gParts(ss,l);if(parts.length<4)return alert('Need at least 4 participants. Go to the Roster tab to select players.');const strength=_buildStrengthFn(l);ss.rounds=[genR1(parts,ss.config.courts,strength)];ss.currentRound=0;ss.started=true;ss.liveStarted=false;tab='play';mapOpen=true;await save(l)}
async function finishLadderEarly(){const l=gL();const ss=gSS();if(!l||!ss)return;if(!confirm('End this ladder now?'))return;ss.finished=true;tab='stats';await save(l)}
async function beginRound(){const l=gL();const ss=gSS();if(!l||!ss)return;ss.liveStarted=true;resetTimer(ss);await save(l)}
async function restartLadder(){const l=gL();const ss=gSS();if(!l||!ss)return;if(!confirm('Restart this ladder? All rounds and scores will be cleared.'))return;ss.rounds=[];ss.currentRound=-1;ss.started=false;delete ss.liveStarted;ss.finished=false;viewingRound=-1;npState=null;tab='play';await save(l)}
async function nextRound(){const l=gL();const ss=gSS();if(!l||!ss)return;const curRound=ss.rounds[ss.currentRound];if(curRound.wave2started===false)return alert('Wave 2 has not been started yet. Start Wave 2 before advancing to the next round.');const tied=curRound.courts.filter(c=>c.score&&c.score.t1!==null&&c.score.t2!==null&&!c.score.winner);if(tied.length)return alert(tied.length+' court(s) have tied scores with no winner selected. Tap each tied court and press "Moves Up" for the winning team.');const un=curRound.courts.filter(c=>!c.score);if(un.length&&!confirm(un.length+' court(s) unscored. Continue?'))return;if(ss.currentRound>=ss.config.rounds-1){ss.finished=true;tab='stats';await save(l);return}const strength=_buildStrengthFn(l);ss.rounds.push(genNR(curRound,ss.config.courts,strength));ss.currentRound++;viewingRound=-1;npState=null;resetTimer(ss);await save(l)}
async function reshuffleRound(){const l=gL();const ss=gSS();if(!l||!ss||!confirm('Reshuffle? Scores cleared.'))return;const all=[];ss.rounds[ss.currentRound].courts.forEach(c=>[...c.team1,...c.team2].filter(Boolean).forEach(p=>all.push(p)));const strength=_buildStrengthFn(l);ss.rounds[ss.currentRound]=genR1(all,ss.config.courts,strength);npState=null;await save(l)}
async function startWave2(){const l=gL();const ss=gSS();if(!l||!ss)return;const round=ss.rounds[ss.currentRound];if(!round||round.wave2started!==false)return;round.wave2started=true;await save(l)}
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
// Edit handlers for ladder config that should remain editable AFTER the
// ladder has started or finished. Court count is intentionally NOT editable
// once started (changing it would invalidate the round assignments).
async function editSessionCourtNames(){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const cur=ss.config.courtNames||defaultCourtNames(ss.config.courts);
  const input=prompt(
    'Court names, top to bottom (comma-separated).\nChange the count to add/remove courts — only affects future rounds.',
    cur.join(', ')
  );
  if(input===null)return;
  const names=input.split(',').map(s=>s.trim()).filter(Boolean);
  if(names.length<2){alert('Need at least 2 courts.');return;}
  if(ss.started&&names.length<ss.config.courts){
    if(!confirm('Reducing from '+ss.config.courts+' to '+names.length+' courts. Past rounds are unaffected; future rounds will use '+names.length+'. Continue?'))return;
  }
  ss.config.courts=names.length;
  ss.config.courtNames=names;
  await save(l);
}
async function editSessionRounds(){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const input=prompt('Total rounds (1-20):',String(ss.config.rounds));
  if(input===null)return;
  const n=parseInt(input);
  if(!n||n<1||n>20){alert('Enter a number from 1 to 20.');return;}
  const played=Array.isArray(ss.rounds)?ss.rounds.length:0;
  if(n<played){
    if(!confirm('You’ve already played '+played+' round'+(played!==1?'s':'')+'. Lowering total rounds to '+n+' won’t delete those, but the ladder will end after round '+n+' next time. Continue?'))return;
  }
  ss.config.rounds=n;
  await save(l);
}
async function editSessionRoundTime(){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const input=prompt('Round time in minutes (1-30):',String(ss.config.roundMin));
  if(input===null)return;
  const n=parseInt(input);
  if(!n||n<1||n>30){alert('Enter a number from 1 to 30.');return;}
  ss.config.roundMin=n;
  await save(l);
}
async function editSessionScoring(){
  const l=gL();const ss=gSS();if(!l||!ss)return;
  const cur=ss.config.scoreMode==='points'?'Points':'Win / Loss';
  const next=ss.config.scoreMode==='points'?'winloss':'points';
  const nextLabel=next==='points'?'Points':'Win / Loss';
  if(!confirm('Change scoring from '+cur+' to '+nextLabel+'? Already-entered scores stay as they are.'))return;
  ss.config.scoreMode=next;
  await save(l);
}
async function archiveSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s||!confirm('Archive "'+s.name+'"?'))return;s.archived=true;if(l.activeSeason===sid){const a=l.seasons.find(x=>!x.archived);l.activeSeason=a?.id||null}await save(l)}
async function unarchiveSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s)return;s.archived=false;l.activeSeason=sid;await save(l)}
async function deleteSeason(sid){const l=gL();if(!l)return;const s=l.seasons.find(x=>x.id===sid);if(!s||!confirm('Delete "'+s.name+'" permanently?'))return;l.seasons=l.seasons.filter(x=>x.id!==sid);if(l.activeSeason===sid)l.activeSeason=l.seasons[0]?.id||null;await save(l)}
async function archiveSession(ssid){const l=gL();const s=gS();if(!l||!s)return;const ss=s.sessions.find(x=>x.id===ssid);if(!ss||!confirm('Archive "'+(ss.name||fmtDate(ss.date))+'"?'))return;ss.archived=true;if(activeSessionId===ssid)activeSessionId=null;await save(l)}
async function unarchiveSession(ssid){const l=gL();const s=gS();if(!l||!s)return;const ss=s.sessions.find(x=>x.id===ssid);if(!ss)return;ss.archived=false;await save(l)}
async function deleteSession(ssid){const l=gL();const s=gS();if(!l||!s)return;const ss=s.sessions.find(x=>x.id===ssid);if(!ss||!confirm('Delete permanently?'))return;s.sessions=s.sessions.filter(x=>x.id!==ssid);if(activeSessionId===ssid)activeSessionId=null;await save(l)}
async function cloneSession(ssid){
  const l=gL();const s=gS();if(!l||!s)return;
  const src=s.sessions.find(x=>x.id===ssid);if(!src)return;
  const today=new Date().toISOString().split('T')[0];
  const cloned={
    id:uid(),
    name:src.name?(src.name+' (Copy)'):'',
    date:today,
    config:{...src.config,courtNames:[...(src.config.courtNames||[])]},
    participants:[...(src.participants||l.players.filter(p=>p.active!==false).map(p=>p.id))],
    rounds:[],currentRound:-1,started:false,finished:false,createdAt:Date.now()
  };
  s.sessions.push(cloned);
  await save(l);
  activeSessionId=cloned.id;view='session';tab='play';render();
}

function go(v,t){view=v;if(t)tab=t;viewingRound=-1;swapMode=null;npState=null;if(v==='newSession')formCourtCount=4;render();if(v==='newSession')setTimeout(updateCourtInputs,10)}
function selectLadder(id){activeLadderId=id;activeSessionId=null;view='dashboard';tab='overview';viewingRound=-1;render()}
// League tab ordering. Sort by an explicit `order` field, falling back to
// createdAt so leagues saved before this feature keep a stable position.
function orderedLadders(){return[...ladders].sort((a,b)=>(a.order??a.createdAt??0)-(b.order??b.createdAt??0))}
// Move a league one slot left (dir=-1) or right (dir=1) in the tab bar.
// Renumbers every league sequentially, swaps the adjacent pair, and persists
// only the leagues whose order actually changed.
async function moveLadder(id,dir){
  const arr=orderedLadders();
  const i=arr.findIndex(x=>x.id===id);const j=i+dir;
  if(i<0||j<0||j>=arr.length)return;
  const old=arr.map(l=>l.order);
  arr.forEach((l,k)=>l.order=k);
  const t=arr[i].order;arr[i].order=arr[j].order;arr[j].order=t;
  const changed=arr.filter((l,k)=>l.order!==old[k]);
  for(const l of changed){await apiSave(l)}
  render();
}
// Home: the cross-league landing hub showing upcoming ladders.
function goHome(){view='home';activeSessionId=null;viewingRound=-1;swapMode=null;npState=null;render()}
// Open a ladder from the home page. The session may live in a league/season
// that isn't currently active, so set the active league and point its
// activeSeason at the season holding this session before opening it — that's
// what gS()/gSS() resolve against. activeSeason is set in memory only (not
// persisted) since it's just navigation state for this client.
function openHomeLadder(lid,sid,ssid){
  activeLadderId=lid;
  const l=gL();
  if(l&&l.seasons?.some(x=>x.id===sid))l.activeSeason=sid;
  openSession(ssid);
}
function openSession(id){activeSessionId=id;view='session';viewingRound=-1;swapMode=null;npState=null;const ss=gSS();const finished=ss?.finished;tab=isAdmin?'play':'info';if(finished&&!isAdmin)pvTab='now';mapOpen=ss?shouldMapOpen(ss)||ss.started:false;render()}
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
  const physCourts=ss.config.courts;
  const tC=(ss.rounds&&vr>=0?ss.rounds[vr]?.totalCourts:null)||physCourts;
  const nC=tC;
  const isLight=theme==='hc-light';
  const sc=ct.score;
  const h1=sc&&sc.t1!==null&&sc.t1!==undefined;
  const h2=sc&&sc.t2!==null&&sc.t2!==undefined;
  const hb=h1&&h2;
  const w=hb?sc.winner:null;
  const nm=cName(ct.court,ss,tC);
  const isTop=ct.court===tC;
  const isBot=ct.court===1;
  const isKitchen=isTop;

  const _dk={[nC]:{col:'#ffcc00',dim:'rgba(255,204,0,0.18)',bd:'rgba(255,204,0,0.35)',stripe:'#1c1400,#1c1400 5px,#140f00 5px,#140f00 10px',bg:'#0a0800'},
             [nC-1]:{col:'#00e5ff',dim:'rgba(0,229,255,0.15)',bd:'rgba(0,229,255,0.3)',stripe:'#001618,#001618 5px,#000e10 5px,#000e10 10px',bg:'#000c10'},
             [nC-2]:{col:'#3b82f6',dim:'rgba(59,130,246,0.12)',bd:'rgba(59,130,246,0.25)',stripe:'#000a20,#000a20 5px,#000718 5px,#000718 10px',bg:'#00081a'}};
  const _lt={[nC]:{col:'#000',dim:'rgba(0,0,0,0.06)',bd:'rgba(0,0,0,0.5)',stripe:'#fff,#fff',bg:'#fff'},
             [nC-1]:{col:'#000',dim:'rgba(0,0,0,0.06)',bd:'rgba(0,0,0,0.5)',stripe:'#fff,#fff',bg:'#fff'},
             [nC-2]:{col:'#000',dim:'rgba(0,0,0,0.06)',bd:'rgba(0,0,0,0.5)',stripe:'#fff,#fff',bg:'#fff'}};
  const acc=(isLight?_lt:_dk)[ct.court]||(isLight?{col:'#000',dim:'rgba(0,0,0,0.06)',bd:'rgba(0,0,0,0.5)',stripe:'#fff,#fff',bg:'#fff'}:{col:'#a78bfa',dim:'rgba(167,139,250,0.12)',bd:'rgba(167,139,250,0.3)',stripe:'#0e0a1a,#0e0a1a 5px,#080612 5px,#080612 10px',bg:'#0a0814'});

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
    if(isTop){wMove='Stay &amp; split';wArrow='&#x21D5;';lMove='&#8595; '+cName(Math.max(1,ct.court-1),ss,tC);lArrow='&#8595;'}
    else if(isBot){wMove='&#8593; '+cName(Math.min(tC,ct.court+1),ss,tC);wArrow='&#8593;';lMove='Stay &amp; split';lArrow='&#x21D5;'}
    else{wMove='&#8593; '+cName(Math.min(tC,ct.court+1),ss,tC);wArrow='&#8593;';lMove='&#8595; '+cName(Math.max(1,ct.court-1),ss,tC);lArrow='&#8595;'}}
  let footWin='',footLose='';
  if(!hb||!w){
    if(isTop){footWin='Winners &#x21D5; stay &amp; split';footLose='Losers &#8595; '+cName(Math.max(1,ct.court-1),ss,tC)}
    else if(isBot){footWin='Winners &#8593; '+cName(Math.min(tC,ct.court+1),ss,tC);footLose='Losers &#x21D5; stay &amp; split'}
    else{footWin='Winners &#8593; '+cName(Math.min(tC,ct.court+1),ss,tC);footLose='Losers &#8595; '+cName(Math.max(1,ct.court-1),ss,tC)}}

  const winGlow=isKitchen?'rgba(255,204,0,0.75)':'rgba(200,255,0,0.65)';
  const winGlowSoft=isKitchen?'rgba(255,204,0,0.28)':'rgba(200,255,0,0.22)';
  const winScoreCol=isLight?'#000':(isKitchen?'#ffcc00':'#c8ff00');

  let h='<div class="fu" style="border:'+(isLight?'1.5px solid #000':'1px solid '+acc.bd)+';border-radius:14px;overflow:hidden;margin-bottom:10px">';

  // ── Jersey header ──
  h+='<div style="background:'+(isLight?'#fff':'repeating-linear-gradient(45deg,'+acc.stripe+')')+';border-bottom:'+(isLight?'3px solid #000':'2px solid '+acc.col)+';padding:7px 12px;display:flex;align-items:center;justify-content:space-between">';
  h+='<div style="display:flex;align-items:center;gap:8px">';
  if(isKitchen){h+='<div style="width:28px;height:28px;border-radius:50%;background:'+(isLight?'#000':acc.col)+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:'+(isLight?'#fff':'#000')+';flex-shrink:0">'+nm+'</div>';}
  else{h+='<div style="width:28px;height:28px;border-radius:50%;background:'+(isLight?'#fff':acc.dim)+';border:2px solid '+(isLight?'#000':acc.col)+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:'+(isLight?'#000':acc.col)+';flex-shrink:0">'+nm+'</div>';}
  h+='<div>';
  if(isKitchen){h+='<div style="font-size:10px;font-weight:900;color:'+(isLight?'#000':acc.col)+';letter-spacing:.07em;text-transform:uppercase">&#128081; Owns the Kitchen</div><div style="font-size:7px;color:'+(isLight?'rgba(0,0,0,0.45)':'rgba(255,204,0,0.45)')+';margin-top:1px">Top court &#183; Winners stay &amp; split</div>';}
  else{h+='<div style="font-size:10px;font-weight:900;color:'+(isLight?'#000':acc.col)+';letter-spacing:.07em;text-transform:uppercase">Court '+nm+'</div>';}
  h+='</div></div>';
  if(hb&&w){h+='<span style="font-size:12px;font-weight:900;color:'+(isLight?'#000':acc.col)+';letter-spacing:.02em">'+sc.t1+' &#8211; '+sc.t2+'</span>';}
  else{h+='<span style="font-size:7px;font-weight:800;color:'+(isLight?'rgba(0,0,0,0.3)':'#555')+';text-transform:uppercase;letter-spacing:.08em">'+(adminMode?'Tap to score':'Not scored')+'</span>';}
  h+='</div>';

  // ── Split panels ──
  // Team A always stays on the LEFT, team B on the RIGHT — regardless of who
  // won. The winner gets visual emphasis (green bg, glowing score, "Winner"
  // label) in place; the loser stays on its side with dimmed styling.
  if(hb&&w){
    h+='<div style="display:grid;grid-template-columns:1fr 1fr">';
    // Render one team panel — `side` is 'A' or 'B'
    const renderTeamPanel=(side,isRight)=>{
      const team=side==='A'?ct.team1:ct.team2;
      const teamScore=side==='A'?sc?.t1:sc?.t2;
      const fld=side==='A'?'t1':'t2';
      const ti=side==='A'?0:1;
      const isWinner=w===side;
      // Visual treatment
      const panelBg=isWinner?(isLight?'#fff':(isKitchen?'#1a1000':'#0d1f00')):(isLight?'#f0f0f0':'#1a0000');
      const labelText=isWinner?'Winner':'Loser';
      const labelCol=isWinner?(isLight?'#000':winScoreCol):(isLight?'rgba(0,0,0,0.5)':'rgba(255,92,71,0.7)');
      const scoreStyle=isWinner
        ?'font-size:var(--cc-score,44px);font-weight:900;color:'+(isLight?'#000':winScoreCol)+';line-height:1;letter-spacing:-.03em'+(isLight?'':';text-shadow:0 0 18px '+winGlow+',0 0 36px '+winGlowSoft)
        :'font-size:var(--cc-score,44px);font-weight:900;color:'+(isLight?'rgba(0,0,0,0.3)':'rgba(255,92,71,0.3)')+';line-height:1;letter-spacing:-.03em';
      const moveStyle=isWinner
        ?(isLight?'background:#000;color:#fff':'background:'+winScoreCol+';color:#000')
        :(isLight?'background:#e0e0e0;color:rgba(0,0,0,0.65);border:1px solid rgba(0,0,0,0.3)':'background:rgba(255,92,71,0.15);color:rgba(255,92,71,0.7);border:1px solid rgba(255,92,71,0.25)');
      const moveText=isWinner?wMove:lMove;
      const nameDimColor=isWinner?(isLight?'#000':'#f4f4f0'):(isLight?'rgba(0,0,0,0.35)':'rgba(255,255,255,0.35)');
      const borderL=isRight?';border-left:1px solid '+(isLight?'rgba(0,0,0,0.15)':'rgba(255,92,71,0.08)')+'':'';
      let p='<div style="background:'+panelBg+';padding:10px 12px;text-align:center'+borderL+'">';
      p+='<div style="font-size:7px;font-weight:900;color:'+labelCol+';text-transform:uppercase;letter-spacing:.14em;margin-bottom:5px">'+labelText+'</div>';
      // Show "—" for empty slots in the public name string so the position
      // is visible (e.g. "Rich + —"). Avoids losing the slot count.
      const nameStr=team.map(pl=>pl?pl.name:'—').join(' + ');
      if(adminMode){
        team.forEach((pl,pi)=>{
          // Empty slot — render a dashed "Fill slot" placeholder chip so the
          // admin can put someone in later via the same Sub modal.
          if(!pl){
            p+='<div style="background:rgba(255,204,0,0.04);border:1.5px dashed rgba(255,204,0,0.35);border-radius:10px;padding:8px 10px;margin-bottom:6px">';
            p+='<div style="font-size:11px;font-weight:600;color:rgba(255,204,0,0.7);text-align:center;margin-bottom:6px;letter-spacing:.04em">Empty slot</div>';
            p+='<button onclick="event.stopPropagation();openSubModal('+vr+','+ci+','+ti+','+pi+')" style="width:100%;background:rgba(255,204,0,0.12);border:1px solid rgba(255,204,0,0.35);color:#ffcc00;font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Choose Player</button>';
            p+='</div>';
            return;
          }
          const isSrc=swapMode&&swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===ti&&swapMode.pi===pi;
          const isTarget=swapMode&&!(swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===ti&&swapMode.pi===pi);
          const bg=isSrc?'rgba(255,204,0,0.08)':isTarget?'rgba(0,229,255,0.08)':(isWinner?(isLight?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.05)'):(isLight?'rgba(0,0,0,0.03)':'rgba(255,255,255,0.04)'));
          const border=isSrc?'1.5px dashed rgba(255,204,0,0.4)':isTarget?'1.5px solid rgba(0,229,255,0.35)':(isWinner?(isLight?'1.5px solid rgba(0,0,0,0.1)':'1.5px solid rgba(255,255,255,0.08)'):(isLight?'1.5px solid rgba(0,0,0,0.08)':'1.5px solid rgba(255,255,255,0.06)'));
          const col=isSrc?'#ffcc00':isTarget?'#00e5ff':(isWinner?(isLight?'#111':'#f4f4f0'):(isLight?'rgba(0,0,0,0.55)':'rgba(255,255,255,0.55)'));
          p+='<div style="background:'+bg+';border:'+border+';border-radius:10px;padding:8px 10px;margin-bottom:6px'+(isSrc?';opacity:.7':'')+'">';
          p+='<div style="font-size:var(--cc-pname,14px);font-weight:700;color:'+col+';text-align:center;margin-bottom:6px;line-height:1.2'+(isSrc?';text-decoration:line-through':'')+'">'+pl.name+'</div>';
          if(isSrc){
            p+='<div style="text-align:center;font-size:9px;color:#ffcc00;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Moving — pick another</div>';
          } else if(isTarget){
            p+='<button onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+ti+','+pi+')" style="width:100%;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.4);color:#00e5ff;font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Swap here</button>';
          } else {
            p+='<div style="display:flex;gap:4px">';
            p+='<button onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+ti+','+pi+')" style="flex:1;background:'+(isLight?'#fff':'rgba(0,229,255,0.1)')+';border:1px solid '+(isLight?'#000':'rgba(0,229,255,0.3)')+';color:'+(isLight?'#000':'#00e5ff')+';font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Move</button>';
            p+='<button onclick="event.stopPropagation();openSubModal('+vr+','+ci+','+ti+','+pi+')" style="flex:1;background:'+(isLight?'#fff':'rgba(255,92,71,0.1)')+';border:1px solid '+(isLight?'#000':'rgba(255,92,71,0.3)')+';color:'+(isLight?'#000':'#ff5c47')+';font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Sub</button>';
            p+='</div>';
          }
          p+='</div>';
        });
      } else {
        p+='<div style="font-size:var(--cc-pname,15px);font-weight:700;color:'+nameDimColor+';margin-bottom:6px;line-height:1.35">'+nameStr+'</div>';
      }
      // Tappable score for admin to fix miskeys
      const scClk=adminMode?' onclick="event.stopPropagation();openNumpad('+vr+','+ci+',\''+fld+'\')" style="cursor:pointer;'+scoreStyle+'"':' style="'+scoreStyle+'"';
      p+='<div'+scClk+'>'+teamScore+'</div>';
      p+='<div style="display:inline-flex;align-items:center;gap:3px;margin-top:6px;font-size:8px;font-weight:900;'+moveStyle+';padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:.06em">'+moveText+'</div>';
      p+='</div>';
      return p;
    };
    h+=renderTeamPanel('A',false);
    h+=renderTeamPanel('B',true);
    h+='</div>';
    // Footer
    h+='<div style="padding:5px 12px;font-size:7px;font-weight:700;color:'+(isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.28)')+';background:'+(isLight?'#f0f0f0':acc.bg)+';border-top:1px solid '+(isLight?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.04)')+';letter-spacing:.03em">';
    h+=wNamesShort+' '+wMove.replace(/&#8593;/g,'↑').replace(/&#8595;/g,'↓').replace(/&#x21D5;/g,'↕').replace(/&amp;/g,'&').toLowerCase()+' &#183; '+lNamesShort+' '+lMove.replace(/&#8593;/g,'↑').replace(/&#8595;/g,'↓').replace(/&#x21D5;/g,'↕').replace(/&amp;/g,'&').toLowerCase();
    h+='</div>';
  } else {
    // Unscored panels
    const mkPanel=(team,side,isRight)=>{
      const fld=side==='A'?'t1':'t2';const ti=side==='A'?0:1;
      const _ubg=isLight?'#fff':acc.bg;
      const _ubl=isRight?(isLight?';border-left:1px solid rgba(0,0,0,0.12)':';border-left:1px solid rgba(255,255,255,0.04)'):'';      const onclk=adminMode?` onclick="openNumpad(${vr},${ci},'${fld}')" style="cursor:pointer;text-align:center;background:${_ubg};padding:10px 12px${_ubl}"`:` style="text-align:center;background:${_ubg};padding:10px 12px${_ubl}"`;      let p='<div '+onclk+'>';
      p+='<div style="font-size:7px;font-weight:900;color:'+(isLight?'#000':acc.col)+';opacity:'+(isLight?'1':'.65')+';text-transform:uppercase;letter-spacing:.14em;margin-bottom:5px">Team '+side+'</div>';
      if(adminMode){team.forEach((pl,pi)=>{
          // Empty slot — Choose Player placeholder
          if(!pl){
            p+='<div style="background:rgba(255,204,0,0.04);border:1.5px dashed rgba(255,204,0,0.35);border-radius:10px;padding:8px 10px;margin-bottom:6px">';
            p+='<div style="font-size:11px;font-weight:600;color:rgba(255,204,0,0.7);text-align:center;margin-bottom:6px;letter-spacing:.04em">Empty slot</div>';
            p+='<button onclick="event.stopPropagation();openSubModal('+vr+','+ci+','+ti+','+pi+')" style="width:100%;background:rgba(255,204,0,0.12);border:1px solid rgba(255,204,0,0.35);color:#ffcc00;font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Choose Player</button>';
            p+='</div>';
            return;
          }
          const isSrc=swapMode&&swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===ti&&swapMode.pi===pi;
          const isTarget=swapMode&&!(swapMode.ri===vr&&swapMode.ci===ci&&swapMode.ti===ti&&swapMode.pi===pi);
          const bg2=isSrc?'rgba(255,204,0,0.08)':isTarget?'rgba(0,229,255,0.08)':(isLight?'rgba(0,0,0,0.04)':'rgba(255,255,255,0.04)');
          const bd2=isSrc?'1.5px dashed rgba(255,204,0,0.4)':isTarget?'1.5px solid rgba(0,229,255,0.35)':(isLight?'1.5px solid rgba(0,0,0,0.09)':'1.5px solid rgba(255,255,255,0.07)');
          const cl2=isSrc?'#ffcc00':isTarget?'#00e5ff':(isLight?'rgba(0,0,0,0.75)':'rgba(255,255,255,0.7)');
          p+='<div style="background:'+bg2+';border:'+bd2+';border-radius:10px;padding:8px 10px;margin-bottom:6px'+(isSrc?';opacity:.7':'')+'">';
          p+='<div style="font-size:var(--cc-pname,14px);font-weight:700;color:'+cl2+';text-align:center;margin-bottom:6px;line-height:1.2'+(isSrc?';text-decoration:line-through':'')+'">'+pl.name+'</div>';
          if(isSrc){
            p+='<div style="text-align:center;font-size:9px;color:#ffcc00;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Moving — pick another</div>';
          } else if(isTarget){
            p+='<button onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+ti+','+pi+')" style="width:100%;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.4);color:#00e5ff;font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Swap here</button>';
          } else {
            p+='<div style="display:flex;gap:4px">';
            p+='<button onclick="event.stopPropagation();beginSwap('+vr+','+ci+','+ti+','+pi+')" style="flex:1;background:'+(isLight?'#fff':'rgba(0,229,255,0.1)')+';border:1px solid '+(isLight?'#000':'rgba(0,229,255,0.3)')+';color:'+(isLight?'#000':'#00e5ff')+';font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Move</button>';
            p+='<button onclick="event.stopPropagation();openSubModal('+vr+','+ci+','+ti+','+pi+')" style="flex:1;background:'+(isLight?'#fff':'rgba(255,92,71,0.1)')+';border:1px solid '+(isLight?'#000':'rgba(255,92,71,0.3)')+';color:'+(isLight?'#000':'#ff5c47')+';font-size:10px;font-weight:700;padding:5px 0;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.05em">Sub</button>';
            p+='</div>';
          }
          p+='</div>'})}
      else{const nameStr=team.map(pl=>pl?pl.name:'—').join(' + ')||'TBD';p+='<div style="font-size:var(--cc-pname,15px);font-weight:700;color:'+(isLight?'#000':'rgba(255,255,255,0.6)')+';margin-bottom:6px;line-height:1.35">'+nameStr+'</div>';}
      p+='<div style="font-size:var(--cc-score,40px);font-weight:900;line-height:1;color:'+(isLight?'#000':acc.col)+';opacity:.08;letter-spacing:-.03em">--</div>';
      if(adminMode)p+='<div style="font-size:7px;color:'+(isLight?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.18)')+';margin-top:6px">Tap to score</div>';
      p+='</div>';return p};
    h+='<div style="display:grid;grid-template-columns:1fr 1fr">';
    h+=mkPanel(ct.team1,'A',false);
    h+=mkPanel(ct.team2,'B',true);
    h+='</div>';
    h+='<div style="padding:5px 12px;font-size:7px;font-weight:700;color:'+(isLight?'rgba(0,0,0,0.5)':'#555')+';background:'+(isLight?'#f0f0f0':acc.bg)+';border-top:1px solid '+(isLight?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.04)')+'">'+footWin+' &#183; '+footLose+'</div>';
  }

  // numpad rendered as centered overlay in render()

  // ── Win/Loss mode ──
  if(adminMode&&ss.config.scoreMode==='winloss'){
    h+='<div style="display:flex;gap:8px;padding:8px 12px 10px">';
    h+='<button class="wlb'+(w==='A'?' aa':'')+'" onclick="setWLRound('+vr+','+ci+',\'A\')">'+(w==='A'?'\u2713 Winner \u2014 ':'')+'Team A</button>';
    h+='<button class="wlb'+(w==='B'?' ab':'')+'" onclick="setWLRound('+vr+','+ci+',\'B\')">'+(w==='B'?'\u2713 Winner \u2014 ':'')+'Team B</button>';
    h+='</div>'}

  // ── Tie warning ──
  if(adminMode&&hb&&!w)h+='<div class="th" style="padding:6px 12px 8px">Scores tied \u2014 tap score to pick who advances</div>';

  h+='</div>';return h}

// ═══════════════════════════════════════════════════
// PLAYER VIEW — Now Playing/Up Next (active) or Round History/Final Stats (completed)
// ═══════════════════════════════════════════════════
function rPlayerView(l,ss){
  const isLight=theme==='hc-light';
  const physCourts=ss.config.courts;
  const isCurrent=viewingRound===-1||viewingRound===ss.currentRound;
  const vr=isCurrent?ss.currentRound:viewingRound;
  const round=ss.rounds[vr];
  if(!round)return'';
  const tCpv=round.totalCourts||round.courts.length;
  const hasWavesPv=tCpv>physCourts&&round.wave2started!==undefined;
  let h='';

  // ── COMPLETED LADDER ──
  if(ss.finished){
    h+='<div class="round-pills" style="padding:8px 12px 0">';
    for(let ri=0;ri<=ss.currentRound;ri++){
      const isV=(!isCurrent&&ri===vr)||(isCurrent&&ri===ss.currentRound);
      const rndI=ss.rounds[ri];
      const done=rndI&&rndI.courts.every(c=>c.score&&c.score.winner)&&rndI.wave2started!==false;
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
      const rndI=ss.rounds[ri];
      const done=rndI&&rndI.courts.every(c=>c.score&&c.score.winner)&&rndI.wave2started!==false;
      h+='<button class="rd-pill'+(isV?' active':'')+'" onclick="viewRound('+(ri===ss.currentRound?-1:ri)+')">Rd '+(ri+1)+(done?' ✓':'')+'</button>'}
    h+='</div>'}
  const isPreviewPv=ss.started&&ss.liveStarted===false;
  if(!isPreviewPv){
    const timerPct=(timer/(ss.config.roundMin*60))*100;
    const timerColor=timer<=60?'#ff5c47':timer<=180?'#ffcc00':'#c8ff00';
    h+='<div style="background:var(--surf2);border-bottom:1px solid var(--border);padding:8px 14px;display:flex;align-items:center;gap:12px">';
    h+='<div><div style="font-family:\'Sora\',sans-serif;font-size:22px;font-weight:900;color:var(--lime);font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1">'+fmtT(timer)+'</div>';
    h+='<div style="font-size:.65rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.07em;margin-top:2px">On clock</div></div>';
    h+='<div style="flex:1"><div style="height:4px;background:var(--surf4);border-radius:2px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:'+timerPct+'%;background:'+timerColor+';border-radius:2px;transition:width 1s linear"></div></div>';
    h+='<div style="font-size:.78rem;color:var(--muted)">Finish rally when timer hits zero</div></div></div>';
  }else{
    h+='<div style="background:var(--surf2);border-bottom:1px solid var(--border);padding:10px 14px;display:flex;align-items:center;gap:10px">';
    h+='<div style="width:32px;height:32px;border-radius:50%;background:'+(isLight?'rgba(255,204,0,0.2)':'rgba(255,204,0,0.15)')+';display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">📋</div>';
    h+='<div><div style="font-size:.78rem;font-weight:900;color:'+(isLight?'#7a5800':'#ffcc00')+';text-transform:uppercase;letter-spacing:.07em">Lineup posted</div>';
    h+='<div style="font-size:.72rem;color:var(--muted);margin-top:1px">Check your court below — waiting for admin to start</div></div></div>';
  }
  h+='<div class="pv-tabs">';
  h+='<button class="pv-tab'+(pvTab==='now'?' on':'')+'" onclick="setPvTab(\'now\')">Now Playing</button>';
  h+='<button class="pv-tab'+(pvTab==='next'?' on':'')+'" onclick="setPvTab(\'next\')">Up Next</button>';
  h+='</div>';
  // Now Playing
  h+='<div class="pv-panel'+(pvTab==='now'?' active':'')+'" id="pv-now">';
  if(!hasWavesPv){
    h+='<div class="pv-sec-label">Round '+(vr+1)+' — all courts</div>';
    h+='<div class="court-grid">';
    [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,false)});
    h+='</div>';
  }else{
    const w1pv=round.courts.filter(c=>c.court>tCpv-physCourts).sort((a,b)=>b.court-a.court);
    const w2pv=round.courts.filter(c=>c.court<=tCpv-physCourts).sort((a,b)=>b.court-a.court);
    h+='<div class="pv-sec-label">Round '+(vr+1)+' \u2014 Wave 1 (Higher seeds)</div>';
    h+='<div class="court-grid">';
    w1pv.forEach(ct=>{h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,false)});
    h+='</div>';
    if(round.wave2started===false){
      h+='<div style="margin:14px 0 6px;padding:14px 16px;background:rgba(167,139,250,0.07);border:1.5px dashed rgba(167,139,250,0.25);border-radius:12px">';
      h+='<div style="font-size:9px;font-weight:900;color:'+(isLight?'#5a3ea0':'#a78bfa')+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">\u23F3 Wave 2 \u2014 Waiting to play</div>';
      h+='<div style="font-size:12px;color:'+(isLight?'rgba(0,0,0,0.6)':'rgba(255,255,255,0.5)')+';margin-bottom:8px">Lower seeds play once Wave 1 completes</div>';
      h+='<div>';
      w2pv.forEach(ct=>{
        const nm=cName(ct.court,ss,tCpv);
        h+='<div style="padding:6px 0;border-top:1px solid '+(isLight?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.06)')+';font-size:12px;color:'+(isLight?'rgba(0,0,0,0.65)':'rgba(255,255,255,0.55)')+'">';
        h+='Court '+nm+': '+ct.team1.filter(Boolean).map(p=>p.name).join(' &amp; ')+' <span style="opacity:.5">vs</span> '+ct.team2.filter(Boolean).map(p=>p.name).join(' &amp; ');
        h+='</div>';
      });
      h+='</div></div>';
    }else{
      h+='<div class="pv-sec-label" style="margin-top:14px">Wave 2 \u2014 Lower seeds</div>';
      h+='<div class="court-grid">';
      w2pv.forEach(ct=>{h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,false)});
      h+='</div>';
    }
  }
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
    const wave2Pending=round.wave2started===false;
    if(!allScored||wave2Pending){h+='<div class="upnext-banner"><div class="upnext-banner-icon">⏳</div><div><div class="upnext-banner-top">Waiting on scores</div><div class="upnext-banner-bot">'+(wave2Pending?'Wave 2 must complete first':'Lineups lock in once all courts are scored')+'</div></div></div>'}
    [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      const sc=ct.score;const w=sc?.winner;const nm=cName(ct.court,ss,tCpv);
      const isTop=ct.court===tCpv;const isBot=ct.court===1;
      const ltrCls=ct.court===tCpv?'cc-ltr-gold':ct.court===tCpv-1?'cc-ltr-cyan':ct.court===tCpv-2?'cc-ltr-blue':'cc-ltr-gray';
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
      else{const fromNm=cName(Math.min(tCpv,ct.court+1),ss,tCpv);const fromCls=ct.court+1===tCpv?'cc-ltr-gold':ct.court+1===tCpv-1?'cc-ltr-cyan':'cc-ltr-blue';
        h+='<div class="next-from"><div class="cc-ltr '+fromCls+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+fromNm+'</div><span class="next-from-txt">Winners of '+fromNm+'</span></div><div class="next-name tbd">Pending...</div>'}
      h+='</div><div class="next-vs">VS</div><div class="next-team-col">';
      if(isBot){
        h+='<div class="next-from"><div class="cc-ltr '+ltrCls+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+nm+'</div><span class="next-from-txt">Losers split</span></div>';
        if(w){(w==='A'?ct.team2:ct.team1).filter(Boolean).forEach(p=>h+='<div class="next-name">'+p.name+'</div>')}
        else h+='<div class="next-name tbd">Pending...</div>'}
      else{const fromNm2=cName(Math.max(1,ct.court-1),ss,tCpv);const fromCls2=ct.court-1===0?'cc-ltr-gray':ct.court-1===tCpv-2?'cc-ltr-blue':'cc-ltr-cyan';
        h+='<div class="next-from"><div class="cc-ltr '+fromCls2+'" style="width:20px;height:20px;border-radius:4px;font-size:10px">'+fromNm2+'</div><span class="next-from-txt">Losers of '+fromNm2+'</span></div><div class="next-name tbd">Pending...</div>'}
      h+='</div></div></div>'});}
  h+='</div>';
  return h}

// ═══════════════════════════════════════════════════
// ADMIN PLAY VIEW
// ═══════════════════════════════════════════════════
function rPlay(l,ss){
  const isLight=theme==='hc-light';
  const physCourts=ss.config.courts;const parts=gParts(ss,l);
  if(!ss.started)return'<div class="card fu" style="text-align:center;padding:28px"><h3 class="heading" style="font-size:1.05rem;color:var(--lime);margin-bottom:6px">'+(ss.name||'Ladder')+'</h3><p class="subtext" style="margin-bottom:2px">'+fmtDate(ss.date)+(ss.config.startTime?' · '+fmt12(ss.config.startTime):'')+'</p><p class="subtext" style="margin-bottom:14px">'+parts.length+' players · '+physCourts+' courts · '+ss.config.rounds+' rounds</p>'+(isAdmin?(parts.length>=4?'<button class="bp full" style="padding:14px;font-size:.92rem" onclick="startSessionAction()">Generate lineups</button>':'<p style="color:var(--warn);font-size:.82rem">Need at least 4 participants. Go to Roster tab to select players.</p>'):'<p class="subtext">Lineups will appear when the ladder starts.</p>')+'</div>';
  const isCurrent=viewingRound===-1||viewingRound===ss.currentRound,vr=isCurrent?ss.currentRound:viewingRound;
  const round=ss.rounds[vr];if(!round)return'';
  const tC=round.totalCourts||round.courts.length;
  const hasWaves=tC>physCourts&&round.wave2started!==undefined;
  const isPreview=ss.started&&ss.liveStarted===false;
  let h='';

  // Sticky timer
  if(isCurrent&&ss.started&&!ss.finished&&!isPreview){
    h+='<div class="sticky-timer" id="stickyTimer"><div class="sticky-timer-inner">';
    h+='<div class="sticky-timer-rd">Rd '+(ss.currentRound+1)+'/'+ss.config.rounds+'</div>';
    h+='<div class="sticky-timer-time'+(timer<=60?' urgent':'')+'" id="stickyTd">'+fmtT(timer)+'</div>';
    h+='<div class="sticky-timer-bar"><div class="sticky-timer-fill" id="stickyTf" style="width:'+(timer/(ss.config.roundMin*60))*100+'%;background:'+(timer<=60?'#ff5c47':timer<=180?'#ffcc00':'#c8ff00')+'"></div></div>';
    h+='</div></div>'}

  // (Text size strip removed — no longer needed.)

  // Round header + timer
  if(isCurrent){
    if(isPreview){
      // Lineup preview mode — lineups visible but round not live yet
      h+='<div class="round-hdr fu"><div><div class="overline">Lineup ready</div><div class="round-num">Rd 1 <span class="round-of">of '+ss.config.rounds+'</span></div></div><span style="font-size:10px;font-weight:800;color:'+(isLight?'#7a5800':'#ffcc00')+';text-transform:uppercase;letter-spacing:.07em;background:'+(isLight?'rgba(255,204,0,0.18)':'rgba(255,204,0,0.12)')+';padding:4px 10px;border-radius:20px">Preview</span></div>';
      if(isAdmin){
        h+='<div style="margin-bottom:12px"><button class="bp full" style="padding:14px;font-size:.95rem;font-weight:900" onclick="beginRound()">▶ Start Round 1</button></div>';
        h+='<div style="display:flex;gap:6px;margin-bottom:12px"><button class="bg-btn" style="flex:1" onclick="reshuffleRound()">Reshuffle</button><button class="bds" style="flex:1" onclick="restartLadder()">Restart</button></div>';
      }
    }else{
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
      }
    }}
  else{
    h+='<div class="viewing-banner fu"><div class="subtext" style="font-size:.7rem">Viewing</div>';
    h+='<h3 class="heading" style="font-size:.98rem;color:var(--lime);margin:3px 0">Round '+(vr+1)+'</h3>';
    h+=(isAdmin?'<button class="bds" style="margin-top:8px;font-size:.78rem;padding:7px 14px" onclick="restartRound('+vr+')">Restart this round</button>':'')+'</div>'}

  // Round selector
  h+='<div class="round-pills">';
  for(let ri=0;ri<=ss.currentRound;ri++){
    const isV=(isCurrent&&ri===ss.currentRound)||(!isCurrent&&ri===vr);
    const rndI=ss.rounds[ri];
    const done=rndI&&rndI.courts.every(c=>c.score&&c.score.winner)&&rndI.wave2started!==false;
    h+='<button class="rd-pill'+(isV?' active':'')+'" onclick="viewRound('+(ri===ss.currentRound?-1:ri)+')">Rd '+(ri+1)+(ri===ss.currentRound?' ·':done?' ✓':'')+'</button>'}
  h+='</div>';

  // Swap banner
  if(swapMode){
    const srcR=ss.rounds[swapMode.ri];const srcCt=srcR?.courts[swapMode.ci];
    const srcT=swapMode.ti===0?srcCt?.team1:srcCt?.team2;const srcP=srcT?.[swapMode.pi];
    h+='<div style="background:rgba(255,204,0,0.1);border:1.5px solid rgba(255,204,0,0.35);border-radius:12px;padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px">';
    h+='<div><div style="font-size:9px;font-weight:900;color:'+(isLight?'#7a5800':'#ffcc00')+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Swapping player</div>';
    h+='<div style="font-size:var(--cc-pname,16px);font-weight:700;color:'+(isLight?'#111':'#f4f4f0')+'">'+(srcP?.name||'?')+' → tap any player below</div></div>';
    h+='<button onclick="cancelSwap()" style="background:rgba(255,92,71,0.15);border:1px solid rgba(255,92,71,0.3);color:#ff5c47;font-size:13px;font-weight:700;padding:10px 18px;border-radius:8px;cursor:pointer;white-space:nowrap;flex-shrink:0">Cancel</button>';
    h+='</div>'}

  // MVPs
  h+=rRoundMVPs(round,vr,ss,l);

  // Court map (collapsible)
  const isOpen=mapOpen||shouldMapOpen(ss);
  h+='<div class="map-toggle'+(isOpen?' open':'')+'" onclick="toggleMap()"><span class="label">Court map — Rd '+(vr+1)+'</span><span class="arrow">▼</span></div>';
  h+='<div class="court-map'+(isOpen?' open':'')+'">';
  [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
    const nm=cName(ct.court,ss,tC);const sc=ct.score;const hb=sc&&sc.t1!==null&&sc.t2!==null;
    const isW2=hasWaves&&ct.court<=tC-physCourts;
    h+='<div class="cmc'+(hb?' scored':'')+(isW2?' style="opacity:0.55"':'')+'"><div class="cmc-ltr">Ct '+nm+(isW2?' ⏳':'')+'</div><div class="cmc-match">'+ct.team1.filter(Boolean).map(p=>pTag(p,l)).join(' &amp; ')+'<span class="vs-s">vs</span>'+ct.team2.filter(Boolean).map(p=>pTag(p,l)).join(' &amp; ')+'</div>'+(hb?'<div class="cmc-score">'+sc.t1+' – '+sc.t2+'</div>':'')+'</div>'});
  h+='</div>';

  // Court cards — admin mode (2-col grid on iPad)
  if(!hasWaves){
    h+='<div class="court-grid">';
    [...round.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,true)});
    h+='</div>';
  }else{
    const w1cts=round.courts.filter(c=>c.court>tC-physCourts).sort((a,b)=>b.court-a.court);
    const w2cts=round.courts.filter(c=>c.court<=tC-physCourts).sort((a,b)=>b.court-a.court);
    const w1done=w1cts.every(c=>c.score&&c.score.winner);
    h+='<div style="font-size:9px;font-weight:900;color:'+(isLight?'#444':'#aaa')+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Wave 1 — Higher seeds</div>';
    h+='<div class="court-grid">';
    w1cts.forEach(ct=>{h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,true)});
    h+='</div>';
    if(round.wave2started===false){
      h+='<div style="margin:16px 0 8px;padding:14px 16px;background:rgba(255,204,0,0.07);border:1.5px dashed rgba(255,204,0,0.3);border-radius:12px">';
      h+='<div style="font-size:9px;font-weight:900;color:'+(isLight?'#7a5800':'#ffcc00')+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">\u23F3 Wave 2 \u2014 Waiting to play</div>';
      h+='<div style="font-size:12px;color:'+(isLight?'rgba(0,0,0,0.6)':'rgba(255,255,255,0.5)')+';margin-bottom:'+(isAdmin&&w1done?'12px':'4px')+'">'+w2cts.length+' court'+(w2cts.length!==1?'s':'')+' ready once Wave 1 finishes</div>';
      if(isAdmin&&w1done){h+='<button class="bp full" style="padding:11px;margin-bottom:10px" onclick="startWave2()">\u25B6 Start Wave 2</button>';}
      h+='<div>';
      w2cts.forEach(ct=>{
        const nm=cName(ct.court,ss,tC);
        h+='<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid '+(isLight?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.06)')+'">';
        h+='<div style="width:26px;height:26px;border-radius:50%;background:'+(isLight?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:'+(isLight?'#444':'#aaa')+';flex-shrink:0">'+nm+'</div>';
        h+='<div style="font-size:12px;color:'+(isLight?'rgba(0,0,0,0.65)':'rgba(255,255,255,0.55)')+'">'+ct.team1.filter(Boolean).map(p=>p.name).join(' &amp; ')+' <span style="opacity:.5">vs</span> '+ct.team2.filter(Boolean).map(p=>p.name).join(' &amp; ')+'</div>';
        h+='</div>';
      });
      h+='</div></div>';
    }else{
      h+='<div style="font-size:9px;font-weight:900;color:'+(isLight?'#444':'#aaa')+';text-transform:uppercase;letter-spacing:.1em;margin:16px 0 8px">Wave 2 \u2014 Lower seeds</div>';
      h+='<div class="court-grid">';
      w2cts.forEach(ct=>{h+=rCourtCard(ct,round.courts.indexOf(ct),vr,ss,l,true)});
      h+='</div>';
    }
  }

  // Next round / finish buttons also at bottom for convenience
  if(isAdmin&&isCurrent&&!isPreview){
    h+='<div style="display:flex;gap:8px;margin-top:4px">';
    h+='<button class="bp full" onclick="nextRound()">'+(ss.currentRound>=ss.config.rounds-1?'Finish ladder':'Next round')+'</button>';
    h+='</div>';
    if(ss.currentRound<ss.config.rounds-1)h+='<div style="margin-top:8px"><button class="bds full" onclick="finishLadderEarly()">End ladder early</button></div>';
  }else if(isAdmin&&isCurrent&&isPreview){
    h+='<div style="margin-top:8px"><button class="bp full" style="padding:13px;font-weight:900" onclick="beginRound()">▶ Start Round 1</button></div>';}
  if(!isCurrent)h+='<div style="margin-top:10px"><button class="bp full" onclick="viewRound(-1)">Back to current round</button></div>';
  if(ss.finished)h+='<div class="card fu" style="margin-top:12px;text-align:center;padding:20px"><div style="font-size:1.6rem;margin-bottom:6px">🏆</div><h3 class="heading" style="font-size:1rem;color:var(--lime);margin-bottom:4px">Ladder complete!</h3><p class="subtext">Check the Stats tab for final results.</p></div>';
  return h}

// ── Stats, Rules, Players, Roster, Admin — unchanged logic, updated styling ──
function rStats(stats,season,l,ss){
  const has=stats.length>0&&stats.some(s=>s.w+s.l+s.t>0);
  let h='';
  const sessions=ss?[ss]:(season?season.sessions:[]);
  const isSeasonView=!ss&&!!season;
  // Find the parent season so we can render career bonus/win info even when
  // the user is looking at a single completed ladder ("Final Stats" view).
  // Without this, every runner-up in session view shows "no wins yet" because
  // bonusData was an empty object — the user's exact complaint.
  const parentSeason=season||(ss&&l?l.seasons?.find(s=>s.sessions?.some(x=>x.id===ss.id))||null:null);
  // bonusData (season-wide) drives crown counts. bonusDataLocal scopes the
  // Total / Bonus columns to JUST this ladder when we're in session view —
  // so Rich's +25 from previous ladders doesn't inflate his "Total" inside
  // a single-ladder view. In season view the two are the same.
  const bonusData=parentSeason?calcBonusPts(parentSeason.sessions,l.players):{};
  const bonusDataLocal=ss?calcBonusPts([ss],l.players):bonusData;
  const totalPts=(s)=>s.pf+(bonusDataLocal[s.id]?.bonus||0);
  const sorted=isSeasonView?[...stats].sort((a,b)=>totalPts(b)-totalPts(a)||((b.pf-b.pa)-(a.pf-a.pa))):[...stats].sort((a,b)=>totalPts(b)-totalPts(a)||((b.pf-b.pa)-(a.pf-a.pa)));

  // prev week ranking delta
  // NOTE: filter prevStats to only players who actually played a game in
  // those prev sessions. Without the filter, every player in l.players gets
  // a row in calcStats output (with all-zero stats), they all tie at total=0
  // and get assigned arbitrary ranks like 14/15/16. Then a first-ladder
  // attendee (like Clement, LP=1) shows ▼3 instead of "new".
  const prevRankMap={};
  if(isSeasonView&&season.sessions.filter(x=>x.started).length>=2){
    const prevSessions=season.sessions.filter(x=>x.started).slice(0,-1);
    const prevStats=calcStats(prevSessions,l.players);
    const prevBonus=calcBonusPts(prevSessions,l.players);
    const prevSorted=[...prevStats].filter(s=>s.w+s.l+s.t>0).sort((a,b)=>(b.pf+(prevBonus[b.id]?.bonus||0))-(a.pf+(prevBonus[a.id]?.bonus||0))||(b.pf-b.pa)-(a.pf-a.pa));
    prevSorted.forEach((s,i)=>prevRankMap[s.id]=i+1);}

  const topCtName=(s)=>{
    const wonCs=(s.roundRes||[]).filter(r=>r.won).map(r=>r.court);
    if(!wonCs.length)return'--';
    const best=Math.max(...wonCs);
    const refSS=ss||(season?.sessions?.slice().reverse().find(x=>x.started));
    const nC=refSS?.config?.courts||4;
    const idx=(refSS?.config?.courtNames?.length||0)-best;
    return refSS?.config?.courtNames?.[idx]||String.fromCharCode(65+nC-best)};

  // ── inner tab bar ──
  // Search inner tab dropped — public lookups go via the row-tap profile popup.
  // If the user had statsInnerTab='search' from old state, fall back to standings.
  if(statsInnerTab==='search')statsInnerTab='standings';
  h+='<div style="display:flex;background:var(--surf2);border-radius:6px;overflow:hidden;padding:2px;gap:2px;margin-bottom:10px">';
  ['standings','fullstats'].forEach(t=>{
    const labels={standings:'Standings',fullstats:'Full Stats'};
    const on=statsInnerTab===t;
    h+='<button style="flex:1;padding:7px 6px;font-size:9px;font-weight:800;color:'+(on?'#000':'var(--muted)')+';text-align:center;text-transform:uppercase;letter-spacing:.07em;border-radius:4px;border:none;cursor:pointer;background:'+(on?'#c8ff00':'transparent')+"\" onclick=\"setStatsInnerTab('"+t+"')\">"+labels[t]+'</button>';});
  h+='</div>';

  // ══ STANDINGS — uniform table (matches dashboard Leaderboard) ══
  if(statsInnerTab==='standings'){
    if(!has){h+='<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';return h;}
    // Bonus strip (only meaningful in season-wide view, but keep for context in session view too)
    if(isSeasonView){
      h+='<div style="display:flex;background:var(--lime-dim);border:0.5px solid var(--lime-bd);border-radius:8px;overflow:hidden;margin-bottom:8px">';
      [{p:'1st',b:15},{p:'2nd',b:10},{p:'3rd',b:5}].forEach((x,i)=>{
        h+='<div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid var(--lime-bd)"><div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">'+x.p+'</div><div style="font-size:16px;font-weight:900;color:var(--lime);line-height:1">+'+x.b+'</div><div style="font-size:8px;color:var(--lime);opacity:.6;margin-top:1px">bonus</div></div>';
      });
      h+='<div style="flex:1;text-align:center;padding:8px 4px"><div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Scope</div><div style="font-size:10px;font-weight:900;color:var(--lime);line-height:1.3">All<br>ladders</div></div></div>';
    }
    // Hint about row-tap profile popup
    h+='<div style="font-size:10px;color:var(--muted);text-align:center;line-height:1.5;padding:0 4px 8px">Tap a row for expanded Player Profile Stats.</div>';

    // Uniform table. Bonus column appears ONLY once the ladder is finished —
    // user requested: bonus stays hidden mid-ladder so admins/players don't
    // see provisional podium pts before the ladder is locked.
    const showBonus=!!(ss&&ss.finished);
    const podLabel=['1st','2nd','3rd'];
    const podCol=['#ffcc00','#c0c0c0','#cd7f32'];
    const podBg=['rgba(255,204,0,0.08)','rgba(180,180,180,0.06)','rgba(205,127,50,0.08)'];
    const cols=showBonus?'30px 26px 1fr 26px 26px 38px 40px 44px':'30px 26px 1fr 28px 28px 44px 50px';
    const headerCells=showBonus?['#','\u0394','Player','W','L','Diff','Bonus','Total']:['#','\u0394','Player','W','L','Diff','Total'];
    const sortedActive=sorted.filter(s=>s.w+s.l+s.t>0);
    h+='<div style="background:var(--surf1);border:0.5px solid var(--border);border-radius:10px;overflow:hidden">';
    h+='<div style="display:grid;grid-template-columns:'+cols+';gap:5px;padding:7px 12px;background:var(--surf2);border-bottom:1px solid var(--border);font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">';
    headerCells.forEach((c,j)=>{
      const align=j===2?'left':j===1?'center':'right';
      h+='<div style="text-align:'+align+'">'+c+'</div>';
    });
    h+='</div>';

    sortedActive.forEach((s,i)=>{
      const rank=i+1;
      const wins=bonusData[s.id]?.wins||0;
      const bonus=bonusDataLocal[s.id]?.bonus||0;
      const total=showBonus?(s.pf+bonus):s.pf;
      const d=s.pf-s.pa;
      const isPod=rank<=3;
      const rankColor=isPod?podCol[rank-1]:'var(--muted)';
      const totalColor=isPod?podCol[rank-1]:'var(--lime)';
      const stripeBg=isPod?podBg[rank-1]:(i%2===1?'var(--surf2)':'transparent');
      h+='<div'+pClick(s.id)+' style="display:grid;grid-template-columns:'+cols+';gap:5px;padding:9px 12px;border-bottom:0.5px solid var(--border);background:'+stripeBg+';align-items:center;font-variant-numeric:tabular-nums'+pCur()+'">';
      h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:'+(isPod?'700':'400')+';color:'+rankColor+'">'+(isPod?podLabel[rank-1]:rank)+'</div>';
      h+='<div style="text-align:center;font-size:9px">'+renderDelta(prevRankMap[s.id],rank,Object.keys(prevRankMap).length>0)+'</div>';
      h+='<div style="font-size:var(--st-name,13px);font-weight:700;color:'+(isPod?'var(--text)':'var(--text-sec)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.name+(wins>0?' '+crownStr(wins):'')+'</div>';
      h+='<div style="text-align:right;font-size:var(--st-stat,12px);font-weight:700;color:var(--lime)">'+s.w+'</div>';
      h+='<div style="text-align:right;font-size:var(--st-stat,12px);color:var(--muted)">'+s.l+'</div>';
      h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:'+(d>=0?'700':'400')+';color:'+(d>0?'var(--lime)':d<0?'var(--loss)':'var(--muted)')+'">'+(d>0?'+':'')+d+'</div>';
      if(showBonus){
        h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:800;color:'+(bonus>0?'var(--lime)':'var(--muted-lt)')+'">'+(bonus>0?'+'+bonus:'\u2014')+'</div>';
      }
      h+='<div style="text-align:right;font-size:var(--st-stat,13px);font-weight:900;color:'+totalColor+'">'+total+'</div>';
      h+='</div>';
    });
    h+='</div>';
  }

  // ══ FULL STATS ══
  // No LP (always 1 in session view), no Bonus, no Total. Pure ladder stats.
  // Rows are tappable to open the player profile popup.
  if(statsInnerTab==='fullstats'){
    if(!has){h+='<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';return h;}
    const drSessions = ss ? [ss] : (season ? season.sessions : []);
    const drRatings = calcDinkRating(stats, drSessions, l.players);
    const byPts = sorted.filter(s=>s.w+s.l+s.t>0);
    const byDr  = [...byPts].sort((a,b)=>(drRatings[b.id]??-1)-(drRatings[a.id]??-1));
    const fsRows = statsRankMode==='dr' ? byDr : byPts;
    const ptsRankOf = {};byPts.forEach((s,i)=>ptsRankOf[s.id]=i+1);
    // Toggle
    const tBtn=(m,label)=>'<button data-m="'+m+'" onclick="setStatsRankMode(this.dataset.m)" style="font-size:11px;font-weight:600;padding:4px 11px;border:none;border-radius:6px;cursor:pointer;background:'+(statsRankMode===m?'#a78bfa':'transparent')+';color:'+(statsRankMode===m?'#fff':'var(--muted)')+';transition:all .15s">'+label+'</button>';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 8px">';
    h+='<span style="font-size:11px;color:var(--muted)">Ranked by '+(statsRankMode==='dr'?'D(r)ink Rating':'total points')+'</span>';
    h+='<div style="display:flex;background:var(--surf2);border:0.5px solid var(--border);border-radius:8px;padding:3px;gap:2px">'+tBtn('pts','Pts rank')+tBtn('dr','DR rank')+'</div>';
    h+='</div>';
    h+='<div style="overflow-x:auto;margin:0 -14px;padding:0 14px"><table class="st"><thead><tr>'+['#','Player','W','L','Pts','PS','PA','+/-','Avg','Top Ct','Strk'].map(x=>'<th style="text-align:'+(x==='Player'?'left':'right')+'">'+x+'</th>').join('')+'<th class="dr-th" onclick="openDRLegend()" style="cursor:pointer;white-space:nowrap" title="Tap to learn how DR is calculated">⬡ DR <span style="font-size:8px;opacity:.5">ℹ</span></th></tr></thead><tbody>';
    fsRows.forEach((s,i)=>{
      const d=s.pf-s.pa;const sk=s.streak;const skStr=sk>0?'W'+sk:sk<0?'L'+Math.abs(sk):'--';
      const avg=s.roundPts.length?(Math.round(s.pf/s.roundPts.length*10)/10).toFixed(1):0;
      const tc=topCtName(s);const wins=bonusData[s.id]?.wins||0;
      const dr=drRatings[s.id];const drStr=dr!=null?dr:'—';
      // rank delta when in DR mode
      let deltaHtml='';
      if(statsRankMode==='dr'&&dr!=null){
        const mv=(ptsRankOf[s.id]||0)-(i+1);
        if(mv>0)deltaHtml='<span style="color:var(--lime);font-size:9px;margin-left:2px">▲'+mv+'</span>';
        else if(mv<0)deltaHtml='<span style="color:var(--loss);font-size:9px;margin-left:2px">▼'+Math.abs(mv)+'</span>';
      }
      h+='<tr'+pClick(s.id)+' style="'+(i===0?'background:var(--lime-dim);':i%2===1?'background:var(--surf2);':'')+pCur()+'">';
      h+='<td class="'+(i<3?'rt':'')+'" style="text-align:right">'+(["1st","2nd","3rd"][i]||(i+1))+deltaHtml+'</td>';
      h+='<td style="font-weight:600;white-space:nowrap;text-align:left">'+s.name+(wins>0?' '+crownStr(wins):'')+'</td>';
      h+='<td class="at" style="text-align:right">'+s.w+'</td>';
      h+='<td class="rdt" style="text-align:right">'+s.l+'</td>';
      h+='<td style="text-align:right;font-weight:'+(statsRankMode==='pts'?'800':'400')+';color:'+(statsRankMode==='pts'?'var(--lime)':'var(--muted)')+'">'+s.pf+'</td>';
      h+='<td style="text-align:right;color:var(--muted)">'+s.pf+'</td>';
      h+='<td style="text-align:right;color:var(--muted)">'+s.pa+'</td>';
      h+='<td style="text-align:right;font-weight:700;color:'+(d>=0?'var(--lime)':'var(--loss)')+'">'+(d>0?'+':'')+d+'</td>';
      h+='<td style="text-align:right;color:var(--text-sec)">'+avg+'</td>';
      h+='<td style="text-align:right;color:var(--cyan);font-size:.72rem;font-weight:700">'+tc+'</td>';
      h+='<td style="text-align:right;color:'+(sk>0?'var(--lime)':sk<0?'var(--loss)':'var(--muted)')+';font-weight:600">'+skStr+'</td>';
      h+='<td class="dr-td"><span class="dr-val" style="'+(statsRankMode==='dr'?'color:#a78bfa;font-weight:700':'')+'">'+drStr+'</span></td></tr>';
    });
    h+='</tbody></table></div>';}

  // (Search inner tab removed — players now look up stats by tapping a row.)
  return h}


function rSearch(stats,season,l){
  if(!season)return'';
  const bonusData=calcBonusPts(season.sessions,l.players);
  const totalPts=(s)=>s.pf+(bonusData[s.id]?.bonus||0);
  const sorted=[...stats].filter(s=>s.w+s.l>0).sort((a,b)=>totalPts(b)-totalPts(a)||(b.pf-b.pa)-(a.pf-a.pa));
  const topCtName=(s)=>{const wonCs=(s.roundRes||[]).filter(r=>r.won).map(r=>r.court);if(!wonCs.length)return'--';const best=Math.max(...wonCs);const refSS=season?.sessions?.slice().reverse().find(x=>x.started);const nC=refSS?.config?.courts||4;const idx=(refSS?.config?.courtNames?.length||0)-best;return refSS?.config?.courtNames?.[idx]||String.fromCharCode(65+nC-best)};
  let h='';
  h+='<div style="display:flex;align-items:center;gap:8px;background:var(--surf2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">';
  h+='<span style="font-size:14px;color:var(--muted)">&#128269;</span>';
  h+='<input id="statsSearchInput" class="inp" style="background:transparent;border:none;padding:0;font-size:14px" placeholder="Search player name..." value="'+statsSearchQ+'" oninput="updateSearch(this.value)"></div>';
  h+='<div id="searchResults">'+_buildSearchCardsHTML(statsSearchQ.toLowerCase().trim(),sorted,bonusData,topCtName)+'</div>';
  return h;}

function rRules(ss){
  const nC=ss?.config?.courts||4;
  const names=ss?.config?.courtNames||defaultCourtNames(nC);
  const kitchenName=names[0]||'A';
  const bottomName=names[names.length-1]||String.fromCharCode(65+nC-1);
  let h='';
  h+='<div style="background:var(--lime-dim);border:1px solid var(--lime-bd);border-radius:14px;padding:18px;margin-bottom:10px;position:relative;overflow:hidden">';
  h+='<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#c8ff00,#00e5ff)"></div>';
  h+='<div style="font-size:var(--st-hdr,9px);font-weight:900;color:var(--lime);text-transform:uppercase;letter-spacing:.2em;margin-bottom:8px">How it works</div>';
  h+='<div style="font-size:20px;font-weight:900;color:var(--text);letter-spacing:-.03em;line-height:1.1;margin-bottom:6px">The Society keeps receipts.</div>';
  h+='<div style="font-size:var(--st-name,13px);color:var(--muted);line-height:1.6">Ladder play. Every round counts. Win or lose, you move. Points follow you all season.</div>';
  h+='</div>';
  h+='<div style="font-size:var(--st-hdr,9px);font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">Court movement</div>';
  h+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
  [
    {icon:'\u2191',col:'#c8ff00',bg:'rgba(200,255,0,0.07)',bd:'rgba(200,255,0,0.2)',title:'Win \u2192 Move up',body:'Winners advance one court each round.'},
    {icon:'\u2193',col:'#ff5c47',bg:'rgba(255,92,71,0.07)',bd:'rgba(255,92,71,0.2)',title:'Lose \u2192 Move down',body:'Losers drop one court each round.'},
    {icon:'\u{1F451}',col:'#ffcc00',bg:'rgba(255,204,0,0.07)',bd:'rgba(255,204,0,0.2)',title:'Owns the Kitchen \u2014 Court '+kitchenName,body:'Top court winners stay but split partners. You hold the throne, new challenge incoming.'},
    {icon:'\u21d5',col:'rgba(255,255,255,0.4)',bg:'rgba(255,255,255,0.04)',bd:'rgba(255,255,255,0.1)',title:'Bottom court \u2014 Court '+bottomName,body:'Losers stay but split partners. Grind your way back up.'},
    {icon:'\u21c4',col:'#00e5ff',bg:'rgba(0,229,255,0.07)',bd:'rgba(0,229,255,0.2)',title:'Partners split every round',body:'You never play with the same partner twice in a row. Everyone pairs up fresh.'},
  ].forEach(m=>{
    h+='<div style="display:flex;align-items:flex-start;gap:12px;background:'+m.bg+';border:1px solid '+m.bd+';border-radius:10px;padding:12px 14px">';
    h+='<div style="font-size:18px;flex-shrink:0;width:28px;text-align:center;line-height:1.4">'+m.icon+'</div>';
    h+='<div><div style="font-size:var(--st-name,13px);font-weight:800;color:'+m.col+';margin-bottom:2px">'+m.title+'</div>';
    h+='<div style="font-size:var(--st-stat,12px);color:var(--muted);line-height:1.5">'+m.body+'</div></div></div>';});
  h+='</div>';
  h+='<div style="font-size:var(--st-hdr,9px);font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">Scoring</div>';
  h+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
  [
    {col:'#c8ff00',title:'Most cumulative points wins',body:'Points scored in every round add up. Every game matters equally.'},
    {col:'#c8ff00',title:'Tiebreaker: point differential',body:'If tied on total points, the player with the better +/- takes the higher rank.'},
    {col:'#ff5c47',title:'No ties allowed',body:'If the score is tied when time expires, you play out the point. Whoever wins that point gets the win.'},
    {col:'#ffcc00',title:'Bonus points for ladder finishes',body:'1st place +15 pts, 2nd place +10 pts, 3rd place +5 pts. Stacks across all ladders.'},
  ].forEach(r=>{
    h+='<div style="display:flex;align-items:flex-start;gap:10px;background:var(--surf2);border:0.5px solid var(--border);border-radius:10px;padding:12px 14px">';
    h+='<div style="width:6px;height:6px;border-radius:50%;background:'+r.col+';flex-shrink:0;margin-top:5px"></div>';
    h+='<div><div style="font-size:var(--st-name,13px);font-weight:800;color:var(--text);margin-bottom:2px">'+r.title+'</div>';
    h+='<div style="font-size:var(--st-stat,12px);color:var(--muted);line-height:1.5">'+r.body+'</div></div></div>';});
  h+='</div>';
  h+='<div style="font-size:var(--st-hdr,9px);font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">Each round</div>';
  h+='<div style="background:var(--surf2);border:0.5px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px">';
  ['Play the full round duration.','When the timer sounds, finish the rally in progress.','Receiving team makes line calls.','There must always be a winner \u2014 no ties.'].forEach((t,i,arr)=>{
    h+='<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;'+(i<arr.length-1?'border-bottom:0.5px solid var(--border)':'')+'">';
    h+='<div style="font-size:var(--st-hdr,10px);font-weight:900;color:var(--lime);opacity:.7;flex-shrink:0;width:18px;text-align:center">'+(i+1)+'</div>';
    h+='<div style="font-size:var(--st-name,13px);color:var(--text-sec)">'+t+'</div></div>';});
  h+='</div>';
  if(ss){
    h+='<div style="font-size:var(--st-hdr,9px);font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">This ladder</div>';
    h+='<div style="background:var(--surf2);border:0.5px solid var(--border);border-radius:10px;overflow:hidden">';
    [['Courts',names.join(', ')],['Rounds',ss.config.rounds],['Round time',ss.config.roundMin+' min'],['Scoring',ss.config.scoreMode==='points'?'Points':'Win / Loss'],['Location',ss.config.place||'\u2014'],['Start',ss.config.startTime?fmt12(ss.config.startTime):'\u2014']].forEach(([k,v],i,arr)=>{
      h+='<div class="cfg-row" style="'+(i===arr.length-1?'border:none':'')+'">';
      h+='<span style="font-size:var(--st-stat,12px);color:var(--muted)">'+k+'</span>';
      h+='<span style="font-size:var(--st-stat,12px);font-weight:700;color:var(--text)">'+v+'</span></div>';});
    h+='</div>';}
  return h;}


function rPlayers(l){
  let h='';
  const active=l.players.filter(p=>p.active!==false);
  const inactive=l.players.filter(p=>p.active===false);
  const s=gS();
  const bonusData=(s&&!isAdmin)?calcBonusPts(s.sessions,l.players):{};
  const seasonStats=(s&&!isAdmin)?calcStats(s.sessions,l.players):[];
  const totalPts=(pid)=>{const st=seasonStats.find(x=>x.id===pid);return(st?.pf||0)+(bonusData[pid]?.bonus||0)};
  const sortedActive=[...active].sort((a,b)=>isAdmin?a.name.localeCompare(b.name):totalPts(b.id)-totalPts(a.id));
  if(isAdmin)h+='<div class="card fu"><h3 class="card-t">Add player to league</h3><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key===\'Enter\')addPlayer()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addPlayer()">Add</button></div>';
  h+='<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Active players</h3><span class="pill ok">'+active.length+'</span></div>';
  if(!active.length)h+='<p class="subtext" style="text-align:center;padding:20px">No active players.</p>';
  else if(isAdmin){
    h+=sortedActive.map(p=>'<div class="pr"><span style="flex:1;font-weight:600;font-size:var(--st-name,.88rem)">'+p.name+'</span><span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span><button class="edit-btn" onclick="openEditPlayer(\''+p.id+'\')">Edit</button><button class="edit-btn" style="color:var(--loss)" onclick="deactivatePlayer(\''+p.id+'\')">Deactivate</button><button class="edit-btn" style="color:var(--loss);font-weight:700" onclick="deletePlayer(\''+p.id+'\')">Delete</button></div>').join('');
  } else {
    h+=sortedActive.map((p,i)=>{
      const wins=bonusData[p.id]?.wins||0;
      const pts=totalPts(p.id);
      const crown=wins>0?(' '+crownStr(wins)):'';
      const isLtSt=theme==='hc-light';
      const bg=i===0?(isLtSt?'background:var(--lime-dim);border:0.5px solid var(--lime-bd);':'background:#0d1400;border:0.5px solid rgba(200,255,0,0.15);'):'background:var(--surf2);border:1px solid var(--border);';
      return'<div style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:var(--rx);margin-bottom:6px;'+bg+'">'
        +'<div style="width:32px;height:32px;border-radius:50%;background:'+(i===0?'rgba(200,255,0,0.15)':'rgba(255,255,255,0.06)')+';display:flex;align-items:center;justify-content:center;font-size:var(--st-rank,11px);font-weight:900;color:'+(i===0?'#c8ff00':'var(--muted)')+';flex-shrink:0">'+p.name.slice(0,2).toUpperCase()+'</div>'
        +'<div style="flex:1"><div style="font-size:var(--st-name,14px);font-weight:700;color:var(--text)">'+p.name+crown+'</div>'
        +(wins>0?'<div style="font-size:var(--st-hdr,9px);color:rgba(200,255,0,0.5);margin-top:1px">'+wins+' ladder win'+(wins!==1?'s':'')+'</div>':'<div style="font-size:var(--st-hdr,9px);color:var(--muted);margin-top:1px">no wins yet</div>')
        +'</div>'
        +'<span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span>'
        +(pts>0?'<div style="font-size:var(--st-stat,13px);font-weight:800;color:rgba(200,255,0,0.7)">'+pts+'</div>':'')
        +'</div>'}).join('');
  }
  h+='</div>';
  if(inactive.length&&isAdmin){
    h+='<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 class="card-t" style="margin:0">Inactive players</h3><span class="pill">'+inactive.length+'</span></div>';
    h+=[...inactive].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>'<div class="pr" style="opacity:.5"><span style="flex:1;font-weight:600;font-size:var(--st-name,.88rem)">'+p.name+'</span><span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span><button class="edit-btn" onclick="openEditPlayer(\''+p.id+'\')">Edit</button><button class="edit-btn" style="color:var(--lime)" onclick="reactivatePlayer(\''+p.id+'\')">Activate</button><button class="edit-btn" style="color:var(--loss);font-weight:700" onclick="deletePlayer(\''+p.id+'\')">Delete</button></div>').join('');
    h+='</div>'}
  return h}
function timeUntil(ss){
  if(!ss.date||!ss.config?.startTime)return null;
  try{
    const[hh,mm]=ss.config.startTime.split(':').map(Number);
    const start=new Date(ss.date+'T'+String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')+':00');
    const diff=start-new Date();
    if(diff<=0)return null;
    const totalMins=Math.floor(diff/60000);
    if(totalMins<60)return totalMins+' min';
    const hrs=Math.floor(totalMins/60);const mins=totalMins%60;
    return mins>0?hrs+'h '+mins+'m':hrs+' hour'+(hrs!==1?'s':'');
  }catch{return null}}

function rLadderInfo(l,ss){
  let h='';
  const nC=ss.config.courts||4;
  const names=ss.config.courtNames?.length?ss.config.courtNames:defaultCourtNames(nC);
  const nPlayers=ss.participants?.length||l.players.filter(p=>p.active!==false).length;
  // Status badge
  let badge='';
  if(ss.finished){
    badge='<span class="pill" style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.5);border:0.5px solid rgba(255,255,255,0.12)">Complete</span>';
  } else if(ss.started&&ss.liveStarted===false){
    badge='<span class="pill" style="background:rgba(255,204,0,0.12);color:#ffcc00;border:0.5px solid rgba(255,204,0,0.3)">📋 Lineups posted</span>';
  } else if(ss.started){
    badge='<span class="pill live"><span class="dot"></span>Live · Rd '+(ss.currentRound+1)+'</span>';
  } else {
    const cd=timeUntil(ss);
    badge=cd
      ?'<span class="pill" style="background:rgba(0,229,255,0.1);color:#00e5ff;border:0.5px solid rgba(0,229,255,0.25)">Starts in '+cd+'</span>'
      :'<span class="pill" style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.5);border:0.5px solid rgba(255,255,255,0.12)">Upcoming</span>';
  }
  // Header card
  h+='<div class="card fu">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
  h+='<div style="font-size:10px;font-weight:700;color:rgba(200,255,0,0.6);letter-spacing:.15em;text-transform:uppercase">'+(ss.name||'Ladder')+'</div>';
  h+=badge+'</div>';
  h+='<div style="font-size:20px;font-weight:900;color:var(--text);line-height:1.15;margin-bottom:4px">'+fmtDate(ss.date)+(ss.config.startTime?' · '+fmt12(ss.config.startTime):'')+'</div>';
  h+='<div style="font-size:13px;color:var(--muted)">'+l.name+(ss.config.place?' · '+ss.config.place:'')+'</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px">';
  [{v:nPlayers,l:'Players'},{v:nC,l:'Courts'},{v:ss.config.rounds,l:'Rounds'}].forEach(c=>{
    h+='<div style="background:var(--surf2);border:0.5px solid var(--border);border-radius:10px;padding:12px 8px;text-align:center">';
    h+='<div style="font-size:22px;font-weight:900;color:var(--text);line-height:1">'+c.v+'</div>';
    h+='<div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.06em">'+c.l+'</div></div>';
  });
  h+='</div></div>';
  // Starting lineup card — preview only (lineups generated, round not live yet)
  if(ss.started&&ss.liveStarted===false&&ss.rounds&&ss.rounds[0]){
    const r0=ss.rounds[0];const tC0=r0.totalCourts||r0.courts.length;
    h+='<div class="card fu"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:#ffcc00;letter-spacing:.12em;text-transform:uppercase">📋 Starting lineup</div><span style="font-size:10px;color:var(--muted)">Round 1 — find your court</span></div>';
    [...r0.courts].sort((a,b)=>b.court-a.court).forEach(ct=>{
      const nm=cName(ct.court,ss,tC0);
      const t1=ct.team1.filter(Boolean).map(p=>p.name).join(' &amp; ');
      const t2=ct.team2.filter(Boolean).map(p=>p.name).join(' &amp; ');
      h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:var(--surf2);border:0.5px solid var(--border)">';
      h+='<div style="width:32px;height:32px;border-radius:8px;background:rgba(255,204,0,0.12);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#ffcc00;flex-shrink:0">'+nm+'</div>';
      h+='<div style="flex:1;font-size:var(--cc-pname,13px);font-weight:600;color:var(--text)">'+t1+' <span style="opacity:.45;font-weight:500">vs</span> '+t2+'</div>';
      h+='</div>';
    });
    h+='<div style="font-size:11px;color:var(--muted);margin-top:4px">Scoring starts once the host begins Round 1.</div></div>';
  }
  // Court flow card
  const courtAccents=[
    {bg:'rgba(255,204,0,0.07)',bd:'rgba(255,204,0,0.25)',nameCol:'#ffcc00',badgeBg:'rgba(255,204,0,0.15)',badgeCol:'#ffcc00'},
    {bg:'rgba(0,229,255,0.04)',bd:'rgba(255,255,255,0.07)',nameCol:'rgba(255,255,255,0.85)',badgeBg:'rgba(0,229,255,0.1)',badgeCol:'#00e5ff'},
    {bg:'rgba(255,255,255,0.03)',bd:'rgba(255,255,255,0.07)',nameCol:'rgba(255,255,255,0.85)',badgeBg:'rgba(59,130,246,0.1)',badgeCol:'#60a5fa'},
    {bg:'rgba(255,255,255,0.03)',bd:'rgba(255,255,255,0.07)',nameCol:'rgba(255,255,255,0.85)',badgeBg:'rgba(167,139,250,0.1)',badgeCol:'#a78bfa'},
  ];
  h+='<div class="card fu"><div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Court flow</div>';
  for(let i=0;i<nC;i++){
    const name=names[i];
    const isKing=i===0;const isBottom=i===nC-1;
    const ac=courtAccents[Math.min(i,courtAccents.length-1)];
    const winTag=isKing?'W → stay':'W → up ↑';
    const loseTag=isBottom?'L → stay':'L → down ↓';
    const loseTagBg=isBottom?'rgba(167,139,250,0.15)':'rgba(255,92,71,0.1)';
    const loseTagCol=isBottom?'#a78bfa':'#ff5c47';
    h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:'+ac.bg+';border:0.5px solid '+ac.bd+'">';
    h+='<div style="width:36px;height:36px;border-radius:8px;background:'+ac.badgeBg+';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:'+ac.badgeCol+';flex-shrink:0">'+name+'</div>';
    h+='<div style="flex:1"><div style="font-size:var(--cc-pname,14px);font-weight:700;color:'+ac.nameCol+'">'+name+(isKing?' — King Court':isBottom?' — Bottom':'')+'</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:2px">'+(isKing?'Win the top, hold the throne':isBottom?'Work your way up':'Middle court')+'</div></div>';
    h+='<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">';
    h+='<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(200,255,0,0.1);color:#c8ff00">'+winTag+'</span>';
    h+='<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:'+loseTagBg+';color:'+loseTagCol+'">'+loseTag+'</span>';
    h+='</div></div>';
    if(i<nC-1)h+='<div style="display:flex;justify-content:center;margin:-2px 0;color:var(--muted-lt);font-size:12px">↕</div>';
  }
  h+='<div style="background:var(--surf2);border:0.5px solid var(--border);border-radius:10px;padding:11px 13px;margin-top:12px">';
  h+='<div style="font-size:11px;color:var(--muted);line-height:1.65"><span style="color:var(--lime);font-weight:700">Partners split every round</span> — you never play with the same partner twice in a row. Points scored in every round add up all season.</div>';
  h+='</div></div>';
  return h;}

function rSessionRoster(l,ss){let h='';const parts=ss.participants||[];const activePlayers=l.players.filter(p=>p.active!==false);const nSelected=parts.length;
  if(isAdmin)h+='<div class="card fu"><h3 class="card-t">Add new player</h3><div style="font-size:.72rem;color:var(--muted);margin-bottom:8px">Adds to league roster and selects for this ladder</div><div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:10px"><input id="fPN" class="inp" placeholder="Player name" onkeydown="if(event.key===\'Enter\')addAndSelect()"><select id="fPG" class="inp"><option value="M">M</option><option value="F">F</option></select></div><button class="bp full" onclick="addAndSelect()">Add &amp; select</button></div>';
  h+='<div class="card fu"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 class="card-t" style="margin:0">'+(isAdmin?'Ladder participants':'Players in this ladder')+'</h3><span class="pill '+(nSelected>=4?'ok':'')+'" style="'+(nSelected<4&&isAdmin?'background:var(--warn-bg);color:var(--warn);border-color:var(--warn-bd)':'')+'">'+nSelected+(isAdmin?' selected':' player'+(nSelected!==1?'s':''))+'</span></div>';
  if(isAdmin)h+='<div style="font-size:.72rem;color:var(--muted);margin-bottom:12px">Tap to select who is playing this ladder'+(ss.started?' (locked — ladder started)':'')+'</div>';
  if(isAdmin&&!ss.started)h+='<div style="display:flex;gap:8px;margin-bottom:12px"><button class="bg-btn" style="flex:1;font-size:.74rem;padding:8px" onclick="selectAllParticipants()">Select all</button><button class="bg-btn" style="flex:1;font-size:.74rem;padding:8px" onclick="deselectAllParticipants()">Deselect all</button></div>';
  // Public viewers see only the participants of THIS ladder (not the whole league roster).
  // Admins see every active league player so they can pick who's in.
  const rosterPlayers=isAdmin?activePlayers:activePlayers.filter(p=>parts.includes(p.id));
  const sortedRoster=[...rosterPlayers].sort((a,b)=>a.name.localeCompare(b.name));
  const _rs=gS();
  const drRatings=(!isAdmin&&_rs)?calcDinkRating(calcStats(_rs.sessions,l.players),_rs.sessions,l.players):{};
  if(!isAdmin&&!sortedRoster.length)h+='<div style="text-align:center;padding:24px;color:var(--muted);font-size:.85rem">No players in this ladder yet.</div>';
  h+=sortedRoster.map(p=>{const isIn=parts.includes(p.id);const canToggle=isAdmin&&!ss.started;const dr=drRatings[p.id];const drStr=dr!=null?dr.toFixed(1):'—';return'<div class="pr pick-row'+(isIn?' pick-in':'')+'"'+(canToggle?' onclick="toggleParticipant(\''+p.id+'\')" style="cursor:pointer"':'')+'>'+(isAdmin?'<div class="pick-check">'+(isIn?'✓':'')+'</div>':'')+(!isAdmin?'<span style="flex:1;font-weight:600;font-size:var(--st-name,.88rem);cursor:pointer" onclick="event.stopPropagation();openPlayerStats(\''+p.id+'\')">'+p.name+'</span>':'<span style="flex:1;font-weight:600;font-size:var(--st-name,.88rem)">'+p.name+'</span>')+'<span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span>'+(!isAdmin?'<div style="text-align:right;min-width:42px"><div style="font-size:var(--st-name,13px);font-weight:700;color:var(--muted)">'+drStr+'</div><div style="font-size:var(--st-hdr,9px);color:var(--muted);opacity:.6">DR</div></div>':'')+(isAdmin?'<button class="edit-btn" onclick="event.stopPropagation();openEditPlayer(\''+p.id+'\')">Edit</button>':'')+(isAdmin&&ss.started?'<button class="edit-btn" style="color:var(--warn)" onclick="event.stopPropagation();replacePlayer(\''+p.id+'\')">Swap</button>':'')+'</div>'}).join('');
  h+='</div>';
  if(isAdmin&&nSelected<4)h+='<div style="text-align:center;padding:10px"><p style="color:var(--warn);font-size:.82rem">Need at least 4 participants to start.</p></div>';
  if(isAdmin&&ss.started&&!ss.finished){
    const subbedOut=l.players.filter(p=>p.subbedOut&&ss.participants?.includes(p.id));
    h+='<div class="card fu"><h3 class="card-t">Player substitutions</h3>';
    h+='<div style="font-size:.72rem;color:var(--muted);margin-bottom:10px">Sub out a tired or injured player. Stats kept. Sub back in anytime.</div>';
    const activeParts=(ss.participants||[]).map(id=>l.players.find(p=>p.id===id)).filter(p=>p&&p.active!==false&&!p.subbedOut);
    activeParts.forEach(p=>{
      h+='<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surf2);border-radius:var(--rx);margin-bottom:6px;border:1px solid var(--border)">';
      h+='<div style="flex:1"><div style="font-size:15px;font-weight:700;color:var(--text)">'+p.name+'</div><div style="font-size:.7rem;color:var(--muted)">'+p.gender+' · Playing</div></div>';
      h+='<button class="bds" style="font-size:.82rem;padding:8px 16px" onclick="subOutPlayer(\''+p.id+'\')"  >Sub out</button>';
      h+='</div>'});
    if(subbedOut.length){
      h+='<div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:10px 0 6px">Subbed out</div>';
      subbedOut.forEach(p=>{
        h+='<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--danger-bg);border-radius:var(--rx);margin-bottom:6px;border:1px solid var(--danger-bd)">';
        h+='<div style="flex:1"><div style="font-size:15px;font-weight:700;color:var(--danger)">'+p.name+'</div><div style="font-size:.7rem;color:var(--danger)">Subbed out</div></div>';
        h+='<button class="bp" style="font-size:.82rem;padding:8px 16px" onclick="subInPlayer(\''+p.id+'\')"  >Sub back in</button>';
        h+='</div>'});}
    // ─── Bench: existing league players not in this ladder (other 2 of 18) ───
    const partIdSet=new Set(ss.participants||[]);
    const benchPlayers=l.players.filter(p=>p&&p.active!==false&&!p.subbedOut&&!p.temp&&!partIdSet.has(p.id));
    if(benchPlayers.length){
      h+='<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px"><div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:4px">Pull from bench</div>';
      h+='<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">League players not in this ladder. They\u2019ll be added as a participant and auto-placed in any open court slot.</div>';
      benchPlayers.forEach(p=>{
        h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surf2);border-radius:var(--rx);margin-bottom:6px;border:1px solid var(--border)">';
        h+='<div style="flex:1;font-size:14px;font-weight:600;color:var(--text)">'+p.name+'</div>';
        h+='<span class="gt '+(p.gender==='F'?'f':'m')+'">'+p.gender+'</span>';
        h+='<button class="bp" style="font-size:.78rem;padding:6px 12px" onclick="pullFromBench(\''+p.id+'\')">Pull in</button>';
        h+='</div>';
      });
      h+='</div>';
    }
    // ─── Add new permanent sub (full stats) ───
    h+='<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px"><div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:4px">Add new permanent sub</div>';
    h+='<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">Adds to league roster. Stats roll up to the season leaderboard.</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:8px"><input id="fSubName" class="inp" placeholder="New player name"><select id="fSubGender" class="inp"><option value="M">M</option><option value="F">F</option></select></div>';
    h+='<button class="bp full" onclick="addSubPlayer()">Add &amp; sub in</button></div>';
    // ─── Add one-round / random temp sub (no leaderboard) ───
    h+='<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px"><div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:4px">Add one-round sub</div>';
    h+='<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">For a one-night fill-in. Counts in this ladder\u2019s stats so the round is correct, but does NOT appear on the season leaderboard.</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 76px;gap:10px;margin-bottom:8px"><input id="fTempSubName" class="inp" placeholder="Sub name (e.g. \u201cSub\u201d or actual name)"><select id="fTempSubGender" class="inp"><option value="M">M</option><option value="F">F</option></select></div>';
    h+='<button class="bg-btn full" onclick="addTempSubPlayer()">Add as temp sub</button></div>';
    h+='</div>'}
  return h}

function rAdmin(l,s){let h='';
  h+='<div class="admin-hierarchy fu"><div class="ah-title">Setup hierarchy</div><div class="ah-row"><div class="ah-num">1</div><div class="ah-info"><div class="ah-label">League</div><div class="ah-desc">Top level. All stats roll up here.</div></div></div><div class="ah-line"></div><div class="ah-row"><div class="ah-num">2</div><div class="ah-info"><div class="ah-label">Season</div><div class="ah-desc">Time period. Stats combine across all ladders.</div></div></div><div class="ah-line"></div><div class="ah-row"><div class="ah-num">3</div><div class="ah-info"><div class="ah-label">Ladder</div><div class="ah-desc">A single play event.</div></div></div></div>';
  h+='<div class="admin-section fu s1"><div class="admin-section-t"><span class="ah-badge">1</span> League</div><div class="cfg-row"><span class="subtext">Name</span><span style="font-weight:600">'+l.name+' <button class="edit-btn" onclick="renameLadder()">Edit</button></span></div><div style="display:flex;gap:6px;margin-top:10px"><button class="bp" style="flex:1" onclick="go(\'newLadder\')">New league</button><button class="bd" style="flex:1" onclick="deleteLadderAction()">Delete</button></div></div>';
  const active=l.seasons.filter(x=>!x.archived),archived=l.seasons.filter(x=>x.archived);
  h+='<div class="admin-section fu s2"><div class="admin-section-t"><span class="ah-badge">2</span> Season</div><div class="cfg-row"><span class="subtext">Current</span><span style="font-weight:600">'+s.name+' <button class="edit-btn" onclick="renameSeason()">Edit</button></span></div>'+(active.length>1?'<div style="margin-top:8px"><label class="lbl">Switch season</label><select class="inp" onchange="gL().activeSeason=this.value;save(gL())">'+active.map(x=>'<option value="'+x.id+'"'+(x.id===l.activeSeason?' selected':'')+'>'+x.name+'</option>').join('')+'</select></div>':'')+'<div style="display:flex;gap:6px;margin-top:10px"><button class="bp" style="flex:1" onclick="go(\'newSeason\')">New season</button><button class="bg-btn" style="flex:1" onclick="archiveSeason(\''+s.id+'\')">Archive</button></div>'+(archived.length?'<div style="margin-top:10px"><label class="lbl">Archived</label>'+archived.map(a=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600;color:var(--muted)">'+a.name+'</span><button class="edit-btn" onclick="unarchiveSeason(\''+a.id+'\')">Restore</button><button class="edit-btn" style="color:var(--danger)" onclick="deleteSeason(\''+a.id+'\')">Delete</button></div>').join('')+'</div>':'')+'</div>';
  const al=s.sessions.filter(x=>!x.archived),arl=s.sessions.filter(x=>x.archived);
  h+='<div class="admin-section fu s3"><div class="admin-section-t"><span class="ah-badge">3</span> Ladders</div><button class="bp full" onclick="go(\'newSession\')" style="margin-bottom:10px">New ladder</button>'+(al.length?al.map(x=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600">'+(x.name||fmtDate(x.date))+'</span><button class="edit-btn" onclick="cloneSession(\''+x.id+'\')">Clone</button><button class="edit-btn" onclick="archiveSession(\''+x.id+'\')">Archive</button></div>').join(''):'<p class="subtext" style="font-size:.78rem">No active ladders.</p>')+(arl.length?'<div style="margin-top:10px"><label class="lbl">Archived</label>'+arl.map(x=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;padding:8px 10px;background:var(--surf2);border-radius:var(--rx);border:1px solid var(--border)"><span style="flex:1;font-size:.82rem;font-weight:600;color:var(--muted)">'+(x.name||fmtDate(x.date))+'</span><button class="edit-btn" onclick="cloneSession(\''+x.id+'\')">Clone</button><button class="edit-btn" onclick="unarchiveSession(\''+x.id+'\')">Restore</button><button class="edit-btn" style="color:var(--danger)" onclick="deleteSession(\''+x.id+'\')">Delete</button></div>').join('')+'</div>':'')+'</div>';
  return h}

function rSessionAdmin(l,ss){let h='<div class="admin-bar-bottom">Ladder admin</div>';
  // Editable ladder settings — court NAMES, rounds, round time, and scoring
  // mode are editable at any point (active or finished). Court COUNT stays
  // creation-only since changing it would invalidate round assignments.
  h+='<div class="admin-section"><div class="admin-section-t">Ladder settings</div>'+[['Name',ss.name||'Untitled','<button class="edit-btn" onclick="editSessionName()">Edit</button>'],['Date',fmtDate(ss.date),'<button class="edit-btn" onclick="editSessionDate()">Edit</button>'],['Start',ss.config.startTime?fmt12(ss.config.startTime):'—','<button class="edit-btn" onclick="editSessionTime()">Edit</button>'],['Location',ss.config.place||'—','<button class="edit-btn" onclick="editSessionPlace()">Edit</button>'],['Courts',ss.config.courtNames?.join(', ')||defaultCourtNames(ss.config.courts).join(', '),'<button class="edit-btn" onclick="editSessionCourtNames()">Edit</button>'],['Rounds',ss.config.rounds,'<button class="edit-btn" onclick="editSessionRounds()">Edit</button>'],['Round time',ss.config.roundMin+' min','<button class="edit-btn" onclick="editSessionRoundTime()">Edit</button>'],['Scoring',ss.config.scoreMode==='points'?'Points':'Win / Loss','<button class="edit-btn" onclick="editSessionScoring()">Edit</button>'],['Participants',gParts(ss,l).length+' players','']].map(([k,v,eb])=>'<div class="cfg-row"><span class="subtext">'+k+'</span><span style="font-weight:600">'+v+' '+(eb||'')+'</span></div>').join('')+'</div>';
  h+='<div class="admin-section"><div class="admin-section-t">Danger zone</div>'+(ss.started&&!ss.finished?'<div style="margin-bottom:6px"><button class="bds full" onclick="restartLadder()">Restart ladder</button></div>':'')+'<div style="display:flex;gap:6px"><button class="bg-btn" style="flex:1" onclick="cloneSession(\''+ss.id+'\')">Clone</button><button class="bg-btn" style="flex:1" onclick="archiveSession(\''+ss.id+'\');go(\'dashboard\',\'overview\')">Archive</button><button class="bd" style="flex:1" onclick="deleteSession(\''+ss.id+'\');go(\'dashboard\',\'overview\')">Delete</button></div></div>';return h}

function rNoLadder(){return'<div style="text-align:center;padding:60px 20px" class="fu"><div style="font-size:2.5rem;margin-bottom:12px">🥒</div><h2 class="heading" style="font-size:1.4rem;color:var(--lime);margin-bottom:8px">Pickle Friends</h2><p class="subtext" style="margin-bottom:24px;line-height:1.6;max-width:320px;margin:0 auto 24px">Pickleball ladder play — automatic lineups, live scoring, and season stats.</p>'+(isAdmin?'<button class="bp" onclick="go(\'newLadder\')" style="padding:14px 28px">Create league</button>':'<p class="subtext">No active leagues yet.</p>')+'</div>'}
function rNoSeason(){let h='<div class="card fu" style="text-align:center;padding:32px"><h3 class="heading" style="font-size:1.1rem;margin-bottom:6px">No seasons yet</h3>'+(isAdmin?'<button class="bp" onclick="go(\'newSeason\')">Create first season</button>':'<p class="subtext">Check back soon!</p>')+'</div>';if(isAdmin){const l=gL();h+='<div class="admin-section fu" style="margin-top:12px"><div class="admin-section-t">League settings</div><div class="cfg-row"><span class="subtext">Name</span><span style="font-weight:600">'+(l?.name||'')+' <button class="edit-btn" onclick="renameLadder()">Edit</button></span></div><div style="display:flex;gap:6px;margin-top:10px"><button class="bp" style="flex:1" onclick="go(\'newLadder\')">New league</button><button class="bd" style="flex:1" onclick="deleteLadderAction()">Delete</button></div></div>'}return h}

// ══ HOME ══
// Cross-league landing hub. Aggregates every non-archived, not-yet-finished
// ladder (session) across all leagues + seasons, soonest-first, and offers a
// vertical league list (admin can reorder here). Replaces the old horizontally
// scrolling league tab bar as the primary way to navigate between leagues.
function rHome(){
  const today=new Date();today.setHours(0,0,0,0);
  const relDay=(d)=>{try{const dt=new Date(d+'T12:00:00');dt.setHours(0,0,0,0);const diff=Math.round((dt-today)/86400000);if(diff===0)return'Today';if(diff===1)return'Tomorrow';if(diff>1&&diff<7)return dt.toLocaleDateString('en-US',{weekday:'long'});return null}catch{return null}};

  const items=[];
  ladders.forEach(L=>{(L.seasons||[]).filter(se=>!se.archived).forEach(se=>{(se.sessions||[]).filter(ss=>!ss.archived&&!ss.finished).forEach(ss=>{items.push({L,se,ss})})})});
  items.sort((a,b)=>((a.ss.date||'').localeCompare(b.ss.date||''))||((a.ss.config?.startTime||'').localeCompare(b.ss.config?.startTime||'')));

  let h='<div class="card fu"><div class="overline">Pickleballers</div><h2 class="heading" style="font-size:1.3rem;color:var(--lime)">Upcoming Ladders</h2><div class="subtext" style="margin-top:4px">'+(items.length?items.length+' ladder'+(items.length!==1?'s':'')+' across '+ladders.length+' league'+(ladders.length!==1?'s':''):'Nothing on the schedule right now')+'</div></div>';

  if(!ladders.length){
    h+='<div style="text-align:center;padding:40px 20px" class="fu"><div style="font-size:2.5rem;margin-bottom:12px">🥒</div>'+(isAdmin?'<button class="bp" onclick="go(\'newLadder\')" style="padding:14px 28px">Create league</button>':'<p class="subtext">No leagues yet. Check back soon!</p>')+'</div>';
    return h;
  }

  const homeCard=(it)=>{const x=it.ss,L=it.L;const nParts=x.participants?x.participants.length:L.players.filter(p=>p.active!==false).length;const st=(x.started&&x.liveStarted===false)?'<span class="pill" style="background:rgba(255,204,0,0.12);color:#ffcc00;border:0.5px solid rgba(255,204,0,0.3)">Lineups posted</span>':x.started?'<span class="pill live"><span class="dot"></span>Rd '+(x.currentRound+1)+'</span>':'<span class="pill draft">Upcoming</span>';const rd=relDay(x.date);const rdTag=rd?'<span style="display:inline-block;background:var(--lime-dim);color:var(--lime);border:0.5px solid var(--lime-bd);border-radius:6px;font-size:10px;font-weight:800;padding:1px 7px;margin-right:6px">'+rd+'</span>':'';return'<button class="sc" onclick="openHomeLadder(\''+L.id+'\',\''+it.se.id+'\',\''+x.id+'\')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="min-width:0"><div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">'+L.name+'</div><div style="font-weight:700;font-size:var(--st-name,.92rem)">'+rdTag+(x.name||fmtDate(x.date))+'</div><div class="subtext" style="font-size:var(--st-hdr,.72rem);margin-top:3px">'+fmtDate(x.date)+(x.config?.startTime?' · '+fmt12(x.config.startTime):'')+' · '+nParts+' players · '+(x.config?.courts||0)+' courts'+(x.config?.place?' · '+x.config.place:'')+'</div></div>'+st+'</div></button>'};

  if(!items.length)h+='<div class="card fu"><p class="subtext" style="text-align:center;padding:20px">No upcoming ladders scheduled. Pick a league below to view standings and past results.</p></div>';
  else h+='<div class="card fu"><h3 class="card-t">Schedule</h3>'+items.map(homeCard).join('')+'</div>';

  const ol=orderedLadders();
  h+='<div class="card fu"><h3 class="card-t">Leagues</h3>'+ol.map((L,i)=>{const arrowBtn=(dir,dis,gly)=>'<button onclick="event.stopPropagation();moveLadder(\''+L.id+'\','+dir+')" '+(dis?'disabled':'')+' style="border:1px solid var(--border-s);background:var(--surf1);color:'+(dis?'var(--border-s)':'var(--muted)')+';border-radius:6px;width:30px;height:24px;cursor:'+(dis?'default':'pointer')+';font-size:.7rem;line-height:1;padding:0">'+gly+'</button>';let row='<div style="display:flex;align-items:stretch;gap:6px;margin-bottom:8px">';row+='<button class="sc" style="flex:1;margin:0" onclick="selectLadder(\''+L.id+'\')"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;font-size:var(--st-name,.9rem)">'+L.name+'</span><span class="subtext" style="font-size:.7rem">View →</span></div></button>';if(isAdmin)row+='<div style="display:flex;flex-direction:column;gap:2px;justify-content:center">'+arrowBtn(-1,i===0,'▲')+arrowBtn(1,i===ol.length-1,'▼')+'</div>';return row+'</div>'}).join('')+'</div>';
  return h;
}

function rOverview(l,s,stats){const as=s.sessions.filter(x=>!x.archived);let h='<div class="card fu"><div class="overline">Current season</div><h2 class="heading" style="font-size:1.2rem;color:var(--lime)">'+s.name+'</h2><div class="subtext" style="margin-top:4px">'+as.length+' ladder'+(as.length!==1?'s':'')+' · '+l.players.filter(p=>p.active!==false).length+' active players</div></div>';
  if(stats.some(x=>x.w+x.l+x.t>0))h+='<div class="chip-grid fu">'+[{l:'Ladders',v:as.filter(x=>x.started).length},{l:'Games',v:Math.floor(stats.reduce((a,x)=>a+x.w+x.l+x.t,0)/2)},{l:'Players',v:l.players.filter(p=>p.active!==false).length},{l:'High Pts',v:stats.reduce((m,x)=>Math.max(m,x.pf),0)}].map(c=>'<div class="chip"><div class="chip-n">'+c.v+'</div><div class="chip-l">'+c.l+'</div></div>').join('')+'</div>';
  if(isAdmin)h+='<button class="bp full" onclick="go(\'newSession\')" style="margin-bottom:12px">New ladder</button>';
  const ladderBtn=(x,dim)=>{const nParts=x.participants?x.participants.length:l.players.filter(p=>p.active!==false).length;const st=x.finished?'<span class="pill ok">Complete</span>':(x.started&&x.liveStarted===false)?'<span class="pill" style="background:rgba(255,204,0,0.12);color:#ffcc00;border:0.5px solid rgba(255,204,0,0.3)">Lineups posted</span>':x.started?'<span class="pill live"><span class="dot"></span>Rd '+(x.currentRound+1)+'</span>':'<span class="pill draft">Upcoming</span>';return'<button class="sc" style="'+(dim?'opacity:.6':'')+';" onclick="openSession(\''+x.id+'\')">'+'<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:700;font-size:var(--st-name,.9rem)">'+(x.name||fmtDate(x.date))+'</div><div class="subtext" style="font-size:var(--st-hdr,.72rem);margin-top:2px">'+fmtDate(x.date)+(x.config.startTime?' · '+fmt12(x.config.startTime):'')+' · '+nParts+' players · '+x.config.courts+' courts'+(x.config.place?' · '+x.config.place:'')+'</div></div>'+st+'</div></button>'};
  if(!as.length){h+='<div class="card fu"><h3 class="card-t">Ladders</h3><p class="subtext" style="text-align:center;padding:20px">No ladders scheduled yet.</p></div>'}
  else{
    const active_ls=[...as].filter(x=>!x.finished).sort((a,b)=>a.date.localeCompare(b.date));
    const done_ls=[...as].filter(x=>x.finished).sort((a,b)=>b.date.localeCompare(a.date));
    if(active_ls.length)h+='<div class="card fu"><h3 class="card-t">Upcoming Ladders</h3>'+active_ls.map(x=>ladderBtn(x,false)).join('')+'</div>';
    if(done_ls.length)h+='<div class="card fu"><h3 class="card-t" style="color:var(--muted)">Completed</h3>'+done_ls.map(x=>ladderBtn(x,true)).join('')+'</div>';}
  return h}


// ══ STANDINGS TAB ══
// Full ranked table, top 10 highlighted, gold/silver/bronze for 1-3, rank delta
function rStandings(stats,season,l){
  if(!season)return'';
  const bonusData=calcBonusPts(season.sessions,l.players);
  const totalPts=(s)=>s.pf+(bonusData[s.id]?.bonus||0);
  const sorted=[...stats].filter(s=>s.w+s.l>0).sort((a,b)=>totalPts(b)-totalPts(a)||(b.pf-b.pa)-(a.pf-a.pa));

  // prev week rank delta
  const prevRankMap={};
  if(season.sessions.filter(x=>x.started).length>=2){
    const prev=season.sessions.filter(x=>x.started).slice(0,-1);
    const ps=calcStats(prev,l.players);
    const pb=calcBonusPts(prev,l.players);
    [...ps].filter(s=>s.w+s.l+s.t>0).sort((a,b)=>(b.pf+(pb[b.id]?.bonus||0))-(a.pf+(pb[a.id]?.bonus||0))||(b.pf-b.pa)-(a.pf-a.pa)).forEach((s,i)=>prevRankMap[s.id]=i+1);}

  const topCtName=(s)=>{const wonCs=(s.roundRes||[]).filter(r=>r.won).map(r=>r.court);if(!wonCs.length)return'--';const best=Math.max(...wonCs);const refSS=season?.sessions?.slice().reverse().find(x=>x.started);const nC=refSS?.config?.courts||4;const idx=(refSS?.config?.courtNames?.length||0)-best;return refSS?.config?.courtNames?.[idx]||String.fromCharCode(65+nC-best)};

  let h='';
  // bonus strip
  h+='<div style="display:flex;background:var(--lime-dim);border:0.5px solid var(--lime-bd);border-radius:8px;overflow:hidden;margin-bottom:12px">';
  [{pos:'1st',b:15},{pos:'2nd',b:10},{pos:'3rd',b:5}].forEach((x,i)=>{
    h+='<div style="flex:1;text-align:center;padding:8px 4px'+(i<2?';border-right:1px solid var(--lime-bd)':'')+'"><div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">'+x.pos+'</div><div style="font-size:16px;font-weight:900;color:var(--lime);line-height:1">+'+x.b+'</div><div style="font-size:8px;color:var(--lime);opacity:.6;margin-top:1px">bonus</div></div>';});
  h+='<div style="flex:1;text-align:center;padding:8px 4px;border-left:1px solid var(--lime-bd)"><div style="font-size:8px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Scope</div><div style="font-size:10px;font-weight:900;color:var(--lime);line-height:1.3">All<br>ladders</div></div></div>';

  if(!sorted.length){h+='<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';return h;}

  // medal colors
  const medalBg=['rgba(255,204,0,0.12)','rgba(180,180,180,0.1)','rgba(205,127,50,0.12)'];
  const medalBd=['rgba(255,204,0,0.35)','rgba(180,180,180,0.25)','rgba(205,127,50,0.3)'];
  const medalCol=['#ffcc00','#c0c0c0','#cd7f32'];
  const medalLabel=['1st','2nd','3rd'];

  h+='<div style="display:flex;flex-direction:column;gap:4px">';
  sorted.forEach((s,i)=>{
    const rank=i+1;
    const wins=bonusData[s.id]?.wins||0;
    const bonus=bonusData[s.id]?.bonus||0;
    const total=totalPts(s);
    const d=s.pf-s.pa;
    const sk=s.streak;
    const skStr=sk>0?'W'+sk:sk<0?'L'+Math.abs(sk):'--';
    const avg=s.roundPts.length?(Math.round(s.pf/s.roundPts.length*10)/10).toFixed(1):'--';
    const tc=topCtName(s);
    const prevRank=prevRankMap[s.id];
    const delta=prevRank&&prevRank!==rank
      ?(prevRank>rank?'<span style="font-size:9px;font-weight:800;color:#4ade80">\u25b2'+(prevRank-rank)+'</span>'
                     :'<span style="font-size:9px;font-weight:800;color:#ff5c47">\u25bc'+(rank-prevRank)+'</span>')
      :(prevRank?'<span style="font-size:9px;color:var(--muted-lt)">\u2014</span>':'');
    const isTop3=rank<=3;
    const isTop10=rank<=10;
    const bg=isTop3?medalBg[rank-1]:isTop10?'var(--surf2)':'transparent';
    const bd=isTop3?medalBd[rank-1]:'var(--border)';
    const rankCol=isTop3?medalCol[rank-1]:rank<=10?'var(--muted)':'var(--muted-lt)';

    h+='<div style="background:'+bg+';border:0.5px solid '+bd+';border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:8px">';
    // rank
    h+='<div style="font-size:var(--st-name,13px);font-weight:900;color:'+rankCol+';width:28px;flex-shrink:0;text-align:center">'+(isTop3?medalLabel[rank-1]:rank)+'</div>';
    // avatar
    const avBg=isTop3?medalBg[rank-1]:'var(--surf3)';
    h+='<div style="width:32px;height:32px;border-radius:50%;background:'+avBg+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:'+rankCol+';flex-shrink:0">'+s.name.slice(0,2).toUpperCase()+'</div>';
    // name + crowns + sub info
    h+='<div style="flex:1;min-width:0"><div style="font-size:var(--st-stat,13px);font-weight:'+(isTop3?'800':'700')+';color:'+(isTop3?'var(--text)':'var(--text-sec)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.name+(wins>0?' '+crownStr(wins):'')+'</div>';
    h+='<div style="font-size:var(--st-hdr,9px);color:var(--muted);margin-top:1px">'+s.w+'W '+s.l+'L'+(bonus>0?' · +'+bonus+' bonus':'')+'</div></div>';
    // delta
    h+='<div style="min-width:24px;text-align:center">'+delta+'</div>';
    // stats mini
    h+='<div style="display:grid;grid-template-columns:repeat(3,36px);gap:4px;text-align:right">';
    h+='<div><div style="font-size:var(--st-stat,10px);font-weight:700;color:'+(d>=0?'var(--lime)':'var(--loss)')+'\">'+(d>0?'+':'')+d+'</div><div style="font-size:var(--st-hdr,7px);color:var(--muted-lt)">+/-</div></div>';
    h+='<div><div style="font-size:var(--st-stat,10px);font-weight:700;color:var(--text-sec)">'+avg+'</div><div style="font-size:var(--st-hdr,7px);color:var(--muted-lt)">avg</div></div>';
    h+='<div><div style="font-size:var(--st-stat,11px);font-weight:900;color:'+(isTop3?rankCol:'var(--lime)')+'">'+total+'</div><div style="font-size:var(--st-hdr,7px);color:var(--muted-lt)">pts</div></div>';
    h+='</div></div>';
  });
  h+='</div>';
  return h;}

// ══ THE KITCHEN — all categories rendered as uniform compact cards (top 5) ══
function rLeaderboard(stats,season,l){
  if(!season)return'';
  const bonusData=calcBonusPts(season.sessions,l.players);
  const totalPts=(s)=>s.pf+(bonusData[s.id]?.bonus||0);
  const sorted=[...stats].filter(s=>s.w+s.l>0).sort((a,b)=>totalPts(b)-totalPts(a));
  const sessions=season.sessions;
  if(!sorted.length)return'<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';

  const refSS0=season.sessions.slice().reverse().find(x=>x.started);
  const nC=refSS0?.config?.courts||4;

  // One unified card renderer. `rows` is an array of {name, val, sub?, id?}.
  // When id is present, the name is wrapped with the player-popup click handler.
  const card=(lbl,desc,heroCol,rows)=>{
    if(!rows||!rows.length)return'';
    let c='<div style="background:var(--surf1);border:0.5px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">';
    c+='<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">';
    c+='<div style="font-size:var(--st-name,11px);font-weight:900;color:'+heroCol+';letter-spacing:.04em">'+lbl+'</div>';
    c+='<div style="font-size:var(--st-hdr,8px);color:var(--muted)">'+desc+'</div></div>';
    rows.slice(0,5).forEach((r,i)=>{
      const rankCol=i===0?heroCol:'var(--muted-lt)';
      const nameCol=i===0?'var(--text)':'var(--text-sec)';
      const valCol=i===0?heroCol:'var(--muted)';
      const fWeight=i===0?'800':'500';
      // Clickable name only when an id is provided
      const nameSpan=r.id
        ? '<span'+pClick(r.id)+' style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:'+nameCol+';cursor:pointer;text-decoration:underline;text-decoration-color:var(--border-s);text-underline-offset:2px">'+r.name+'</span>'
        : '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:'+nameCol+'">'+r.name+'</span>';
      c+='<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:var(--st-stat,12px);font-weight:'+fWeight+'">';
      c+='<div style="width:12px;text-align:center;color:'+rankCol+';font-weight:800">'+(i+1)+'</div>';
      c+='<div style="flex:1;min-width:0">'+nameSpan+'</div>';
      if(r.sub)c+='<div style="font-size:var(--st-hdr,9px);color:var(--muted);font-weight:500">'+r.sub+'</div>';
      c+='<div style="color:'+valCol+';min-width:36px;text-align:right;font-variant-numeric:tabular-nums">'+r.val+'</div>';
      c+='</div>';
    });
    c+='</div>';
    return c;
  };

  const fmtD=(d)=>{const dt=new Date(d+'T12:00:00');return(dt.getMonth()+1)+'/'+dt.getDate();};

  let h='';

  // One-Night Wonder
  const oneNightAll=[];
  sessions.forEach(sess=>{if(!sess||!sess.started)return;const sStats=calcStats([sess],l.players);sStats.forEach(p=>{if(p.pf>0)oneNightAll.push({id:p.id,name:p.name,pts:p.pf,date:sess.date});});});
  oneNightAll.sort((a,b)=>b.pts-a.pts);
  const bestPerPlayer={};oneNightAll.forEach(x=>{if(!bestPerPlayer[x.id])bestPerPlayer[x.id]=x;});
  const oneNightSorted=Object.values(bestPerPlayer).sort((a,b)=>b.pts-a.pts);
  h+=card('\u{1F373} One-Night Wonder','most pts in a single ladder','#ffcc00',
    oneNightSorted.map(x=>({id:x.id,name:x.name,sub:fmtD(x.date),val:x.pts})));

  // King of the Court
  const kingCounts={};
  stats.forEach(s=>{const wins=s.roundRes.filter(x=>x.court===nC&&x.won).length;if(wins>0)kingCounts[s.id]={id:s.id,name:s.name,rounds:wins};});
  const kingSorted=Object.values(kingCounts).sort((a,b)=>b.rounds-a.rounds);
  h+=card('\u{1F451} King of the Court','wins on the top court','#c8ff00',
    kingSorted.map(k=>({id:k.id,name:k.name,val:k.rounds+' W'})));

  // Per-Round Top
  const avgPlayers=stats.filter(s=>s.roundPts.length>=6).map(s=>({id:s.id,name:s.name,avg:Math.round(s.pf/s.roundPts.length*10)/10,games:s.roundPts.length}));
  avgPlayers.sort((a,b)=>b.avg-a.avg);
  h+=card('\u{1F4C8} Per-Round Top','highest avg pts (min 6 games)','#00e5ff',
    avgPlayers.map(p=>({id:p.id,name:p.name,sub:p.games+'g',val:p.avg.toFixed(1)})));

  // Most Points (season)
  const ptsSorted=[...sorted];
  h+=card('\u{1F3C6} Most Points','season total incl. bonus','#85ff44',
    ptsSorted.map(s=>({id:s.id,name:s.name+(bonusData[s.id]?.wins>0?' '+crownStr(bonusData[s.id].wins):''),val:totalPts(s)})));

  // Hot Streak
  const streakSorted=[...stats].filter(s=>s.maxStreak>0).sort((a,b)=>b.maxStreak-a.maxStreak);
  h+=card('\u{1F525} Hot Streak','longest run of wins','#a78bfa',
    streakSorted.map(s=>({id:s.id,name:s.name,val:'W'+s.maxStreak})));

  // Best Duo (no clickable names — pair, not individual)
  const pairs=calcPartners(sessions,l.players).filter(p=>p.w+p.l>=3);
  const pName=(p)=>p.p1.name.split(' ')[0]+' + '+p.p2.name.split(' ')[0];
  h+=card('\u{1F91D} Best Duo','win % (min 3 games together)','#ff5c47',
    pairs.map(p=>({name:pName(p),sub:p.w+'-'+p.l,val:Math.round(p.w/(p.w+p.l)*100)+'%'})));

  // The Wall
  const wallSorted=stats.filter(s=>s.roundPts.length>=6&&s.pa>0).map(s=>({id:s.id,name:s.name,avgPA:s.pa/s.roundPts.length})).sort((a,b)=>a.avgPA-b.avgPA);
  h+=card('\u{1F6E1}\uFE0F The Wall','lowest avg pts allowed (min 6 games)','#85ff44',
    wallSorted.map(p=>({id:p.id,name:p.name,val:p.avgPA.toFixed(1)})));

  // Iron Player
  const ironSorted=[...stats].filter(s=>s.attended>0).sort((a,b)=>b.attended-a.attended);
  h+=card('\u2693 Iron Player','most ladders attended','#f472b6',
    ironSorted.map(s=>({id:s.id,name:s.name,val:String(s.attended)})));

  // Big Mover
  const moverAll={};
  sessions.forEach(sess=>{if(!sess||!sess.started)return;const sStats=calcStats([sess],l.players);sStats.forEach(p=>{if(!p.courtHist.length)return;const courts=p.courtHist.map(x=>x.court);const climb=Math.max(...courts)-Math.min(...courts);if(climb<=0)return;if(!moverAll[p.id]||moverAll[p.id].climb<climb){moverAll[p.id]={id:p.id,name:p.name,climb,date:sess.date};}});});
  const moverSorted=Object.values(moverAll).sort((a,b)=>b.climb-a.climb);
  h+=card('\u{1F4CA} Big Mover','biggest court climb in a ladder','#60a5fa',
    moverSorted.map(p=>({id:p.id,name:p.name,sub:fmtD(p.date),val:'+'+p.climb})));

  // Beat Down (biggest single-game point margin per player)
  const beatDownAll=[];
  stats.forEach(s=>{s.roundRes.forEach(r=>{if(r.won&&r.diff>0)beatDownAll.push({id:s.id,name:s.name,diff:r.diff,rd:r.round});});});
  beatDownAll.sort((a,b)=>b.diff-a.diff);
  const beatBest={};beatDownAll.forEach(x=>{if(!beatBest[x.id])beatBest[x.id]=x;});
  const beatSorted=Object.values(beatBest).sort((a,b)=>b.diff-a.diff);
  h+=card('\u{1F4A5} Beat Down','biggest single-game margin','#fb923c',
    beatSorted.map(p=>({id:p.id,name:p.name,sub:'Rd '+p.rd,val:'+'+p.diff})));

  // Comeback Kid
  const comebackCounts={};
  stats.forEach(s=>{let count=0;for(let i=1;i<s.roundRes.length;i++){if(s.roundRes[i].won&&!s.roundRes[i-1].won)count++;}if(count>0)comebackCounts[s.id]={id:s.id,name:s.name,count};});
  const comebackSorted=Object.values(comebackCounts).sort((a,b)=>b.count-a.count);
  h+=card('\u{1F3A2} Comeback Kid','wins after a loss','#e879f9',
    comebackSorted.map(p=>({id:p.id,name:p.name,val:String(p.count)})));

  // Highest Single Game
  const gamePeaks=[];
  stats.forEach(s=>{s.roundRes.forEach(r=>{gamePeaks.push({id:s.id,name:s.name,pts:r.pf,rd:r.round,won:r.won})})});
  gamePeaks.sort((a,b)=>b.pts-a.pts);
  const topGames=[];const seenG=new Set();
  gamePeaks.forEach(g=>{if(!seenG.has(g.id)){seenG.add(g.id);topGames.push(g)}});
  h+=card('\u{1F3AF} Highest Single Game','most pts in one round','#a78bfa',
    topGames.map(g=>({id:g.id,name:g.name,sub:'Rd '+g.rd,val:g.pts})));

  return h;}

// ══ LEADERBOARD TAB — uniform table with Diff column ══
// Every player gets the same row layout. Top 3 keep gold/silver/bronze rank
// labels + total color + a faint row tint, but the column structure is
// identical across the table. Tap any row to open the player profile modal.
function rFullStats(stats,season,l){
  if(!season)return'';
  const isLight=theme==='hc-light';
  const bonusData=calcBonusPts(season.sessions,l.players);
  const totalPts=(s)=>s.pf+(bonusData[s.id]?.bonus||0);
  // Skip temp/one-round subs on the season leaderboard. Their per-ladder
  // stats still display in the session view, but they don\u2019t pollute
  // season standings.
  const isTemp=(id)=>!!l.players.find(p=>p.id===id&&p.temp);
  const sorted=[...stats].filter(s=>s.w+s.l+s.t>0&&!isTemp(s.id)).sort((a,b)=>totalPts(b)-totalPts(a)||(b.pf-b.pa)-(a.pf-a.pa));
  if(!sorted.length)return'<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';

  const prevRankMap={};
  const hasPrev=season.sessions.filter(x=>x.started).length>=2;
  if(hasPrev){
    const prev=season.sessions.filter(x=>x.started).slice(0,-1);
    const ps=calcStats(prev,l.players);
    const pb=calcBonusPts(prev,l.players);
    [...ps].filter(s=>s.w+s.l+s.t>0&&!isTemp(s.id)).sort((a,b)=>(b.pf+(pb[b.id]?.bonus||0))-(a.pf+(pb[a.id]?.bonus||0))||(b.pf-b.pa)-(a.pf-a.pa)).forEach((s,i)=>prevRankMap[s.id]=i+1);
  }

  let h='';
  // Bonus strip
  h+='<div style="display:flex;background:'+(isLight?'var(--lime-dim)':'#0d1400')+';border:0.5px solid '+(isLight?'var(--lime-bd)':'rgba(200,255,0,0.15)')+';border-radius:8px;overflow:hidden;margin-bottom:8px">';
  [{p:'1st',b:15},{p:'2nd',b:10},{p:'3rd',b:5}].forEach((x,i)=>{
    h+='<div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid '+(isLight?'var(--lime-bd)':'rgba(200,255,0,0.1)')+'"><div style="font-size:8px;font-weight:700;color:'+(isLight?'var(--muted)':'rgba(255,255,255,0.3)')+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">'+x.p+'</div><div style="font-size:16px;font-weight:900;color:var(--lime);line-height:1">+'+x.b+'</div><div style="font-size:8px;color:'+(isLight?'var(--lime)':'rgba(200,255,0,0.4)')+';opacity:'+(isLight?'.7':'1')+';margin-top:1px">bonus</div></div>';
  });
  h+='<div style="flex:1;text-align:center;padding:8px 4px"><div style="font-size:8px;font-weight:700;color:'+(isLight?'var(--muted)':'rgba(255,255,255,0.3)')+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Scope</div><div style="font-size:10px;font-weight:900;color:var(--lime);line-height:1.3">All<br>ladders</div></div></div>';

  // Hint about the row-tap profile popup so users know what they get
  h+='<div style="font-size:var(--st-stat,10px);color:var(--muted);text-align:center;line-height:1.5;padding:0 4px 8px">Tap a row for expanded Player Profile Stats.</div>';

  // Uniform table — top 3 differ only by rank label color, total color, and row tint
  const podLabel=['1st','2nd','3rd'];
  const podCol=['#ffcc00','#c0c0c0','#cd7f32'];
  const podBg=['rgba(255,204,0,0.08)','rgba(180,180,180,0.06)','rgba(205,127,50,0.08)'];
  // Add a Dink Rating column on the right. New grid: rank, delta, player, W, L, Diff, Bonus, Total, DR
  const cols='28px 24px 1fr 24px 24px 36px 38px 42px 38px';
  // Composite skill rating per player — same calc used in the Full Stats table.
  const drRatings=calcDinkRating(stats,season.sessions,l.players);
  h+='<div style="background:var(--surf1);border:0.5px solid var(--border);border-radius:10px;overflow:hidden">';
  h+='<div style="display:grid;grid-template-columns:'+cols+';gap:5px;padding:7px 12px;background:var(--surf2);border-bottom:1px solid var(--border);font-size:var(--st-hdr,8px);font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">';
  ['#','\u0394','Player','W','L','Diff','Bonus','Total','DR'].forEach((c,j)=>{
    const align=j===2?'left':j===1?'center':'right';
    const extra=c==='DR'?';color:#a78bfa;border-left:1px solid rgba(167,139,250,0.25);padding-left:4px':'';
    h+='<div style="text-align:'+align+extra+'">'+c+'</div>';
  });
  h+='</div>';

  sorted.forEach((s,i)=>{
    const rank=i+1;
    const wins=bonusData[s.id]?.wins||0;
    const bonus=bonusData[s.id]?.bonus||0;
    const total=s.pf+bonus;
    const d=s.pf-s.pa;
    const isPod=rank<=3;
    const rankColor=isPod?podCol[rank-1]:'var(--muted)';
    const totalColor=isPod?podCol[rank-1]:'var(--lime)';
    const stripeBg=isPod?podBg[rank-1]:(i%2===1?'var(--surf2)':'transparent');
    h+='<div'+pClick(s.id)+' style="display:grid;grid-template-columns:'+cols+';gap:5px;padding:9px 12px;border-bottom:0.5px solid var(--border);background:'+stripeBg+';align-items:center;font-variant-numeric:tabular-nums'+pCur()+'">';
    h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:'+(isPod?'700':'400')+';color:'+rankColor+'">'+(isPod?podLabel[rank-1]:rank)+'</div>';
    h+='<div style="text-align:center;font-size:9px">'+renderDelta(prevRankMap[s.id],rank,hasPrev)+'</div>';
    h+='<div style="font-size:var(--st-name,13px);font-weight:700;color:'+(isPod?'var(--text)':'var(--text-sec)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.name+(wins>0?' '+crownStr(wins):'')+'</div>';
    h+='<div style="text-align:right;font-size:var(--st-stat,12px);font-weight:700;color:var(--lime)">'+s.w+'</div>';
    h+='<div style="text-align:right;font-size:var(--st-stat,12px);color:var(--muted)">'+s.l+'</div>';
    h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:'+(d>=0?'700':'400')+';color:'+(d>0?'var(--lime)':d<0?'#ff5c47':'var(--muted)')+'">'+(d>0?'+':'')+d+'</div>';
    h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:800;color:'+(bonus>0?'var(--lime)':'var(--muted-lt)')+'">'+(bonus>0?'+'+bonus:'\u2014')+'</div>';
    h+='<div style="text-align:right;font-size:var(--st-stat,13px);font-weight:900;color:'+totalColor+'">'+total+'</div>';
    const dr=drRatings[s.id];const drStr=dr!=null?dr:'\u2014';
    h+='<div style="text-align:right;font-size:var(--st-rank,11px);font-weight:900;color:#a78bfa;border-left:1px solid rgba(167,139,250,0.18);padding-left:4px;font-family:\'Sora\',sans-serif">'+drStr+'</div>';
    h+='</div>';
  });
  h+='</div>';
  return h;}


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
  h+='<header class="hdr">';
  h+='<div class="hdr-accent-bar"></div>';
  h+='<div class="hdr-row"><div class="hdr-left">';
  h+='<div class="hdr-logo" onclick="goHome()" style="cursor:pointer" title="Home"><span class="hdr-logo-text">DS</span></div>';
  const onHome=view==='home';
  h+='<div'+(onHome?'':' onclick="goHome()" style="cursor:pointer"')+'><h1 class="hdr-title">'+(onHome?'Dink Society':(l?.name||'Dink Society'))+'</h1>'+((s&&!onHome)?'<div class="hdr-sub">'+s.name+'</div>':'')+'</div>';
  h+='</div>';
  // ── Header right: admin badge + accessibility button ──
  h+='<div class="hdr-right">';
  if(isAdmin)h+='<div class="hdr-admin-badge">Admin</div>';
  h+='<button onclick="'+(isAdmin?'lockAdmin()':'openPin()')+'" style="background:'+(isAdmin?'rgba(255,92,71,0.12)':'rgba(255,255,255,0.06)')+';border:1px solid '+(isAdmin?'rgba(255,92,71,0.35)':'rgba(255,255,255,0.12)')+';color:'+(isAdmin?'#ff5c47':'var(--muted-lt)')+';font-size:10px;font-weight:800;padding:5px 10px;border-radius:20px;cursor:pointer;letter-spacing:.04em;white-space:nowrap;font-family:Inter,sans-serif">'+(isAdmin?'Lock Admin':'🔐 Admin')+'</button>';
  {const szLabels={sm:'S',md:'M',lg:'L',xl:'XL',xxl:'XXL'};
  const thOpts=[{k:'hc-dark',label:'Dark',dot:'dot-hc-dark'},{k:'hc-light',label:'Light',dot:'dot-hc-light'}];
  h+='<div class="access-hdr-wrap">';
  if(accessPanelOpen){
    h+='<div class="access-panel">';
    h+='<div class="access-panel-lbl">Text size</div>';
    h+='<div class="access-sz-row">';
    ['sm','md','lg','xl','xxl'].forEach(sz=>{h+='<button class="access-sz-btn sz-'+sz+(textSize===sz?' active':'')+'" onclick="setTextSize(\''+sz+'\')">'+szLabels[sz]+'</button>';});
    h+='</div>';
    h+='<div class="access-panel-lbl">Theme</div>';
    h+='<div class="access-theme-row">';
    thOpts.forEach(t=>{h+='<button class="access-theme-btn'+(theme===t.k?' active':'')+'" onclick="setTheme(\''+t.k+'\')">';h+='<span class="access-theme-dot '+t.dot+'"></span>'+t.label+'</button>';});
    h+='</div></div>';
  }
  h+='<button class="access-fab-btn hdr-aa-btn" onclick="toggleAccessPanel()" aria-label="Accessibility options">';
  h+='<div class="access-fab-aa"><span class="small-a">A</span><span class="big-a">A</span></div>';
  h+='</button></div>';}
  h+='</div>';
  h+='</div>';

  if(view==='session'){
    if(isAdmin){
      const tabs=['Play','Roster','Stats','Admin'];
      h+='<div class="tabs">';
      tabs.forEach(t=>h+='<button class="tab'+(tab===t.toLowerCase()?' active':'')+'" onclick="tab=\''+t.toLowerCase()+'\';render()">'+t+'</button>');
      h+='<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go(\'dashboard\',\'ladders\')">← Back</button></div>';
    } else {
      const pTab=tab==='courtboard'||tab==='ladder'?'courtboard':tab;
      h+='<div class="tabs">';
      h+='<button class="tab'+(pTab==='info'?' active':'')+'" onclick="tab=\'info\';render()">Info</button>';
      h+='<button class="tab'+(pTab==='courtboard'?' active':'')+'" onclick="tab=\'courtboard\';render()">Ladder</button>';
      h+='<button class="tab'+(pTab==='roster'?' active':'')+'" onclick="tab=\'roster\';render()">Pickleballers</button>';
      h+='<button class="tab'+(pTab==='stats'?' active':'')+'" onclick="tab=\'stats\';render()">Stats</button>';
      h+='<button class="tab" style="margin-left:auto;font-size:.68rem" onclick="go(\'dashboard\',\'ladders\')">← Back</button></div>';
    }
  } else if(view==='dashboard'&&s){
    // Standings + Search merged into Leaderboard (the old wide table). Players
    // tab is admin-only now — public lookups happen via the player popup.
    // Tab keys stay stable so saved state still works; obsolete keys redirect
    // in the route table below.
    const dtabsPublic=[
      ['Ladders','ladders'],
      ['Leaderboard','stats'],
      ['The Kitchen','leaderboard'],
      ['Rules','rules']
    ];
    const dtabsAdmin=[
      ['Ladders','ladders'],
      ['Leaderboard','stats'],
      ['The Kitchen','leaderboard'],
      ['Players','players'],
      ['Rules','rules'],
      ['Admin','admin']
    ];
    const dtabs=isAdmin?dtabsAdmin:dtabsPublic;
    h+='<div class="tabs">';
    dtabs.forEach(([label,k])=>{
      const on=k==='ladders'?(tab==='overview'||tab==='ladders'):tab===k;
      h+='<button class="tab'+(on?' active':'')+'" onclick="tab=\''+k+'\';render()">'+label+'</button>';
    });
    h+='</div>';
  }
  h+='</header><div class="content">';

  // League switcher — compact and mobile-friendly. A Home button returns to the
  // cross-league hub; a native dropdown (uses the OS picker on mobile) switches
  // leagues without a horizontally scrolling tab strip. League reordering now
  // lives on the Home page's Leagues list.
  if(view==='dashboard'){
    h+='<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">';
    h+='<button onclick="goHome()" style="flex-shrink:0;display:flex;align-items:center;gap:5px;padding:8px 12px;border-radius:var(--rx);border:1.5px solid var(--border-s);background:var(--surf1);color:var(--muted);font-family:\'Sora\',sans-serif;font-size:.76rem;font-weight:700;cursor:pointer;white-space:nowrap">← Home</button>';
    if(ladders.length>1)h+='<select onchange="selectLadder(this.value)" style="flex:1;min-width:0;padding:8px 12px;border-radius:var(--rx);border:1.5px solid var(--lime-bd);background:var(--lime-dim);color:var(--lime);font-family:\'Sora\',sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23c8ff00%22 stroke-width=%223%22><path d=%22M6 9l6 6 6-6%22/></svg>\');background-repeat:no-repeat;background-position:right 10px center;padding-right:30px">'+orderedLadders().map(x=>'<option value="'+x.id+'"'+(x.id===activeLadderId?' selected':'')+'>'+x.name+'</option>').join('')+'</select>';
    else h+='<div style="flex:1;font-family:\'Sora\',sans-serif;font-size:.85rem;font-weight:800;color:var(--lime);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(gL()?.name||'')+'</div>';
    h+='</div>';
  }

  if(view==='newLadder')h+=rNewLadder();
  else if(view==='newSeason')h+=rNewSeason();
  else if(view==='newSession')h+=rNewSession();
  else if(view==='home')h+=rHome();
  else if(!l)h+=rNoLadder();
  else if(view==='dashboard'){
    if(!s)h+=rNoSeason();
    else if(tab==='overview'||tab==='ladders')h+=rOverview(l,s,stats);
    else if(tab==='leaderboard')h+=rLeaderboard(stats,s,l);
    // 'standings' and 'search' redirected here — the merged Leaderboard
    // covers both. Old saved tab values keep working.
    else if(tab==='stats'||tab==='standings'||tab==='search')h+=rFullStats(stats,s,l);
    else if(tab==='players'&&isAdmin)h+=rPlayers(l);
    else if(tab==='rules')h+=rRules(null);
    else if(tab==='admin'&&isAdmin)h+=rAdmin(l,s);
    else h+=rOverview(l,s,stats)}
  else if(view==='session'&&ss){
    if(isAdmin){
      if(tab==='play')h+=rPlay(l,ss);
      else if(tab==='roster')h+=rSessionRoster(l,ss);
      else if(tab==='stats')h+=rStats(sStats,null,l,ss);
      else if(tab==='admin')h+=rSessionAdmin(l,ss)}
    else{
      if(tab==='info')h+=rLadderInfo(l,ss);
      else if(tab==='courtboard'||tab==='ladder')h+=rPlayerView(l,ss);
      else if(tab==='roster')h+=rSessionRoster(l,ss);
      else if(tab==='stats')h+=rStats(sStats,null,l,ss);
      else{tab='info';h+=rLadderInfo(l,ss)}}}

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
      // Ties are not allowed in this format. Once both scores match, lock the
      // modal so the admin can't dismiss without picking a winner. ⌫ still
      // works so they can fix it.
      const isTied=bothDone&&t1val===t2val;
      const cur=npState.value===''?'--':npState.value;
      const isNpLight=theme==='hc-light';
      const npTieAcc=isNpLight?'#cc2200':'#ff5c47';
      const npModalBg=isNpLight?'#ffffff':'#111118';
      const npNumBg=isNpLight?'#f0f0f0':'#0e0e1a';
      const npNumCol=isNpLight?'#000':'#f4f4f0';
      const npGridBg=isNpLight?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.06)';
      const backdropClose=' onclick="npCancel()"';
      const modalBorder=isTied
        ?('border:1.5px solid '+(isNpLight?'#cc2200':'rgba(255,92,71,0.55)')+';box-shadow:0 0 0 4px '+(isNpLight?'rgba(200,0,0,0.08)':'rgba(255,92,71,0.15)'))
        :('border:1px solid '+(isNpLight?'rgba(0,0,0,0.15)':'rgba(255,255,255,0.1)'));
      const headerBg=isTied?(isNpLight?'#fff5f5':'#1a0606'):(isNpLight?'#f0f0f0':'#0e0e1a');
      const headerBd='border-bottom:1px solid '+(isTied?(isNpLight?'rgba(200,0,0,0.2)':'rgba(255,92,71,0.3)'):(isNpLight?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.07)'));
      const headerLabel=isTied?'COURT '+nm2+' · TIED':'Court '+nm2;
      const headerLabelCol=isTied?npTieAcc:col2;
      const headerSub=isTied?'Which team advances?':'Enter scores';
      const headerSubCol=isTied?npTieAcc:(isNpLight?'#111':'#f4f4f0');
      let ov='<div style="position:fixed;inset:0;background:'+(isNpLight?'rgba(0,0,0,0.45)':'rgba(0,0,0,0.8)')+';z-index:500;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:16px;backdrop-filter:blur(6px)"'+backdropClose+'>';
      ov+='<div style="background:'+npModalBg+';border-radius:20px;width:100%;max-width:380px;'+modalBorder+';overflow:hidden" onclick="event.stopPropagation()">';
      ov+='<div style="background:'+headerBg+';padding:12px 16px;'+headerBd+';display:flex;justify-content:space-between;align-items:center">';
      ov+='<div><div style="font-size:9px;font-weight:900;color:'+headerLabelCol+';text-transform:uppercase;letter-spacing:.1em">'+headerLabel+'</div><div style="font-size:13px;font-weight:700;color:'+headerSubCol+';margin-top:2px">'+headerSub+'</div></div>';
      ov+='<button onclick="npCancel()" style="background:'+(isNpLight?'rgba(0,0,0,0.07)':'rgba(255,255,255,0.07)')+';border:none;color:'+(isNpLight?'#333':'#7a7a8a')+';font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2715;</button>';
      ov+='</div>';
      if(isTied){
        const mvBg=isNpLight?'#000':'rgba(255,255,255,0.9)';
        const mvCol=isNpLight?'#fff':'#000';
        ov+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 14px 0">';
        ov+='<button onclick="setTieA('+npState.ri+','+npState.ci+')" style="background:'+mvBg+';border:none;border-radius:10px;padding:10px 6px;font-size:11px;font-weight:900;color:'+mvCol+';cursor:pointer;letter-spacing:.04em">Moves Up ↑</button>';
        ov+='<button onclick="setTieB('+npState.ri+','+npState.ci+')" style="background:'+mvBg+';border:none;border-radius:10px;padding:10px 6px;font-size:11px;font-weight:900;color:'+mvCol+';cursor:pointer;letter-spacing:.04em">Moves Up ↑</button>';
        ov+='</div>';
      }
      ov+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:'+(isTied?'4px':'12px')+' 14px 0;border-radius:12px;overflow:hidden">';
      const t1active=npState.field==='t1';
      const t1border=t1active?('border:2px solid '+col2+';'):('border:2px solid '+(isNpLight?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.1)')+';');
      const t1bg=t1active?(isNpLight?'background:#e8f0ff':'background:#000e18'):(isNpLight?'background:#f5f5f5':'background:#0a0a14');
      const t1score=t1val!==null&&!t1active?String(t1val):(t1active?cur:'--');
      const t1col=t1val!==null&&!t1active?col2:(isNpLight?'rgba(0,0,0,0.15)':'rgba(255,255,255,0.15)');
      ov+='<div style="'+t1bg+';padding:12px 8px;text-align:center;'+t1border+'border-radius:12px 0 0 12px;cursor:pointer" onclick="npSwitchField(\'t1\',' + (t1val!==null?t1val:'null') + ')">';
      ov+='<div style="font-size:8px;font-weight:900;color:'+(t1active?col2:(isNpLight?'#888':'#555'))+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">'+t1names+'</div>';
      ov+='<div style="font-size:44px;font-weight:900;color:'+(t1active?col2:t1col)+';line-height:1;letter-spacing:-.03em">'+(t1active?cur:t1score)+'</div>';
      ov+='<div style="font-size:8px;margin-top:5px;color:'+(t1val!==null&&!t1active?col2:(isNpLight?'#aaa':'#444'))+';">'+(t1val!==null&&!t1active?'✓ Entered':t1active?'← Entering now':'--')+'</div>';
      ov+='</div>';
      const t2active=npState.field==='t2';
      const t2border=t2active?('border:2px solid '+col2+';'):('border:2px solid '+(isNpLight?'rgba(0,0,0,0.12)':'rgba(255,255,255,0.1)')+';');
      const t2bg=t2active?(isNpLight?'background:#e8f0ff':'background:#000e18'):(isNpLight?'background:#f5f5f5':'background:#0a0a14');
      const t2score=t2val!==null&&!t2active?String(t2val):(t2active?cur:'--');
      const t2col=t2val!==null&&!t2active?col2:(isNpLight?'rgba(0,0,0,0.15)':'rgba(255,255,255,0.15)');
      ov+='<div style="'+t2bg+';padding:12px 8px;text-align:center;'+t2border+'border-radius:0 12px 12px 0;cursor:pointer" onclick="npSwitchField(\'t2\',' + (t2val!==null?t2val:'null') + ')">';
      ov+='<div style="font-size:8px;font-weight:900;color:'+(t2active?col2:(isNpLight?'#888':'#555'))+';text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">'+t2names+'</div>';
      ov+='<div style="font-size:44px;font-weight:900;color:'+(t2active?col2:t2col)+';line-height:1;letter-spacing:-.03em">'+(t2active?cur:t2score)+'</div>';
      ov+='<div style="font-size:8px;margin-top:5px;color:'+(t2val!==null&&!t2active?col2:(isNpLight?'#aaa':'#444'))+';">'+(t2val!==null&&!t2active?'✓ Entered':t2active?'← Entering now':'--')+'</div>';
      ov+='</div></div>';
      if(bothDone&&!isTied){
        ov+='<div style="padding:14px 14px 6px"><button onclick="npState=null;render()" style="width:100%;background:'+(isNpLight?'#000':'#c8ff00')+';border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:900;color:'+(isNpLight?'#fff':'#000')+';cursor:pointer">✓ Confirm '+t1val+' – '+t2val+'</button></div>';
      }
      ov+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:'+npGridBg+';margin:'+(bothDone?'8px':'0')+' 14px 14px;border-radius:12px;overflow:hidden">';
      [1,2,3,4,5,6,7,8,9].forEach(d=>{ov+='<button onclick="npPress(\''+d+'\')" style="background:'+npNumBg+';padding:16px 0;text-align:center;font-size:20px;font-weight:700;color:'+npNumCol+';cursor:pointer;border:none;width:100%">'+d+'</button>'});
      ov+='<button onclick="npDel()" style="background:'+(isNpLight?(isTied?'#fff5f5':npNumBg):(isTied?'#1a0606':npNumBg))+';padding:16px 0;text-align:center;font-size:16px;color:'+npTieAcc+';cursor:pointer;border:none">⌫</button>';
      ov+='<button onclick="npPress(\'0\')" style="background:'+npNumBg+';padding:16px 0;text-align:center;font-size:20px;font-weight:700;color:'+npNumCol+';cursor:pointer;border:none">0</button>';
      ov+='<button onclick="npConfirm()" style="background:'+(isNpLight?'#000':'#c8ff00')+';padding:16px 0;text-align:center;font-size:12px;font-weight:900;color:'+(isNpLight?'#fff':'#000')+';cursor:pointer;border:none">SET &rarr;</button>';
      ov+='</div>';
      ov+='</div></div>';
      h+=ov;}}

  // ── Player profile modal (public-side only) ──
  // Shows the same stat-card markup as the Search tab so users get one
  // consistent view of a player's season performance no matter where they
  // tapped from. Skipped entirely for admins — see openPlayerStats().
  if(playerStatsModalId){
    const lp=gL();const sp=gS();
    if(lp&&sp){
      const allStatsP=calcStats(sp.sessions,lp.players);
      const bonusDataP=calcBonusPts(sp.sessions,lp.players);
      const totalPtsP=(st)=>st.pf+(bonusDataP[st.id]?.bonus||0);
      const sortedP=[...allStatsP].filter(st=>st.w+st.l+st.t>0).sort((a,b)=>totalPtsP(b)-totalPtsP(a)||(b.pf-b.pa)-(a.pf-a.pa));
      const topCtNameP=(st)=>{const wonCs=(st.roundRes||[]).filter(r=>r.won).map(r=>r.court);if(!wonCs.length)return'--';const best=Math.max(...wonCs);const refSS=sp.sessions.slice().reverse().find(x=>x.started);const nC=refSS?.config?.courts||4;const idx=(refSS?.config?.courtNames?.length||0)-best;return refSS?.config?.courtNames?.[idx]||String.fromCharCode(65+nC-best)};
      const target=sortedP.find(st=>st.id===playerStatsModalId);
      const isLightM=theme==='hc-light';
      let pv='<div style="position:fixed;inset:0;background:'+(isLightM?'rgba(0,0,0,0.6)':'rgba(0,0,0,0.85)')+';z-index:500;display:flex;justify-content:center;align-items:flex-start;padding:24px 14px;backdrop-filter:blur(6px);overflow-y:auto" onclick="closePlayerStats()">';
      pv+='<div style="width:100%;max-width:420px" onclick="event.stopPropagation()">';
      pv+='<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button onclick="closePlayerStats()" style="background:'+(isLightM?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.07)')+';border:none;color:'+(isLightM?'#333':'#7a7a8a')+';font-size:18px;width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">&#x2715;</button></div>';
      if(target){
        // Reuse the search card builder by passing the exact player name so
        // the helper renders just this one card.
        const mvpCountP=calcMvpCount(sp.sessions,lp);
        const _refSSP=sp.sessions.slice().reverse().find(x=>x.started);
        const courtNamesP=_refSSP?.config?.courtNames||null;
        pv+=_buildSearchCardsHTML(target.name.toLowerCase(),sortedP,bonusDataP,topCtNameP,mvpCountP,courtNamesP);
      // ── Per-ladder collapsible court movement charts ──
      const _allSess=sp.sessions.filter(se=>se.started);
      // Most-recent first
      const _playerSess=_allSess.slice().reverse().filter(se=>{
        const _ps=calcStats([se],lp.players).find(x=>x.id===playerStatsModalId);
        return _ps&&(_ps.w+_ps.l+_ps.t>0);
      });
      if(_playerSess.length){
        pv+='<div style="margin-top:8px">';
        pv+='<div style="font-size:9px;font-weight:700;letter-spacing:.12em;color:'+(isLightM?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.3)')+';text-transform:uppercase;padding:4px 4px 8px">Court movement — per ladder</div>';
        _playerSess.forEach((se,idx)=>{
          const _seStats=calcStats([se],lp.players);
          const _pStat=_seStats.find(x=>x.id===playerStatsModalId);
          if(!_pStat||!_pStat.roundRes.length)return;
          const _rr=_pStat.roundRes;
          const _nC=Math.max(se.config?.courts||2,se.config?.courtNames?.length||2,..._rr.map(r=>r.court));
          const _cN=se.config?.courtNames||null;
          const _wins=_rr.filter(r=>r.won).length;
          const _losses=_rr.length-_wins;
          const _startC=_rr[0].court;
          const _endC=_rr[_rr.length-1].court;
          const _moved=_startC-_endC;
          const _movedTxt=_moved>0?'↑ '+_moved+' court'+(_moved!==1?'s':''):_moved<0?'↓ '+Math.abs(_moved)+' court'+(Math.abs(_moved)!==1?'s':''):'Same court';
          const _movedCol=_moved>0?(isLightM?'#3d6600':'#c8ff00'):_moved<0?(isLightM?'#cc2200':'#ff5c47'):(isLightM?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.4)');
          const _sessLabel=se.name||fmtDate(se.date);
          const _isOpen=playerLadderOpen.has(idx);
          const _cardBg=isLightM?'#ffffff':'#1a1a28';
          const _borderCol=isLightM?'rgba(0,0,0,0.1)':'rgba(255,255,255,0.08)';
          const _textCol=isLightM?'#111':'#f4f4f0';
          const _mutedCol=isLightM?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.4)';
          const _chevBg=isLightM?'rgba(0,0,0,0.05)':'rgba(255,255,255,0.06)';
          pv+='<div style="background:'+_cardBg+';border:0.5px solid '+_borderCol+';border-radius:12px;overflow:hidden;margin-bottom:8px">';
          pv+='<div onclick="togglePlayerLadder('+idx+')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;'+(isLightM?'border-bottom:0.5px solid '+(_isOpen?_borderCol:'transparent'):'')+'">';
          pv+='<div style="flex:1">';
          pv+='<div style="font-size:13px;font-weight:800;color:'+_textCol+';line-height:1.2">'+_sessLabel+'</div>';
          pv+='<div style="font-size:11px;margin-top:2px;color:'+_mutedCol+'">'+_wins+'W–'+_losses+'L &nbsp;·&nbsp; <span style="color:'+_movedCol+';font-weight:700">'+_movedTxt+'</span></div>';
          pv+='</div>';
          pv+='<div style="background:'+_chevBg+';border-radius:20px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;color:'+_mutedCol+';transition:transform .2s;transform:rotate('+(_isOpen?'180':'0')+'deg)">▾</div>';
          pv+='</div>';
          if(_isOpen){
            pv+='<div style="padding:10px 12px 12px;border-top:0.5px solid '+_borderCol+'">';
            pv+=buildPlayerRoundCards(se,playerStatsModalId,isLightM);
            pv+=buildLadderChartSVG(_rr,isLightM,_cN,_nC);
            pv+='<div style="display:flex;align-items:center;gap:10px;margin-top:6px;font-size:9px;color:'+_mutedCol+'">';
            pv+='<span><span style="display:inline-block;width:7px;height:7px;background:'+(isLightM?'#3d6600':'#c8ff00')+';border-radius:50%;vertical-align:middle;margin-right:3px"></span>Won</span>';
            pv+='<span><span style="display:inline-block;width:7px;height:7px;background:'+(isLightM?'#cc2200':'#ff5c47')+';border-radius:50%;vertical-align:middle;margin-right:3px"></span>Lost</span>';
            pv+='</div>';
            pv+='</div>';
          }
          pv+='</div>';
        });
        pv+='</div>';
      }
      } else {
        pv+='<div style="background:'+(isLightM?'var(--surf1)':'#0d0d0d')+';border:0.5px solid '+(isLightM?'var(--border)':'#1e1e1e')+';border-radius:12px;padding:24px;text-align:center;color:var(--muted);font-size:.85rem">No stats yet for this player.</div>';
      }
      pv+='</div></div>';
      h+=pv;
    }
  }

  // ── In-round Sub modal (admin only) ──
  if(subModalState&&isAdmin){
    const lp=gL();const ssp=gSS();
    if(lp&&ssp){
      // Bench = every active league player who isn't currently on a court
      // in this round. Includes prior subbedOut players (they're eligible
      // to come back) and league members not in this ladder's participants
      // (the user's "2 of 18 not playing" case). Excludes temp one-round
      // subs and the player being subbed out.
      const onCourt=new Set();
      const round=ssp.rounds&&ssp.rounds[ssp.currentRound];
      if(round){round.courts.forEach(c=>{[...(c.team1||[]),...(c.team2||[])].forEach(x=>{if(x)onCourt.add(x.id);});});}
      const benchPlayers=lp.players.filter(p=>p&&p.active!==false&&!p.temp&&p.id!==subModalState.pid&&!onCourt.has(p.id));
      let sm='<div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:500;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:16px;backdrop-filter:blur(6px);overflow-y:auto" onclick="closeSubModal()">';
      sm+='<div style="background:#111118;border-radius:18px;width:100%;max-width:380px;border:1px solid rgba(255,255,255,0.1);overflow:hidden" onclick="event.stopPropagation()">';
      sm+='<div style="background:#0e0e1a;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center">';
      const _modeLabel=subModalState.pid?'SUB OUT':'CHOOSE PLAYER';
      const _modeName=subModalState.pid?subModalState.name:'For empty slot';
      const _modeColor=subModalState.pid?'#ff5c47':'#ffcc00';
      sm+='<div><div style="font-size:9px;font-weight:900;color:'+_modeColor+';letter-spacing:.1em">'+_modeLabel+'</div><div style="font-size:var(--cc-pname,14px);font-weight:700;color:#f4f4f0;margin-top:2px">'+_modeName+'</div></div>';
      sm+='<button onclick="closeSubModal()" style="background:rgba(255,255,255,0.07);border:none;color:#7a7a8a;font-size:16px;width:30px;height:30px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">\u2715</button>';
      sm+='</div>';
      if(benchPlayers.length){
        sm+='<div style="padding:12px 14px 6px"><div style="font-size:9px;font-weight:900;color:rgba(200,255,0,0.7);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Pull from bench</div>';
        sm+='<div style="background:#0a0a0a;border:0.5px solid #1e1e1e;border-radius:8px;overflow:hidden">';
        benchPlayers.forEach((p,i)=>{
          sm+='<div style="display:flex;align-items:center;gap:8px;padding:9px 11px'+(i<benchPlayers.length-1?';border-bottom:0.5px solid #1a1a1a':'')+';cursor:pointer" onclick="subBenchAt(\''+p.id+'\')">';
          sm+='<div style="flex:1;font-size:13px;font-weight:600;color:#f4f4f0">'+p.name+'</div>';
          sm+='<span style="font-size:9px;background:'+(p.gender==='F'?'rgba(255,45,120,0.12);color:#ff69a0':'rgba(59,130,246,0.1);color:#5b9fff')+';padding:2px 7px;border-radius:10px;font-weight:600">'+p.gender+'</span>';
          sm+='<span style="font-size:11px;color:#c8ff00;font-weight:700">\u2192</span>';
          sm+='</div>';
        });
        sm+='</div></div>';
      } else {
        sm+='<div style="padding:10px 14px 6px;font-size:10px;color:rgba(255,255,255,0.4);text-align:center;font-style:italic">No bench players \u2014 every league member is in this ladder.</div>';
      }
      sm+='<div style="padding:8px 14px 6px"><div style="font-size:9px;font-weight:900;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Add new permanent</div>';
      sm+='<div style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:6px">Joins league. Stats roll up to season leaderboard.</div>';
      sm+='<div style="display:grid;grid-template-columns:1fr 56px 70px;gap:6px">';
      sm+='<input id="subModalPermName" placeholder="Name" style="background:#0a0a0a;border:0.5px solid #1e1e1e;color:#f4f4f0;font-size:13px;padding:8px 10px;border-radius:6px;font-family:inherit;outline:none">';
      sm+='<select id="subModalPermGender" style="background:#0a0a0a;border:0.5px solid #1e1e1e;color:#f4f4f0;font-size:13px;padding:8px 6px;border-radius:6px;font-family:inherit;outline:none"><option value="M">M</option><option value="F">F</option></select>';
      sm+='<button onclick="subAddPermAt()" style="background:var(--lime);border:none;color:#0a0a0f;font-size:11px;font-weight:800;border-radius:6px;cursor:pointer">Add</button>';
      sm+='</div></div>';
      sm+='<div style="padding:8px 14px 6px"><div style="font-size:9px;font-weight:900;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">One-round / temp sub</div>';
      sm+='<div style="font-size:9px;color:rgba(255,255,255,0.35);margin-bottom:6px">Counts in this ladder’s stats. NOT on the season leaderboard.</div>';
      sm+='<div style="display:grid;grid-template-columns:1fr 56px 70px;gap:6px">';
      sm+='<input id="subModalTempName" placeholder="Name (or &quot;Sub&quot;)" style="background:#0a0a0a;border:0.5px solid #1e1e1e;color:#f4f4f0;font-size:13px;padding:8px 10px;border-radius:6px;font-family:inherit;outline:none">';
      sm+='<select id="subModalTempGender" style="background:#0a0a0a;border:0.5px solid #1e1e1e;color:#f4f4f0;font-size:13px;padding:8px 6px;border-radius:6px;font-family:inherit;outline:none"><option value="M">M</option><option value="F">F</option></select>';
      sm+='<button onclick="subAddTempAt()" style="background:transparent;border:1px solid rgba(255,255,255,0.18);color:#f4f4f0;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer">Temp</button>';
      sm+='</div></div>';
      sm+='<div style="padding:10px 14px 14px;border-top:0.5px solid rgba(255,255,255,0.05);margin-top:6px">';
      sm+='<button onclick="subClearAt()" style="width:100%;background:rgba(255,92,71,0.1);border:1px solid rgba(255,92,71,0.25);color:#ff5c47;font-size:11px;font-weight:700;padding:9px 0;border-radius:6px;cursor:pointer">Just sub out · leave slot empty</button>';
      sm+='</div>';
      sm+='</div></div>';
      h+=sm;
    }
  }

  // ── Swap mode banner (fixed top) ──
  if(swapMode&&isAdmin){
    const ss3=gSS();
    if(ss3){const srcRound=ss3.rounds[swapMode.ri];const srcCt=srcRound?.courts[swapMode.ci];
      const srcT=swapMode.ti===0?srcCt?.team1:srcCt?.team2;const srcP=srcT?.[swapMode.pi];
      h+='<div style="position:fixed;top:0;left:0;right:0;z-index:400;background:rgba(255,204,0,0.15);border-bottom:2px solid rgba(255,204,0,0.4);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(8px)">';
      h+='<div><div style="font-size:8px;font-weight:900;color:#ffcc00;text-transform:uppercase;letter-spacing:.08em">Swapping player</div>';
      h+='<div style="font-size:var(--cc-pname,14px);font-weight:700;color:#f4f4f0;margin-top:1px">'+(srcP?.name||'?')+' → tap any player to swap</div></div>';
      h+='<button onclick="cancelSwap()" style="background:rgba(255,92,71,0.15);border:1px solid rgba(255,92,71,0.3);color:#ff5c47;font-size:9px;font-weight:700;padding:6px 12px;border-radius:6px;cursor:pointer">Cancel</button>';
      h+='</div>';}}

  // (Accessibility button is now in the header — see hdr-right above)

  // Bottom admin button
  h+='<div style="display:flex;justify-content:center;padding:20px 16px 32px">';
  h+='<button onclick="'+(isAdmin?'lockAdmin()':'openPin()')+'" style="background:'+(isAdmin?'rgba(255,92,71,0.08)':'var(--surf2)')+';border:1px solid '+(isAdmin?'rgba(255,92,71,0.3)':'var(--border)')+';color:'+(isAdmin?'#ff5c47':'var(--muted)')+';font-size:11px;font-weight:700;padding:10px 22px;border-radius:24px;cursor:pointer;font-family:Inter,sans-serif;letter-spacing:.04em">'+(isAdmin?'🔓 Lock Admin':'🔐 Admin Login')+'</button>';
  h+='</div>';
  app.innerHTML=h;
  applyTextSize();
  applyTheme();
  renderSizeBtns();
  if(view==='newSession')setTimeout(updateCourtInputs,0);
  if(tab==='stats')setTimeout(tkRenderChart,10);
  if(npState&&isAdmin){
    document.removeEventListener('keydown',window._npKeyHandler);
    window._npKeyHandler=(e)=>{
      if(!npState)return;
      const _ss=gSS();const _ct=_ss?.rounds?.[npState.ri]?.courts?.[npState.ci];
      const _t1=_ct?.score?.t1,_t2=_ct?.score?.t2;
      const _tied=_t1!=null&&_t2!=null&&_t1===_t2;
      if(e.key>='0'&&e.key<='9'){npPress(e.key);}
      else if(e.key==='Backspace'){e.preventDefault();npDel();}
      else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();if(!_tied)npConfirm();}
      else if(e.key==='Escape'){if(!_tied)npCancel();}
    };
    document.addEventListener('keydown',window._npKeyHandler);
  } else {document.removeEventListener('keydown',window._npKeyHandler);window._npKeyHandler=null;}}

async function init(){
  applyTextSize();
  applyTheme();
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
    view='home';   // land on the cross-league upcoming-ladders hub
    render();
  }catch(e){
    console.error('Init failed:',e);
    document.getElementById('app').innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0a0a0f;gap:16px;padding:24px"><div style="font-size:2rem">⚠️</div><div style="font-family:Inter,sans-serif;font-size:1rem;font-weight:700;color:#ff5c47;text-align:center">Could not connect</div><div style="font-size:.8rem;color:#7a7a8a;text-align:center;max-width:300px;line-height:1.6">'+e.message+'</div><button onclick="init()" style="margin-top:8px;padding:10px 24px;background:#c8ff00;color:#0a0a0f;border:none;border-radius:8px;font-weight:700;font-size:.9rem;cursor:pointer">Retry</button></div>';
  }}
document.addEventListener('DOMContentLoaded',init);

// ── Live sync: re-fetch the active ladder from the server.
// Skips if a score is currently being entered (npState active) to avoid
// disrupting mid-entry input.
let _lastRefresh=0;
async function refreshLadder(){
  if(!activeLadderId)return;
  if(npState)return;       // don't interrupt active score entry
  if(scoreTimer)return;    // don't overwrite a score that hasn't saved yet
  // While an admin is on the play tab, they are the source of truth and are
  // actively entering scores. Skip the background re-fetch so the grid never
  // rebuilds/reorders under them mid-round (the "looks like it refreshed" jump).
  // Fresh data still loads on any explicit action (Next Round saves+renders) or
  // when they leave the play tab.
  if(isAdmin&&view==='session'&&tab==='play')return;
  const now=Date.now();
  if(now-_lastRefresh<2000)return; // debounce: at most once every 2 s
  _lastRefresh=now;
  try{
    const res=await fetch('/api?action=get&id='+activeLadderId+'&_='+Date.now());
    if(!res.ok)return;
    const data=await res.json();
    if(data.ladder){
      const idx=ladders.findIndex(x=>x.id===activeLadderId);
      // Only re-render if the server data actually differs from what's in memory.
      // Prevents unnecessary full DOM rebuilds (and apparent lineup "shuffling")
      // caused by the 5-s poll re-rendering identical data on every tick.
      const incoming=JSON.stringify(data.ladder);
      if(idx>=0&&JSON.stringify(ladders[idx])===incoming)return;
      if(idx>=0)ladders[idx]=data.ladder;else ladders.push(data.ladder);
      render();
    }
  }catch{}
}

// Poll every 5 s while a live session is active so multiple staff members
// entering scores on separate devices/tabs see each other's entries
// without needing to switch tabs or manually refresh.
setInterval(()=>{
  if(view==='session'&&activeSessionId){
    const ss=gSS();
    if(ss&&ss.started&&!ss.finished)refreshLadder();
  }
},5000);

// Also sync immediately when the tab regains focus (e.g. staff member
// switches back from another app).
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')refreshLadder();
});