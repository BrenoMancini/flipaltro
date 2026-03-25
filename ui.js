// FLIP7 × BALATRO — ui.js

let G = null;
let shopItems = [];
let pendingItem = null;
let toastTimer = null;
let lastOutcome = null;
let lastBustVal = null;
let animationTimers = [];
let tutStep = 0;

// Pack opening state
let currentPack = null;
let currentPackKey = null;
let packSelections = new Set();

// ── SCREENS ───────────────────────────────────────────────
function showScreen(id) {
  ['screen-menu','screen-tutorial','screen-game','screen-shop','screen-end'].forEach(s => {
    document.getElementById(s).style.display = (s === id) ? 'flex' : 'none';
  });
  window.scrollTo(0, 0);
}

function showMenu()    { showScreen('screen-menu'); }
function quitGame()    { showToast('Feche a aba para sair :)'); }
function confirmMenu() { if (confirm('Voltar ao menu? O progresso será perdido.')) showMenu(); }

function startGame() {
  G = createGameState();
  initRound(G);
  showScreen('screen-game');
  renderGame();
}

// ── TUTORIAL ──────────────────────────────────────────────
const TUTORIAL_STEPS = [
  { title:'O objetivo', icon:'🎯',
    body:`Você tem <strong>5 mãos</strong> para atingir uma <strong>meta de pontos</strong> por round. São <strong>8 rounds</strong> no total, cada um com meta maior. Ao completar todos os rounds, você vence!`, cards:null },
  { title:'Cavando cartas', icon:'⛏',
    body:`Clique em <strong>Cavar</strong> para puxar a próxima carta do deck. Cada carta numérica soma ao seu <span class="cc-chips">chips</span>. O score final da mão é <span class="cc-chips">chips</span> × <span class="cc-mult">mult</span>.`, cards:['num-1','num-4','num-7'] },
  { title:'BUST — o perigo', icon:'💀',
    body:`Se puxar um número que <strong>já está na mesa</strong>, você dá <strong>BUST</strong> e perde 0 pontos nessa mão. <strong>Saber quando parar é a habilidade central do jogo.</strong>`, cards:['num-3','num-3-bust'] },
  { title:'Parar voluntariamente', icon:'✋',
    body:`A qualquer momento pode clicar em <strong>Parar</strong> e garantir os pontos da mesa. O ponto ótimo é score entre 10–12 por mão.`, cards:null },
  { title:'Flip5 e Flip7', icon:'⭐',
    body:`5 números únicos → <strong>Flip5!</strong> Ganha <span class="cc-mult">+1 mult</span> e a mão continua. 7 números únicos → <strong>Flip7!</strong> O <span class="cc-mult">mult</span> é multiplicado por ×2.`, cards:['num-1','num-2','num-3','num-4','num-5'] },
  { title:'Cartas especiais', icon:'🃏',
    body:`<strong>Freeze ❄</strong> — para obrigatoriamente, pontua a mesa.<br><strong>Flip2 +2</strong> — obriga a cavar mais 2.<br><strong>+<span class="cc-chips">Chips</span></strong> — adiciona chips ao score.<br><strong>+<span class="cc-mult">Mult</span></strong> — adiciona ao multiplicador.`, cards:['freeze','flip2','chips','mult'] },
  { title:'A loja & Jokers', icon:'🏪',
    body:`Entre rounds você entra na <strong>loja</strong>. Compre <strong>Jokers</strong> com passivos permanentes, <strong>Edições</strong> e <strong>Selos</strong> para turbocar cartas, e adicione novos números ao baralho.`, cards:null },
];

function showTutorial() { tutStep = 0; renderTutStep(); showScreen('screen-tutorial'); }

function renderTutStep() {
  const step = TUTORIAL_STEPS[tutStep];
  const total = TUTORIAL_STEPS.length;
  const demoMap = {
    'num-1':{cls:'',top:'1'},'num-2':{cls:'',top:'2'},'num-3':{cls:'',top:'3'},
    'num-4':{cls:'',top:'4'},'num-5':{cls:'',top:'5'},'num-7':{cls:'',top:'7'},
    'num-3-bust':{cls:' card-bust',top:'3'},
    'freeze':{cls:' card-freeze',top:'❄',sub:'freeze'},'flip2':{cls:' card-flip2',top:'+2',sub:'flip2'},
    'chips':{cls:' card-chips',top:'+5',sub:'chips'},'mult':{cls:' card-mult',top:'+1',sub:'mult'},
  };
  const cardsHTML = step.cards
    ? `<div class="tut-cards">${step.cards.map(k=>{const c=demoMap[k]||{cls:'',top:k};return`<div class="card${c.cls}">${c.top}${c.sub?`<span class="card-sub">${c.sub}</span>`:''}</div>`;}).join('')}</div>`
    : '';
  document.getElementById('tut-steps').innerHTML = `
    <div class="tut-step">
      <div class="tut-step-icon">${step.icon}</div>
      <div class="tut-step-title">${step.title}</div>
      <div class="tut-step-body">${step.body}</div>
      ${cardsHTML}
    </div>`;
  document.getElementById('tut-counter').textContent = `${tutStep+1} / ${total}`;
  document.getElementById('tut-prev').disabled = tutStep === 0;
  const btn = document.getElementById('tut-next');
  if (tutStep === total-1) { btn.textContent = 'Jogar agora →'; btn.onclick = ()=>startGame(); }
  else                      { btn.textContent = 'Próximo →';      btn.onclick = ()=>tutNext(); }
}
function tutNext() { if (tutStep < TUTORIAL_STEPS.length-1) { tutStep++; renderTutStep(); } }
function tutPrev() { if (tutStep > 0) { tutStep--; renderTutStep(); } }

