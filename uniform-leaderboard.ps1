# uniform-leaderboard.ps1
# Replaces the rFullStats function (top 3 medium cards + 4+ table) with one
# uniform table for everyone, adds the Diff column after L, and a small
# explanation line under the bonus strip about the profile popup.
#
# Run from C:\GitHub\Pickleladder with:
#   powershell -ExecutionPolicy Bypass -File .\uniform-leaderboard.ps1

Set-Location -Path $PSScriptRoot
$repo = $PSScriptRoot
$jsPath = Join-Path $repo 'js\app.js'

if (-not (Test-Path $jsPath)) {
    Write-Host ('ERROR: ' + $jsPath + ' not found')
    exit 1
}

$js = [System.IO.File]::ReadAllText($jsPath)

$startMarkers = @(
    '// ══ LEADERBOARD TAB (merged Standings + wide table + Search) ══',
    '// ══ FULL STATS TAB ══'
)
$start = -1
foreach ($m in $startMarkers) {
    $i = $js.IndexOf($m)
    if ($i -ge 0) { $start = $i; break }
}
if ($start -lt 0) {
    Write-Host 'ERROR: could not find rFullStats start marker'
    exit 1
}

$endMarker = "`r`n`r`n`r`nfunction rNewLadder()"
$end = $js.IndexOf($endMarker, $start)
if ($end -lt 0) {
    $endMarker = "`n`n`nfunction rNewLadder()"
    $end = $js.IndexOf($endMarker, $start)
}
if ($end -lt 0) {
    Write-Host 'ERROR: could not find rFullStats end marker (function rNewLadder)'
    exit 1
}

