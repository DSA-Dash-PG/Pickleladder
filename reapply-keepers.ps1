# reapply-keepers.ps1
# Re-applies the two non-theme fixes that were bundled into the now-reverted
# theme commit:
#   1. Persistent admin login (PIN survives refresh / tab close)
#   2. calcBonusPts diff tiebreaker (Clement +5 over Rich on tied pts)
#
# Run from C:\GitHub\Pickleladder AFTER you've done:
#   git revert b1da930 a4f38ab --no-edit
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\reapply-keepers.ps1

Set-Location -Path $PSScriptRoot
$repo = $PSScriptRoot
Write-Host ('Working in: ' + $repo)

$jsPath = Join-Path $repo 'js\app.js'
if (-not (Test-Path $jsPath)) {
    Write-Host ('ERROR: ' + $jsPath + ' not found')
    exit 1
}

$js = [System.IO.File]::ReadAllText($jsPath)

# -------- 1. Add admin-pin localStorage helpers ---------------------------
if ($js.Contains('_savePin')) {
    Write-Host 'Pin helpers already present, skipping'
} else {
    $marker = 'async function apiList()'
    if (-not $js.Contains($marker)) {
        Write-Host ('ERROR: marker "' + $marker + '" not found in app.js')
        exit 1
    }
    $helpers = @"
// Persistent admin login: PIN saved to localStorage on success, restored
// in init() so admins stay logged in across refresh / tab close. Solves
// the 'I'm logged out and didn't notice, why won't scores enter' issue.
function _savePin(pin){try{localStorage.setItem('pl-admin-pin',pin||'');}catch{}}
function _loadPin(){try{return localStorage.getItem('pl-admin-pin')||'';}catch{return'';}}
function _clearPin(){try{localStorage.removeItem('pl-admin-pin');}catch{}}

"@
    $js = $js.Replace($marker, $helpers + $marker)
    Write-Host 'Added pin helpers'
}

# -------- 2. checkPin saves pin on success --------------------------------
$oldCheck = 'async function checkPin(){const v=await apiVerifyPin(pinEntry);if(v){adminPin=pinEntry;isAdmin=true;closePin();render()}'
$newCheck = 'async function checkPin(){const v=await apiVerifyPin(pinEntry);if(v){adminPin=pinEntry;isAdmin=true;_savePin(pinEntry);closePin();render()}'
if ($js.Contains($oldCheck)) {
    $js = $js.Replace($oldCheck, $newCheck)
    Write-Host 'Patched checkPin to save pin'
} elseif ($js.Contains($newCheck)) {
    Write-Host 'checkPin already patched'
} else {
    Write-Host 'WARNING: could not locate checkPin to patch'
}

# -------- 3. lockAdmin clears pin -----------------------------------------
$oldLock = "function lockAdmin(){isAdmin=false;adminPin='';render()}"
$newLock = "function lockAdmin(){isAdmin=false;adminPin='';_clearPin();render()}"
if ($js.Contains($oldLock)) {
    $js = $js.Replace($oldLock, $newLock)
    Write-Host 'Patched lockAdmin to clear pin'
} elseif ($js.Contains($newLock)) {
    Write-Host 'lockAdmin already patched'
} else {
    Write-Host 'WARNING: could not locate lockAdmin to patch'
}

# -------- 4. init() restores admin session --------------------------------
$oldInit = "async function init(){`r`n  applyTextSize();`r`n  // Show loading with status so we can diagnose"
$oldInitLF = "async function init(){`n  applyTextSize();`n  // Show loading with status so we can diagnose"
$newInit = @"
async function init(){
  applyTextSize();
  // Restore admin session if a verified PIN is in localStorage.
  const savedPin=_loadPin();
  if(savedPin){
    try{const ok=await apiVerifyPin(savedPin);if(ok){adminPin=savedPin;isAdmin=true;}else{_clearPin();}}catch{}
  }
  // Show loading with status so we can diagnose
"@
$newInitLF = $newInit.Replace("`r`n", "`n")

if ($js.Contains($oldInit)) {
    $js = $js.Replace($oldInit, $newInit)
    Write-Host 'Patched init() to restore admin session'
} elseif ($js.Contains($oldInitLF)) {
    $js = $js.Replace($oldInitLF, $newInitLF)
    Write-Host 'Patched init() to restore admin session (LF)'
} elseif ($js.Contains('const savedPin=_loadPin()')) {
    Write-Host 'init() already patched'
} else {
    Write-Host 'WARNING: could not locate init() to patch'
}

# -------- 5. calcBonusPts diff tiebreaker ---------------------------------
$oldBonus = @'
    const pts={};players.forEach(p=>{pts[p.id]=0});
    sess.rounds.forEach(round=>{round.courts.forEach(c=>{
      if(!c.score||c.score.t1===null||c.score.t2===null||!c.score.winner)return;
      const{t1,t2}=c.score;
      [[c.team1,t1],[c.team2,t2]].forEach(([team,sc])=>{team.filter(Boolean).forEach(p=>{if(pts[p.id]!==undefined)pts[p.id]+=sc})})})});
    const ranked=Object.entries(pts).filter(([id,p])=>p>0).sort((a,b)=>b[1]-a[1]);
'@

$newBonus = @'
    // Track pts AND points-against per player so we can break intra-ladder
    // ties on diff (matches the leaderboard sort: pts then PS-PA).
    const pts={},pa={};players.forEach(p=>{pts[p.id]=0;pa[p.id]=0;});
    sess.rounds.forEach(round=>{round.courts.forEach(c=>{
      if(!c.score||c.score.t1===null||c.score.t2===null||!c.score.winner)return;
      const{t1,t2}=c.score;
      [[c.team1,t1,t2],[c.team2,t2,t1]].forEach(([team,sc,al])=>{team.filter(Boolean).forEach(p=>{if(pts[p.id]!==undefined){pts[p.id]+=sc;pa[p.id]+=al;}})})})});
    const ranked=Object.entries(pts).filter(([id,p])=>p>0).sort((a,b)=>b[1]-a[1]||((b[1]-pa[b[0]])-(a[1]-pa[a[0]])));
'@

# Try CRLF then LF variants
$oldBonusLF = $oldBonus.Replace("`r`n", "`n")
$newBonusLF = $newBonus.Replace("`r`n", "`n")

if ($js.Contains($oldBonus)) {
    $js = $js.Replace($oldBonus, $newBonus)
    Write-Host 'Patched calcBonusPts diff tiebreaker'
} elseif ($js.Contains($oldBonusLF)) {
    $js = $js.Replace($oldBonusLF, $newBonusLF)
    Write-Host 'Patched calcBonusPts diff tiebreaker (LF)'
} elseif ($js.Contains('const pts={},pa={}')) {
    Write-Host 'calcBonusPts already patched'
} else {
    Write-Host 'WARNING: could not locate calcBonusPts to patch'
}

# -------- write back -------------------------------------------------------
[System.IO.File]::WriteAllText($jsPath, $js)
Write-Host ''
Write-Host 'Done. Now run:'
Write-Host '  git add -A'
Write-Host '  git commit -m "Re-add persistent admin login + diff tiebreaker"'
Write-Host '  git push origin main'