// ── TOAST ──────────────────────────────────────────────────
function showToast(msg, type='green') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── RENDER ─────────────────────────────────────────────────
function render() {
  if      (G.phase === 'game')     { showScreen('screen-game');  renderGame(); }
  else if (G.phase === 'shop')     { showScreen('screen-shop');  renderShopFull(); }
  else if (G.phase === 'gameover') { showScreen('screen-end');   renderEnd(false); }
  else if (G.phase === 'win')      { showScreen('screen-end');   renderEnd(true); }
}

// ── GAME ───────────────────────────────────────────────────
function bumpCounter(id, newVal) {
  const el = document.getElementById(id);
  const old = parseFloat(el.textContent) || 0;
  el.textContent = newVal;
  if (newVal > old) {
    el.classList.remove('counter-bump');
    void el.offsetWidth;
    el.classList.add('counter-bump');
  }
}

function renderGame() {
  document.getElementById('ui-round').textContent     = `${G.round} / ${GAME_CONFIG.TOTAL_ROUNDS}`;
  document.getElementById('ui-hand').textContent      = `${G.handNum} / ${GAME_CONFIG.HANDS_PER_ROUND}`;
  document.getElementById('ui-goal').textContent      = G.goal;
  document.getElementById('ui-score').textContent     = G.roundScore;
  document.getElementById('ui-money').textContent     = `$${G.money}`;
  document.getElementById('ui-flip7').textContent     = G.flip7Count;
  bumpCounter('ui-chips', G.chips);
  bumpCounter('ui-mult',  G.mult);
  document.getElementById('ui-livescore').textContent = liveScore(G);

  const pct = Math.min(100, Math.round(G.roundScore / G.goal * 100));
  document.getElementById('ui-progress-bar').style.width   = pct + '%';
  document.getElementById('ui-progress-label').textContent = `${G.roundScore} / ${G.goal}`;

  renderTable(lastOutcome, lastBustVal);
  document.getElementById('ui-deck-count').textContent = G.deck.length;
  document.getElementById('ui-disc-count').textContent = G.discardPile.length;
  renderDeckInfo(); renderPips(); renderJokers();

  const over = G.handOver;
  document.getElementById('btn-draw').disabled    = over || G.deck.length === 0;
  document.getElementById('btn-stop').disabled    = over || G.mustDraw > 0 || G.table.length === 0;
  document.getElementById('btn-discard').disabled = over || G.discardsLeft <= 0 || G.mustDraw > 0;
  const btnNext = document.getElementById('btn-next');
  btnNext.style.display = over ? 'block' : 'none';
  if (over) {
    if (G.roundWon) btnNext.textContent = `Meta atingida! → Loja`;
    else if (G.handsLeft <= 0) btnNext.textContent = 'Ver resultado';
    else if (G.lastReason === 'freeze') btnNext.textContent = 'Freeze! Mão grátis → continuar';
    else btnNext.textContent = 'Próxima mão';
  }
  renderLog();
}