$newFn = @'
// ══ LEADERBOARD TAB — uniform table with Diff column ══
function rFullStats(stats,season,l){
  if(!season)return'';
  const bonusData=calcBonusPts(season.sessions,l.players);
  const totalPts=(s)=>s.pf+(bonusData[s.id]?.bonus||0);
  const sorted=[...stats].filter(s=>s.w+s.l+s.t>0).sort((a,b)=>totalPts(b)-totalPts(a)||(b.pf-b.pa)-(a.pf-a.pa));
  if(!sorted.length)return'<p class="subtext" style="text-align:center;padding:20px">No scored games yet.</p>';

  const prevRankMap={};
  const hasPrev=season.sessions.filter(x=>x.started).length>=2;
  if(hasPrev){
    const prev=season.sessions.filter(x=>x.started).slice(0,-1);
    const ps=calcStats(prev,l.players);
    const pb=calcBonusPts(prev,l.players);
    [...ps].filter(s=>s.w+s.l+s.t>0).sort((a,b)=>(b.pf+(pb[b.id]?.bonus||0))-(a.pf+(pb[a.id]?.bonus||0))||(b.pf-b.pa)-(a.pf-a.pa)).forEach((s,i)=>prevRankMap[s.id]=i+1);
  }

  let h='';
  h+='<div style="display:flex;background:#0d1400;border:0.5px solid rgba(200,255,0,0.15);border-radius:8px;overflow:hidden;margin-bottom:8px">';
  [{p:'1st',b:15},{p:'2nd',b:10},{p:'3rd',b:5}].forEach((x,i)=>{
    h+='<div style="flex:1;text-align:center;padding:8px 4px;border-right:1px solid rgba(200,255,0,0.1)"><div style="font-size:8px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">'+x.p+'</div><div style="font-size:16px;font-weight:900;color:#c8ff00;line-height:1">+'+x.b+'</div><div style="font-size:8px;color:rgba(200,255,0,0.4);margin-top:1px">bonus</div></div>';
  });
  h+='<div style="flex:1;text-align:center;padding:8px 4px"><div style="font-size:8px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Scope</div><div style="font-size:10px;font-weight:900;color:#c8ff00;line-height:1.3">All<br>ladders</div></div></div>';

  h+='<div style="font-size:10px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.5;padding:0 4px 8px">Tap a row to open a player profile <span style="color:rgba(255,255,255,0.3)">·</span> W <span style="color:rgba(255,255,255,0.3)">·</span> L <span style="color:rgba(255,255,255,0.3)">·</span> Avg <span style="color:rgba(255,255,255,0.3)">·</span> Win % <span style="color:rgba(255,255,255,0.3)">·</span> PS <span style="color:rgba(255,255,255,0.3)">·</span> PA <span style="color:rgba(255,255,255,0.3)">·</span> Diff <span style="color:rgba(255,255,255,0.3)">·</span> Streak</div>';

  const podLabel=['1st','2nd','3rd'];
  const podCol=['#ffcc00','#c0c0c0','#cd7f32'];
  const podBg=['#1a1200','#111','#12100a'];
  const cols='30px 26px 1fr 26px 26px 38px 40px 44px';
  h+='<div style="background:#0d0d0d;border:0.5px solid #1e1e1e;border-radius:10px;overflow:hidden">';
  h+='<div style="display:grid;grid-template-columns:'+cols+';gap:5px;padding:7px 12px;background:#0a0a0a;border-bottom:1px solid #1a1a1a;font-size:8px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:.1em;text-transform:uppercase">';
  ['#','Δ','Player','W','L','Diff','Bonus','Total'].forEach((c,j)=>{
    const align=j===2?'left':j===1?'center':'right';
    h+='<div style="text-align:'+align+'">'+c+'</div>';
  });
  h+='</div>';

  sorted.forEach((s,i)=>{
    const rank=i+1;
    const wins=bonusData[s.id]?.wins||0;
    const bonus=bonusData[s.id]?.bonus||0;
    const total=s.pf+bonus;
    const d=s.pf-s.pa;
    const isPod=rank<=3;
    const rankColor=isPod?podCol[rank-1]:'rgba(255,255,255,0.4)';
    const totalColor=isPod?podCol[rank-1]:'#c8ff00';
    const stripeBg=isPod?podBg[rank-1]:(i%2===1?'#0a0a0a':'transparent');
    h+='<div'+pClick(s.id)+' style="display:grid;grid-template-columns:'+cols+';gap:5px;padding:9px 12px;border-bottom:0.5px solid #111;background:'+stripeBg+';align-items:center;font-variant-numeric:tabular-nums'+pCur()+'">';
    h+='<div style="text-align:right;font-size:11px;font-weight:'+(isPod?'700':'400')+';color:'+rankColor+'">'+(isPod?podLabel[rank-1]:rank)+'</div>';
    h+='<div style="text-align:center;font-size:9px">'+renderDelta(prevRankMap[s.id],rank,hasPrev)+'</div>';
    h+='<div style="font-size:'+(isPod?'13':'12')+'px;font-weight:700;color:'+(isPod?'#f4f4f0':'rgba(255,255,255,0.85)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.name+(wins>0?' '+crownStr(wins):'')+'</div>';
    h+='<div style="text-align:right;font-size:12px;font-weight:700;color:#c8ff00">'+s.w+'</div>';
    h+='<div style="text-align:right;font-size:12px;color:rgba(255,255,255,0.45)">'+s.l+'</div>';
    h+='<div style="text-align:right;font-size:11px;font-weight:'+(d>=0?'700':'400')+';color:'+(d>0?'#c8ff00':d<0?'#ff5c47':'rgba(255,255,255,0.4)')+'">'+(d>0?'+':'')+d+'</div>';
    h+='<div style="text-align:right;font-size:11px;font-weight:800;color:'+(bonus>0?'#c8ff00':'rgba(255,255,255,0.2)')+'">'+(bonus>0?'+'+bonus:'—')+'</div>';
    h+='<div style="text-align:right;font-size:'+(isPod?'14':'13')+'px;font-weight:900;color:'+totalColor+'">'+total+'</div>';
    h+='</div>';
  });
  h+='</div>';
  return h;}
'@

if ($js.Contains("`r`n")) { $newFn = $newFn.Replace("`n", "`r`n").Replace("`r`r`n","`r`n") }

$prefix = $js.Substring(0, $start)
$suffix = $js.Substring($end)
$js = $prefix + $newFn + $suffix

[System.IO.File]::WriteAllText($jsPath, $js)
Write-Host 'JS: rFullStats replaced with uniform table + Diff column + popup hint'
Write-Host ''
Write-Host 'Now run:'
Write-Host '  git add -A'
Write-Host '  git commit -m "Uniform leaderboard rows + Diff column"'
Write-Host '  git push origin main'