function renderTable(outcome, bustVal) {
  const el = document.getElementById('ui-table');
  el.className = 'table-area' + (outcome ? ' '+outcome : '');
  if (!G.table.length) { el.innerHTML='<span class="empty-hint">Clique em Cavar para puxar uma carta</span>'; return; }
  const edL={gold:'✦',gleam:'◈',prism:'◉',ghost:'◌',relic:'⟡'};
  const edTip={gold:'+chips ao aparecer',gleam:'+2 mult ao aparecer',prism:'+chips = score atual',ghost:'Nunca dá bust',relic:'Cava +1 extra'};
  const sC={red:'seal-red',blue:'seal-blue',gold:'seal-gold'};
  const sL2={red:'●',blue:'◆',gold:'★'};
  const sealTip={red:'+1 mult ao puxar',blue:'+$1 ao terminar',gold:'×Mult no Flip7'};
  const sf=new Set();
  let html = G.table.map(c => {
    let cls='card',top='',sub='',badge='';
    if(c.kind==='freeze')      {cls+=' card-freeze';top='❄';sub='freeze';}
    else if(c.kind==='flip2')  {cls+=' card-flip2';top='+2';sub='flip2';}
    else if(c.kind==='chips')  {cls+=' card-chips';top=`+${c.value}`;sub='chips';}
    else if(c.kind==='mult')   {cls+=' card-mult';top=`+${c.value}`;sub='mult';}
    else if(c.kind==='sc')     {cls+=' card-freeze';top='🛡';sub='SC';}
    else if(c.kind==='number') {
      const isBust=outcome==='bust'&&c.value===bustVal&&!sf.has(c.value);
      if(isBust) cls+=' card-bust'; else sf.add(c.value);
      top=c.value;
    }
    if(c.edition) badge+=`<span class="card-edition card-ed-${c.edition}">${edL[c.edition]||'?'}</span>`;
    if(c.seal)    badge+=`<span class="card-seal ${sC[c.seal]||''}">${c.seal[0].toUpperCase()}</span>`;
    const tipLines=[];
    if(c.edition&&edTip[c.edition]) tipLines.push(`${edL[c.edition]} ${edTip[c.edition]}`);
    if(c.seal&&sealTip[c.seal]) tipLines.push(`${sL2[c.seal]} ${sealTip[c.seal]}`);
    const tip=tipLines.length?`<div class="card-tooltip">${tipLines.join('<br>')}</div>`:'';
    return `<div class="${cls}">${top}${sub?`<span class="card-sub">${sub}</span>`:''}${badge}${tip}</div>`;
  }).join('');
  if(outcome==='bust') html+=`<div class="bust-overlay"><span class="bust-label">BUST!</span></div>`;
  el.innerHTML=html;
}

function renderDeckInfo() {
  const {counts,specials}=getDeckComposition(G.deck);
  const ns=Object.entries(counts).sort((a,b)=>+a[0]-+b[0]).map(([n,c])=>`${c}×${n}`).join(' ');
  const ss=specials.map(c=>cardName(c)).join(' ');
  const dn=G.discardPile.filter(c=>c.kind==='number').map(c=>c.value).sort((a,b)=>a-b).join(' ')||'—';
  document.getElementById('ui-deck-info').innerHTML=
    `<span class="deck-comp">${ns}${ss?' · '+ss:''}</span><br><span class="disc-comp">Descarte: ${dn}</span>`;
}

function renderPips() {
  const el=document.getElementById('ui-pips');
  let h='<span class="pips-label">descartes</span>';
  for(let i=0;i<GAME_CONFIG.DISCARDS_PER_ROUND;i++) h+=`<div class="pip${i>=G.discardsLeft?' used':''}"></div>`;
  el.innerHTML=h;
}

function renderJokers(triggeredIds=[]) {
  const el=document.getElementById('ui-jokers');
  if(!G.jokers.length){el.innerHTML='<span class="joker-empty">Sem jokers — compre na loja</span>';return;}
  const trigL={
    joker_greedy:'toda mão não-bust', joker_stoic:'parar com 1 carta', joker_phoenix:'bust',
    joker_banker:'toda mão', joker_flip7fan:'Flip7', joker_daredevil:'bust',
    joker_pentacle:'Flip5', joker_catalyst:'Flip5', joker_accumulator:'Flip5',
    joker_disciple:'Flip3', joker_even:'carta par', joker_odd:'carta ímpar',
    joker_humble:'carta 0/1', joker_sequence:'3 consecutivos', joker_protector:'3ª carta',
    joker_luck:'parar', joker_twins:'Second Chance', joker_ascetic:'round sem comprar',
  };
  el.innerHTML=G.jokers.map(j=>{
    const triggered=triggeredIds.includes(j.id);
    return `<div class="joker-card${triggered?' joker-triggered':''}">
      <div class="joker-card-name">${j.name}</div>
      <div class="joker-card-desc">${j.desc}</div>
      <div class="joker-card-trigger">trigga: ${trigL[j.id]||'—'}</div>
      <div class="joker-tooltip-big"><div class="jt-name">${j.name}</div><div class="jt-desc">${j.desc}</div><div class="jt-trigger">Trigga em: ${trigL[j.id]||'—'}</div></div>
    </div>`;
  }).join('');
}

function renderLog() {
  document.getElementById('ui-log').innerHTML=
    G.log.slice(0,12).map(l=>`<span class="log-line">${colorCode(l)}</span>`).join('');
}

function colorCode(text) {
  return text
    .replace(/(\+?\d*\s*mult)/gi, m=>`<span class="cc-mult">${m}</span>`)
    .replace(/(\+?\d*\s*chips)/gi,m=>`<span class="cc-chips">${m}</span>`)
    .replace(/(×\s*mult)/gi,      m=>`<span class="cc-mult">${m}</span>`)
    .replace(/(xMult)/gi,         m=>`<span class="cc-mult">${m}</span>`);
}

// ── SCORING ANIMATION ──────────────────────────────────────
function clearAnimations() { animationTimers.forEach(t=>clearTimeout(t)); animationTimers=[]; }

function buildScoringSequence(state) {
  const seq=[]; let chips=0,mult=1;
  const reason=lastOutcome==='stopped'?'stop':lastOutcome==='frozen'?'freeze':lastOutcome==='flip7win'?'flip7':'other';
  for(const card of state.table) {
    if(!['number','chips','mult','freeze'].includes(card.kind)) continue;
    let ca=0,ma=0;
    if(card.kind==='number'){ca+=card.value;if(card.edition==='gold')ca+=card.value;if(card.edition==='gleam')ma+=2;if(card.seal==='red')ma+=1;}
    else if(card.kind==='chips'){ca+=card.value;if(card.edition==='gold')ca+=5;}
    else if(card.kind==='mult'){ma+=card.value;}
    else if(card.kind==='freeze'){if(card.edition==='gold')ca+=5;if(card.edition==='gleam')ma+=2;}
    chips+=ca; mult+=ma;
    const detail=ca>0&&ma>0?`+${ca}c +${ma}m`:ca>0?`+${ca} chips`:ma>0?`+${ma} mult`:null;
    if(detail) seq.push({type:'card',detail,id:card.id});
  }
  const triggeredIds=[];
  for(const joker of state.jokers) {
    let desc=null;
    if(joker.id==='joker_greedy'&&reason!=='bust')     desc='+10 pts';
    if(joker.id==='joker_stoic'&&reason==='stop'&&G.table.filter(c=>c.kind==='number').length===1) desc='+1 mult perm';
    if(joker.id==='joker_flip7fan'&&reason==='flip7') desc='×3';
    if(joker.id==='joker_phoenix'&&reason==='bust')   desc='metade pts';
    if(joker.id==='joker_daredevil'&&reason==='bust') desc='+5 mult perm';
    if(joker.id==='joker_banker'&&reason!=='bust')    desc='+$1';
    if(joker.id==='joker_pentacle'&&G.flip5Done)      desc='+15 pts';
    if(joker.id==='joker_catalyst'&&G.flip5Done)      desc='×2';
    if(joker.id==='joker_accumulator'&&G.flip5Done)   desc='+5 chips perm';
    if(joker.id==='joker_disciple'&&G.flip3Done)      desc='+0.25 mult perm';
    if(joker.id==='joker_luck'&&reason==='stop')      desc='+mult aleatório';
    if(desc){seq.push({type:'joker',detail:desc,id:joker.id});triggeredIds.push(joker.id);}
  }
  return {seq,triggeredIds};
}

function playScoringAnimation(state) {
  const {seq,triggeredIds}=buildScoringSequence(state);
  renderJokers(triggeredIds);
  if(!seq.length) return;
  seq.forEach((item,i)=>{
    const t=setTimeout(()=>{
      if(item.type==='card'){
        const cards=document.querySelectorAll('#ui-table .card');
        const tc=state.table.filter(c=>['number','chips','mult','freeze'].includes(c.kind));
        const idx=tc.findIndex(c=>c.id===item.id);
        const el=cards[idx];
        if(el){el.classList.add('scoring-pulse');showFloatLabel(el,item.detail);setTimeout(()=>el.classList.remove('scoring-pulse'),400);}
      } else {
        const els=document.querySelectorAll('.joker-card');
        const idx=state.jokers.findIndex(j=>j.id===item.id);
        const el=els[idx];
        if(el){el.classList.add('scoring-pulse');showFloatLabel(el,item.detail);setTimeout(()=>el.classList.remove('scoring-pulse'),400);}
      }
    }, i*220);
    animationTimers.push(t);
  });
}

function showFloatLabel(el,text) {
  if(!text||!el) return;
  const label=document.createElement('div');
  label.className='float-label'; label.textContent=text;
  const r=el.getBoundingClientRect();
  label.style.left=(r.left+r.width/2)+'px'; label.style.top=r.top+'px';
  document.body.appendChild(label);
  setTimeout(()=>label.remove(),900);
}

// ── SHOP ───────────────────────────────────────────────────
function renderShopFull() {
  shopItems=generateShop(G); pendingItem=null;
  currentPack=null; currentPackKey=null; packSelections.clear();
  renderShopUI();
}

function renderShopUI() {
  document.getElementById('shop-round').textContent      = G.round;
  document.getElementById('shop-money').textContent      = `$${G.money}`;
  document.getElementById('shop-score').textContent      = G.roundScore;
  document.getElementById('shop-goal').textContent       = G.goal;
  document.getElementById('shop-deck-count').textContent = G.fullDeck.length;
  document.getElementById('shop-next-round').textContent = G.round+1;
  const topRnd = document.getElementById('shop-next-round-top');
  if(topRnd) topRnd.textContent = G.round+1;
  renderShopRows(); renderShopDeck(); renderShopJokers();
  document.getElementById('btn-remove-card').textContent=`Remover carta — $${G.removeCost}`;
  document.getElementById('shop-pending').style.display='none';
  document.getElementById('pack-overlay').style.display='none';
  pendingItem=null;
}

function shopItemHTML(item,rowIdx,itemIdx) {
  const key=`${rowIdx}_${itemIdx}`;
  const canAfford=G.money>=item.cost;
  return `<div class="shop-item ${canAfford?'':'cant-afford'} rarity-${item.rarity}" onclick="clickShopItem('${key}')">
    <div class="shop-item-name">${item.name}</div>
    <div class="shop-item-desc">${colorCode(item.desc)}</div>
    <div class="shop-item-cost">$${item.cost}</div>
    <div class="shop-item-rarity">${item.rarity}</div>
  </div>`;
}

function shopPackHTML(pack,rowIdx,itemIdx) {
  const key=`${rowIdx}_${itemIdx}`;
  const canAfford=G.money>=pack.cost;
  const typeIcons={unico:'🎴',combo:'🔄',classico:'📦'};
  return `<div class="shop-item shop-pack ${canAfford?'':'cant-afford'} rarity-${pack.rarity}" onclick="clickShopItem('${key}')">
    <div class="shop-item-name">${typeIcons[pack.packType]||''} ${pack.name}</div>
    <div class="shop-item-desc">${pack.desc}</div>
    <div class="shop-item-cost">$${pack.cost}</div>
    <div class="shop-item-rarity">${pack.rarity}</div>
  </div>`;
}

function renderShopRows() {
  const {packRow,jokerRow,upgradeRow}=shopItems;
  document.getElementById('shop-row-cards').innerHTML=packRow.map((it,i)=>{
    if(!it) return '<div class="shop-item shop-item-empty"><div class="shop-item-name" style="color:var(--text3)">Vazio</div></div>';
    if(it.type==='pack') return shopPackHTML(it,0,i);
    return shopItemHTML(it,0,i);
  }).join('');
  document.getElementById('shop-row-jokers').innerHTML=jokerRow.length?jokerRow.map((it,i)=>it?shopItemHTML(it,1,i):'').join(''):'<span class="joker-empty">Sem jokers disponíveis</span>';
  document.getElementById('shop-row-upgrades').innerHTML=upgradeRow.map((it,i)=>it?shopItemHTML(it,2,i):'').join('');
}

function deckCardHTML(card, opts={}) {
  const edL={gold:'✦',gleam:'◈',prism:'◉',ghost:'◌',relic:'⟡'};
  const sC={red:'#e85454',blue:'#5ab4f0',gold:'#e8c84a'};
  const sL={red:'●',blue:'◆',gold:'★'};
  const edTip={gold:'+chips ao aparecer',gleam:'+2 mult ao aparecer',prism:'+chips = score atual',ghost:'Nunca dá bust',relic:'Cava +1 extra'};
  const sealTip={red:'+1 mult ao puxar',blue:'+$1 ao terminar',gold:'×Mult no Flip7'};
  const top=card.kind==='number'?card.value:card.kind==='chips'?`+${card.value}c`:card.kind==='mult'?`+${card.value}m`:card.kind==='freeze'?'❄':card.kind==='sc'?'🛡':'+2';
  const ed=card.edition?`<span style="font-size:9px;color:${card.edition==='gold'?'#e8c84a':card.edition==='gleam'?'#5ab4f0':card.edition==='prism'?'#a87de8':card.edition==='ghost'?'#5a5760':'#4ecb7a'}">${edL[card.edition]}</span>`:'';
  const sl=card.seal?`<span style="font-size:9px;color:${sC[card.seal]}">${sL[card.seal]}</span>`:'';
  const tipLines=[];
  if(card.edition&&edTip[card.edition]) tipLines.push(`${edL[card.edition]} ${edTip[card.edition]}`);
  if(card.seal&&sealTip[card.seal]) tipLines.push(`${sL[card.seal]} ${sealTip[card.seal]}`);
  const tip=tipLines.length?`<div class="card-tooltip">${tipLines.join('<br>')}</div>`:'';
  const cls=`shop-card${card.edition||card.seal?' has-upgrade':''}${opts.extraCls||''}`;
  const onclick=opts.onclick||'';
  const dataId=opts.dataId?` data-id="${opts.dataId}"`:'';
  return `<div class="${cls}"${dataId}${onclick?' onclick="'+onclick+'"':''}>${top}${ed}${sl}${tip}</div>`;
}

function renderShopDeck() {
  const {counts,specials}=getDeckComposition(G.fullDeck);
  const cards=[
    ...Object.entries(counts).sort((a,b)=>+a[0]-+b[0]).flatMap(([val])=>G.fullDeck.filter(c=>c.kind==='number'&&String(c.value)===val)),
    ...specials
  ];
  document.getElementById('shop-deck').innerHTML=cards.map(card=>
    deckCardHTML(card, {dataId:card.id, onclick:`selectDeckCard('${card.id}')`})
  ).join('');
}

function renderShopJokers() {
  document.getElementById('shop-jokers').innerHTML=G.jokers.length
    ?G.jokers.map(j=>`<div class="joker-card"><div class="joker-card-name">${j.name}</div><div class="joker-card-desc">${colorCode(j.desc)}</div></div>`).join('')
    :'<span class="joker-empty">Sem jokers</span>';
}

function getShopItemByKey(key) {
  const [row,idx]=key.split('_').map(Number);
  return [shopItems.packRow,shopItems.jokerRow,shopItems.upgradeRow][row]?.[idx]||null;
}

function updateMoneyDisplay() {
  document.getElementById('shop-money').textContent=`$${G.money}`;
  document.querySelectorAll('.shop-item,.shop-pack').forEach(el=>{
    const m=el.getAttribute('onclick')?.match(/clickShopItem\('([^']+)'\)/);
    if(!m) return;
    const it=getShopItemByKey(m[1]);
    if(it) el.classList.toggle('cant-afford', G.money < it.cost);
  });
  const btn=document.getElementById('btn-remove-card');
  if(btn){ btn.disabled=G.money<G.removeCost; btn.textContent=`Remover carta — $${G.removeCost}`; }
}

function clickShopItem(key) {
  const item=getShopItemByKey(key);
  if(!item) return;
  if(G.money<item.cost){
    showToast(`✗ Sem dinheiro — precisa de $${item.cost}`,'red');
    const el=document.querySelector(`[onclick="clickShopItem('${key}')"]`);
    if(el){el.classList.add('shake-no');setTimeout(()=>el.classList.remove('shake-no'),400);}
    return;
  }

  // New pack system
  if(item.type==='pack'){
    const res=buyPack(G,item);
    if(res.result!=='ok') return;
    currentPack=item;
    currentPackKey=key;
    packSelections.clear();
    updateMoneyDisplay();
    renderPackOpening();
    return;
  }

  if(item.type==='upgrade'&&(item.id==='upgrade_chips'||item.id==='upgrade_mult')){
    const kind=item.id==='upgrade_chips'?'chips':'mult';
    const cands=G.fullDeck.filter(c=>c.kind===kind);
    if(!cands.length){showToast('Nenhuma carta desse tipo!','red');return;}
    const target=cands[Math.floor(Math.random()*cands.length)];
    const result=buyItem(G,item,target.id);
    if(result.result==='ok'){
      showToast(`✓ ${item.name} em [${cardName(target)}]`);
      const [row,idx]=key.split('_').map(Number);
      [shopItems.packRow,shopItems.jokerRow,shopItems.upgradeRow][row][idx]=null;
      renderShopRows();renderShopDeck();renderShopJokers();updateMoneyDisplay();
      document.getElementById('shop-deck-count').textContent=G.fullDeck.length;
    }
    return;
  }
  const needsTarget=item.type==='remove'||(item.type==='upgrade'&&(item.edition||item.seal));
  if(needsTarget){
    pendingItem={item,key};
    document.getElementById('shop-pending').style.display='block';
    document.getElementById('shop-pending-name').textContent=item.name;
    document.getElementById('shop-pending-desc').textContent='Clique numa carta do baralho abaixo para aplicar.';
    document.querySelectorAll('.shop-card').forEach(el=>el.classList.add('selectable'));
    return;
  }
  const result=buyItem(G,item,null);
  if(result.result==='ok'){
    showToast(`✓ Comprado: ${item.name}`);
    const [row,idx]=key.split('_').map(Number);
    [shopItems.packRow,shopItems.jokerRow,shopItems.upgradeRow][row][idx]=null;
    renderShopRows();renderShopDeck();renderShopJokers();updateMoneyDisplay();
    document.getElementById('shop-deck-count').textContent=G.fullDeck.length;
  }
}

function selectDeckCard(cardId) {
  if(!pendingItem) return;
  const {item,key}=pendingItem;
  const result=buyItem(G,item,cardId);
  if(result.result==='ok'){
    const el=document.querySelector(`.shop-card[data-id="${cardId}"]`);
    if(el){el.classList.add('just-applied');setTimeout(()=>el.classList.remove('just-applied'),800);}
    const target=G.fullDeck.find(c=>c.id===cardId);
    showToast(`✓ ${item.name} em [${target?cardName(target):'carta'}]`);
    if(item.id==='remove_fixed') G.removeCost += 1;
    if(key){
      const [row,idx]=key.split('_').map(Number);
      [shopItems.packRow,shopItems.jokerRow,shopItems.upgradeRow][row][idx]=null;
    }
    pendingItem=null;
    document.getElementById('shop-pending').style.display='none';
    document.querySelectorAll('.shop-card').forEach(el=>el.classList.remove('selectable'));
    renderShopRows();renderShopDeck();updateMoneyDisplay();
    document.getElementById('shop-deck-count').textContent=G.fullDeck.length;
  } else if(result.result==='no_target'){
    showToast('Erro: carta não encontrada','red');
  }
}

function onRemoveCard() {
  const cost=G.removeCost;
  if(G.money<cost){showToast(`✗ Sem dinheiro — precisa de $${cost}`,'red');return;}
  pendingItem={item:{id:'remove_fixed',type:'remove',name:'Remover carta',cost:cost},key:null};
  document.getElementById('shop-pending').style.display='block';
  document.getElementById('shop-pending-name').textContent=`Remover carta ($${cost})`;
  document.getElementById('shop-pending-desc').textContent='Clique numa carta do baralho abaixo para remover.';
  document.querySelectorAll('.shop-card').forEach(el=>el.classList.add('selectable'));
}

// ── PACK OPENING ───────────────────────────────────────────
function renderPackOpening() {
  const pack=currentPack;
  if(!pack) return;
  const overlay=document.getElementById('pack-overlay');
  const rarityColors={common:'var(--text3)',uncommon:'var(--blue)',rare:'var(--purple)'};

  document.getElementById('pack-title').textContent=pack.name;
  const rarityEl=document.getElementById('pack-rarity');
  rarityEl.textContent=pack.rarity;
  rarityEl.style.color=rarityColors[pack.rarity]||'var(--text3)';
  document.getElementById('pack-desc').textContent=pack.desc;
  document.getElementById('pack-refund-cost').textContent=pack.cost;

  if(pack.chooseCount===0){
    document.getElementById('pack-instruction').textContent='Carta(s) do pack:';
  } else {
    document.getElementById('pack-instruction').textContent=
      `Escolha ${pack.chooseCount} opção${pack.chooseCount>1?'ões':''}:`;
  }

  const edL={gold:'✦',gleam:'◈',prism:'◉',ghost:'◌',relic:'⟡'};
  const sC={red:'#e85454',blue:'#5ab4f0',gold:'#e8c84a'};
  const sL={red:'●',blue:'◆',gold:'★'};
  const edTip={gold:'+chips ao aparecer',gleam:'+2 mult ao aparecer',prism:'+chips = score atual',ghost:'Nunca dá bust',relic:'Cava +1 extra'};
  const sealTip={red:'+1 mult ao puxar',blue:'+$1 ao terminar',gold:'×Mult no Flip7'};

  const offEl=document.getElementById('pack-offerings');
  offEl.innerHTML=pack.offerings.map((off,i)=>{
    const selected=packSelections.has(i);
    const autoSel=pack.chooseCount===0;
    // Show 1 representative card with ×N badge
    const c=off.cards[0];
    const count=off.cards.length;
    const ed=c.edition?`<span class="card-edition card-ed-${c.edition}">${edL[c.edition]}</span>`:'';
    const sl=c.seal?`<span class="card-seal seal-${c.seal}">${c.seal[0].toUpperCase()}</span>`:'';
    const countBadge=count>1?`<span class="pack-card-count">×${count}</span>`:'';
    const tipLines=[];
    if(c.edition&&edTip[c.edition]) tipLines.push(`${edL[c.edition]} ${edTip[c.edition]}`);
    if(c.seal&&sealTip[c.seal]) tipLines.push(`${sL[c.seal]} ${sealTip[c.seal]}`);
    const tip=tipLines.length?`<div class="card-tooltip">${tipLines.join('<br>')}</div>`:'';
    return `<div class="pack-offering${selected?' selected':''}${autoSel?' auto-selected':''}" onclick="togglePackSelection(${i})">
      <div class="pack-card">${c.value}${ed}${sl}${countBadge}${tip}</div>
    </div>`;
  }).join('');

  // Render current deck
  const {counts,specials}=getDeckComposition(G.fullDeck);
  const deckCards=[
    ...Object.entries(counts).sort((a,b)=>+a[0]-+b[0]).flatMap(([val])=>G.fullDeck.filter(c=>c.kind==='number'&&String(c.value)===val)),
    ...specials
  ];
  document.getElementById('pack-deck-count').textContent=G.fullDeck.length;
  document.getElementById('pack-deck').innerHTML=deckCards.map(card=>deckCardHTML(card)).join('');

  updatePackConfirmBtn();
  overlay.style.display='flex';
}

function togglePackSelection(idx) {
  if(!currentPack||currentPack.chooseCount===0) return;
  if(packSelections.has(idx)){
    packSelections.delete(idx);
  } else {
    if(packSelections.size>=currentPack.chooseCount) {
      const first=packSelections.values().next().value;
      packSelections.delete(first);
    }
    packSelections.add(idx);
  }
  renderPackOpening();
}

function updatePackConfirmBtn() {
  const btn=document.getElementById('pack-confirm');
  if(!currentPack) { btn.disabled=true; return; }
  if(currentPack.chooseCount===0) {
    btn.disabled=false;
    btn.textContent='Adicionar ao baralho';
  } else {
    const ok=packSelections.size===currentPack.chooseCount;
    btn.disabled=!ok;
    btn.textContent=ok?'Adicionar ao baralho':`Selecione ${currentPack.chooseCount-packSelections.size} opção${(currentPack.chooseCount-packSelections.size)>1?'ões':''}`;
  }
}

function onPackConfirm() {
  if(!currentPack) return;
  const indices=currentPack.chooseCount===0?[0]:[...packSelections];
  const res=confirmPack(G,currentPack,indices);
  if(res.result==='ok'){
    showToast(`✓ ${currentPack.name}: +${res.added.length} carta${res.added.length>1?'s':''}`);
    const [row,idx]=currentPackKey.split('_').map(Number);
    [shopItems.packRow,shopItems.jokerRow,shopItems.upgradeRow][row][idx]=null;
    closePackOverlay();
    renderShopRows();renderShopDeck();renderShopJokers();updateMoneyDisplay();
    document.getElementById('shop-deck-count').textContent=G.fullDeck.length;
  }
}

function onPackRefund() {
  if(!currentPack) return;
  refundPack(G,currentPack);
  showToast(`Reembolsado: ${currentPack.name} — +$${currentPack.cost}`);
  const [row,idx]=currentPackKey.split('_').map(Number);
  [shopItems.packRow,shopItems.jokerRow,shopItems.upgradeRow][row][idx]=null;
  closePackOverlay();
  renderShopRows();renderShopDeck();updateMoneyDisplay();
}

function closePackOverlay() {
  currentPack=null; currentPackKey=null; packSelections.clear();
  document.getElementById('pack-overlay').style.display='none';
}

function cancelPending() {
  pendingItem=null;
  document.getElementById('shop-pending').style.display='none';
  document.querySelectorAll('.shop-card').forEach(el=>el.classList.remove('selectable'));
}

function leaveShop() {
  const got = checkAsceta(G);
  if(got) showToast('🧘 Asceta: +1 mult perm!');
  startNextRound(G); render();
}

// ── END ────────────────────────────────────────────────────
function renderEnd(win) {
  if(win){
    document.getElementById('end-title').textContent    = 'Vitória!';
    document.getElementById('end-subtitle').textContent = `Todos os ${GAME_CONFIG.TOTAL_ROUNDS} rounds completados!`;
    document.getElementById('end-score').textContent    = G.totalScore;
    document.getElementById('end-total').textContent    = `${G.flip7Count} Flip7s`;
    document.getElementById('end-flip7s').textContent   = `Baralho final: ${G.fullDeck.length} cartas`;
  } else {
    document.getElementById('end-title').textContent    = 'Game Over';
    document.getElementById('end-subtitle').textContent = `Round ${G.round} — precisava de ${G.goal} pts`;
    document.getElementById('end-score').textContent    = G.roundScore;
    document.getElementById('end-total').textContent    = `Total acumulado: ${G.totalScore} pts`;
    document.getElementById('end-flip7s').textContent   = `${G.flip7Count} Flip7${G.flip7Count!==1?'s':''}`;
  }
}

// ── HANDLERS ──────────────────────────────────────────────
function onDraw() {
  const result=drawCard(G);
  if     (result.result==='bust')          {lastOutcome='bust';   lastBustVal=result.bustCard?.value;}
  else if(result.result==='freeze')        {lastOutcome='frozen'; lastBustVal=null;}
  else if(result.result==='freeze_ignored'){lastOutcome=null;     lastBustVal=null;}
  else if(result.result==='flip7')         {lastOutcome='flip7win';lastBustVal=null;}
  else if(result.result==='flip3')         {lastOutcome='flip3';  lastBustVal=null;showToast('⚡ FLIP3! +5 chips — continue cavando!');}
  else if(result.result==='flip5')         {lastOutcome='flip5';  lastBustVal=null;showToast('⭐ FLIP5! +1 mult — continue cavando!');}
  else if(result.result==='second_chance'){lastOutcome=null;     lastBustVal=null;showToast('🛡 Second Chance! Bust cancelado!');}
  else if(result.result==='sc')          {lastOutcome=null;     lastBustVal=null;showToast('🛡 Second Chance ativado!');}
  else                                     {lastOutcome=null;     lastBustVal=null;}
  showScreen('screen-game');
  renderGame();
  if(G.handOver&&lastOutcome!=='bust') playScoringAnimation(G);
}

function onStop() {
  const r=stopHand(G);
  if(r.result==='blocked'||r.result==='empty_table') return;
  lastOutcome='stopped'; lastBustVal=null;
  showScreen('screen-game');
  renderGame();
  playScoringAnimation(G);
}

function onDiscard() { discardTop(G); renderGame(); }

function onNext() {
  clearAnimations();
  lastOutcome=null; lastBustVal=null;
  nextHand(G);
  render();
}

function onRestart() { clearAnimations(); lastOutcome=null; lastBustVal=null; startGame(); }

// ── TOUCH TOOLTIP SUPPORT ────────────────────────────────
document.addEventListener('touchstart', function(e) {
  // Hide any currently visible tooltip
  document.querySelectorAll('.card-tooltip.show-touch').forEach(t=>t.classList.remove('show-touch'));
  // Find if we tapped something with a tooltip
  const el=e.target.closest('.card, .shop-card, .pack-card, .pack-offering');
  if(el) {
    const tip=el.querySelector('.card-tooltip');
    if(tip) { tip.classList.add('show-touch'); e.preventDefault(); }
  }
}, {passive:false});

// boot
showMenu();
