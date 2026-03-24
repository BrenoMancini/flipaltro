// ============================================================
// FLIP7 × BALATRO — game.js
// ============================================================

const GAME_CONFIG = {
  TOTAL_ROUNDS: 8,
  HANDS_PER_ROUND: 5,
  DISCARDS_PER_ROUND: 3,
  FLIP7_MULT: 2,
  FLIP5_MULT_BONUS: 1,
  STARTING_MONEY: 4,
  SHOP_ITEM_COUNT: 4,
  ROUND_GOALS: [30, 50, 80, 130, 200, 300, 450, 650],
};

function buildStarterDeck() {
  const deck = [];
  for (let n = 1; n <= 7; n++)
    for (let i = 0; i < n; i++)
      deck.push({ kind: 'number', value: n, edition: null, seal: null, id: `${n}_${i}` });
  deck.push({ kind: 'number', value: 0, edition: null, seal: null, id: '0_0' });
  deck.push({ kind: 'freeze', edition: null, seal: null, id: 'freeze_0' });
  deck.push({ kind: 'flip2',  edition: null, seal: null, id: 'flip2_0' });
  deck.push({ kind: 'chips',  value: 5, edition: null, seal: null, id: 'chips_0' });
  deck.push({ kind: 'mult',   value: 1, edition: null, seal: null, id: 'mult_0' });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createGameState() {
  return {
    phase: 'game',
    round: 1, handNum: 1,
    totalScore: 0, roundScore: 0,
    goal: GAME_CONFIG.ROUND_GOALS[0],
    money: GAME_CONFIG.STARTING_MONEY,
    handsLeft: GAME_CONFIG.HANDS_PER_ROUND,
    discardsLeft: GAME_CONFIG.DISCARDS_PER_ROUND,
    flip7Count: 0,
    fullDeck: buildStarterDeck(),
    deck: [], discardPile: [], table: [],
    seen: new Set(),
    chips: 0, mult: 1, mustDraw: 0,
    handOver: false, lastReason: null, roundWon: false, roundWonHandsBonus: 0,
    blueSealCount: 0, flip5Done: false,
    secondChance: false,
    permanentMult: 0,
    removeCost: 2, removeCount: 0,
    jokers: [], log: [],
  };
}

function liveScore(state) { return state.chips * state.mult; }

// Aplica edição em qualquer carta (number, freeze, flip2, chips, mult)
function applyEditionOnDraw(state, card) {
  if (!card.edition) return;
  if (card.edition === 'gold') {
    // valor base: número da carta ou 5 pra cartas especiais
    const bonus = (card.kind === 'number') ? card.value : 5;
    state.chips += bonus;
    addLog(state, `✦ Dourada [${cardName(card)}]: +${bonus} chips → ${liveScore(state)}`);
  }
  if (card.edition === 'gleam') {
    state.mult += 2;
    addLog(state, `◈ Reluzente [${cardName(card)}]: +2 mult → ${liveScore(state)}`);
  }
  if (card.edition === 'prism' && card.kind === 'number') {
    const bonus = liveScore(state);
    state.chips += bonus;
    addLog(state, `◉ Prisma [${cardName(card)}]: +${bonus} chips bônus → ${liveScore(state)}`);
  }
  if (card.edition === 'relic') {
    state.mustDraw += 1;
    addLog(state, `⟡ Relíquia [${cardName(card)}]: cava +1 extra`);
  }
  // ghost não tem efeito de draw, só evita bust
}

function initRound(state) {
  state.deck = shuffle([...state.fullDeck]);
  state.discardPile = [];
  state.handNum = 1;
  state.roundScore = 0;
  state.roundWon = false;
  state.roundWonHandsBonus = 0;
  state.handsLeft = GAME_CONFIG.HANDS_PER_ROUND;
  state.discardsLeft = GAME_CONFIG.DISCARDS_PER_ROUND;
  state.goal = GAME_CONFIG.ROUND_GOALS[state.round - 1];
  startHand(state);
}

function startHand(state) {
  state.table = [];
  state.seen = new Set();
  state.chips = 0; state.mult = 1 + state.permanentMult; state.mustDraw = 0;
  state.handOver = false; state.lastReason = null; state.blueSealCount = 0; state.flip5Done = false;
  state.secondChance = false;
  addLog(state, `— Mão ${state.handNum} (deck:${state.deck.length} desc:${state.discardPile.length}) —`);
}

function maybeReshuffle(state) {
  if (state.deck.length === 0 && state.discardPile.length > 0) {
    state.deck = shuffle([...state.discardPile]);
    state.discardPile = [];
    addLog(state, 'Deck vazio — descarte reembaralhado!');
    return true;
  }
  return false;
}

function drawCard(state) {
  if (state.handOver) return { result: 'already_over' };
  maybeReshuffle(state);
  if (state.deck.length === 0) return { result: 'empty' };

  const card = state.deck.shift();
  state.table.push(card);

  // FREEZE
  if (card.kind === 'freeze') {
    if (state.mustDraw > 0) {
      state.mustDraw--;
      applyEditionOnDraw(state, card); // aplica mesmo ignorado
      addLog(state, `Freeze — ignorado pelo Flip2. (${state.mustDraw} restantes)`);
      return { result: 'freeze_ignored', card };
    }
    applyEditionOnDraw(state, card); // aplica ANTES de pontuar
    return endHand(state, 'freeze');
  }

  // FLIP2
  if (card.kind === 'flip2') {
    applyEditionOnDraw(state, card);
    state.mustDraw += 2;
    addLog(state, `Flip2! Deve cavar mais ${state.mustDraw}.`);
    return { result: 'flip2', card };
  }

  // +CHIPS card
  if (card.kind === 'chips') {
    state.chips += card.value;
    applyEditionOnDraw(state, card);
    if (state.mustDraw > 0) state.mustDraw--;
    addLog(state, `+${card.value} chips → score:${liveScore(state)}`);
    return { result: 'chips', card };
  }

  // +MULT card
  if (card.kind === 'mult') {
    state.mult += card.value;
    applyEditionOnDraw(state, card);
    if (state.mustDraw > 0) state.mustDraw--;
    addLog(state, `+${card.value} mult → score:${liveScore(state)}`);
    return { result: 'mult', card };
  }

  // SECOND CHANCE
  if (card.kind === 'sc') {
    state.secondChance = true;
    applyEditionOnDraw(state, card);
    if (state.mustDraw > 0) state.mustDraw--;
    addLog(state, `🛡 Second Chance ativado! Próximo bust será cancelado.`);
    return { result: 'sc', card };
  }

  // NUMBER
  if (card.kind === 'number') {
    if (card.edition !== 'ghost' && state.seen.has(card.value)) {
      if (state.secondChance) {
        state.secondChance = false;
        addLog(state, `🛡 Second Chance! Bust no ${card.value} cancelado!`);
        // remove a carta duplicada da mesa
        state.table.pop();
        state.discardPile.push(card);
        return { result: 'second_chance', card };
      }
      return endHand(state, 'bust', card);
    }

    state.seen.add(card.value);
    state.chips += card.value;
    applyEditionOnDraw(state, card); // gold dá bônus extra, gleam +mult, etc
    if (card.seal === 'red') { state.mult += 1; addLog(state, `● Selo Vermelho: +1 mult → ${liveScore(state)}`); }
    if (card.seal === 'blue') state.blueSealCount++;
    if (state.mustDraw > 0) state.mustDraw--;
    addLog(state, `Puxou ${card.value} — score:${liveScore(state)} (${state.seen.size} únicos)`);

    // FLIP5 — bônus intermediário, mão continua
    if (state.seen.size === 5 && !state.flip5Done) {
      state.mult += GAME_CONFIG.FLIP5_MULT_BONUS;
      state.flip5Done = true;
      addLog(state, `⭐ FLIP5! +${GAME_CONFIG.FLIP5_MULT_BONUS} mult → score:${liveScore(state)}`);
      return { result: 'flip5', card };
    }

    if (state.seen.size === 7) return endHand(state, 'flip7');
    return { result: 'ok', card };
  }

  return { result: 'unknown' };
}

function discardTop(state) {
  if (state.handOver || state.discardsLeft <= 0 || state.mustDraw > 0) return { result: 'blocked' };
  maybeReshuffle(state);
  if (state.deck.length === 0) return { result: 'empty' };
  const card = state.deck.shift();
  state.discardPile.push(card);
  state.discardsLeft--;
  addLog(state, `Descartou [${cardName(card)}] do topo. (${state.discardsLeft} restantes)`);
  return { result: 'discarded', card };
}

function stopHand(state) {
  if (state.handOver || state.mustDraw > 0) return { result: 'blocked' };
  if (state.table.length === 0) return { result: 'empty_table' };
  return endHand(state, 'stop');
}

function endHand(state, reason, bustCard) {
  state.handOver = true;
  state.lastReason = reason;
  state.discardPile.push(...state.table);
  let earned = 0;

  if (reason === 'bust') {
    addLog(state, `BUST no ${bustCard.value}! 0 pts.`);
  } else if (reason === 'freeze') {
    earned = liveScore(state);
    state.money += state.blueSealCount;
    addLog(state, `Freeze! ${earned} pts.${state.blueSealCount > 0 ? ` +$${state.blueSealCount} (azul)` : ''}`);
  } else if (reason === 'flip7') {
    state.mult *= GAME_CONFIG.FLIP7_MULT;
    earned = liveScore(state);
    state.flip7Count++;
    state.money += state.blueSealCount;
    addLog(state, `🌟 FLIP7! mult×${GAME_CONFIG.FLIP7_MULT} → score:${earned} pts!${state.blueSealCount > 0 ? ` +$${state.blueSealCount}` : ''}`);
  } else {
    earned = liveScore(state);
    state.money += state.blueSealCount;
    addLog(state, `Parou com ${earned} pts.${state.blueSealCount > 0 ? ` +$${state.blueSealCount} (azul)` : ''}`);
  }

  for (const joker of state.jokers) earned = applyJokerEndHand(joker, state, earned, reason);

  state.roundScore += earned;
  state.totalScore += earned;
  if (reason !== 'freeze') state.handsLeft--;
  if (state.roundScore >= state.goal) state.roundWon = true;
  return { result: reason, earned, bustCard };
}

function applyJokerEndHand(joker, state, earned, reason) {
  if (joker.id === 'joker_greedy'   && reason !== 'bust')   return earned + 10;
  if (joker.id === 'joker_flip7fan' && reason === 'flip7')  return earned * 2;
  if (joker.id === 'joker_stoic'    && reason === 'stop' && state.table.filter(c => c.kind === 'number').length === 1)  { state.permanentMult += 1; addLog(state, `🗿 Estoico: +1 mult permanente!`); return earned + state.chips; }
  if (joker.id === 'joker_phoenix'  && reason === 'bust')   { state.roundScore += 5; return 5; }
  if (joker.id === 'joker_banker'   && reason !== 'bust')   { state.money += 1; addLog(state, `💰 Banqueiro: +$1`); }
  if (joker.id === 'joker_pentacle' && state.flip5Done)      return earned + 15;
  if (joker.id === 'joker_catalyst' && state.flip5Done)      return earned * 2;
  if (joker.id === 'joker_accumulator' && state.flip5Done)  { state.permanentMult += 1; addLog(state, `⚡ Acumulador: +1 mult permanente!`); }
  return earned;
}

function nextHand(state) {
  if (state.roundWon) {
    const hb = state.handsLeft;
    state.money += moneyFromRound(state);
    state.roundWonHandsBonus = hb;
    state.phase = state.round >= GAME_CONFIG.TOTAL_ROUNDS ? 'win' : 'shop';
    return;
  }
  if (state.handsLeft <= 0) {
    if (state.roundScore >= state.goal) {
      state.phase = state.round >= GAME_CONFIG.TOTAL_ROUNDS ? 'win' : 'shop';
      if (state.phase === 'shop') state.money += moneyFromRound(state);
    } else {
      state.phase = 'gameover';
    }
    return;
  }
  if (state.lastReason !== 'freeze') state.handNum++;
  startHand(state);
}

function moneyFromRound(state) {
  const excess = Math.floor(Math.max(0, state.roundScore - state.goal) / 10);
  return Math.min(12, 5 + state.handsLeft + excess);
}

// ============================================================
// SHOP
// ============================================================

const SHOP_CATALOG = [
  // ── JOKERS ──
  { id: 'joker_greedy',   type: 'joker', name: 'Avarento',   desc: '+10 pts em toda mão não-bust',      cost: 6, rarity: 'common' },
  { id: 'joker_flip7fan', type: 'joker', name: 'Fanático',   desc: 'Flip7 vale ×2',                     cost: 8, rarity: 'uncommon' },
  { id: 'joker_stoic',    type: 'joker', name: 'Estoico',      desc: 'Parou com exatamente 1 carta numérica → +1 mult permanente', cost: 5, rarity: 'common' },
  { id: 'joker_phoenix',  type: 'joker', name: 'Fênix',      desc: 'Bust gera +5 pts',                  cost: 5, rarity: 'common' },
  { id: 'joker_banker',   type: 'joker', name: 'Banqueiro',  desc: 'Toda mão jogada +$1',               cost: 6, rarity: 'uncommon' },
  { id: 'joker_pentacle', type: 'joker', name: 'Pentâculo',  desc: 'Flip5 → +15 pts',                   cost: 6, rarity: 'common' },
  { id: 'joker_catalyst', type: 'joker', name: 'Catalisador', desc: 'Flip5 → Score ×2',                 cost: 8, rarity: 'uncommon' },
  { id: 'joker_accumulator', type: 'joker', name: 'Acumulador', desc: 'Flip5 no run → +1 mult permanente', cost: 9, rarity: 'rare' },
  { id: 'joker_daredevil',type: 'joker', name: 'Temerário',  desc: 'Cada bust +3 mult próxima mão',     cost: 9, rarity: 'rare' },

  // ── PACKS DE CARTAS (fileira 1) ──
  // Números únicos
  { id: 'card_8',   type: 'card',  name: 'Carta 8',      desc: 'Adiciona 8 ao baralho (1 cópia)',      cost: 4,  value: 8,  count: 1, rarity: 'common' },
  { id: 'card_9',   type: 'card',  name: 'Carta 9',      desc: 'Adiciona 9 ao baralho (1 cópia)',      cost: 5,  value: 9,  count: 1, rarity: 'uncommon' },
  { id: 'card_10',  type: 'card',  name: 'Carta 10',     desc: 'Adiciona 10 ao baralho (1 cópia)',     cost: 6,  value: 10, count: 1, rarity: 'uncommon' },
  { id: 'card_11',  type: 'card',  name: 'Carta 11',     desc: 'Adiciona 11 ao baralho (1 cópia)',     cost: 7,  value: 11, count: 1, rarity: 'rare' },
  { id: 'card_12',  type: 'card',  name: 'Carta 12',     desc: 'Adiciona 12 ao baralho (1 cópia)',     cost: 8,  value: 12, count: 1, rarity: 'rare' },
  // ── BOOSTERS UNO (carta única c/ edição/selo) ──
  { id:'booster_uno_common',   type:'booster', subtype:'uno', name:'Pack Uno',        desc:'3 cartas únicas — escolha 1',              cost:4,  rarity:'common',   picks:3, choose:1, guaranteed_rare:false },
  { id:'booster_uno_uncommon', type:'booster', subtype:'uno', name:'Pack Uno+',       desc:'3 cartas c/ edições — escolha 1',          cost:7,  rarity:'uncommon', picks:3, choose:1, guaranteed_rare:false },
  { id:'booster_uno_rare',     type:'booster', subtype:'uno', name:'Jumbo Uno',       desc:'5 cartas — escolha 2, 1 raro garantido',   cost:12, rarity:'rare',     picks:5, choose:2, guaranteed_rare:true  },
  // ── BOOSTERS PACK (NxN cópias) ──
  { id:'booster_pack_common',   type:'booster', subtype:'pack', name:'Pack Clássico',  desc:'3 opções NxN — escolha 1',                cost:5,  rarity:'common',   picks:3, choose:1 },
  { id:'booster_pack_uncommon', type:'booster', subtype:'pack', name:'Pack Clássico+', desc:'3 opções NxN — escolha 1',                cost:8,  rarity:'uncommon', picks:3, choose:1 },
  { id:'booster_pack_rare',     type:'booster', subtype:'pack', name:'Jumbo Clássico', desc:'5 opções NxN — escolha 2',                cost:13, rarity:'rare',     picks:5, choose:2 },
  // ── BOOSTERS COMBO (cópias assimétricas c/ bônus) ──
  { id:'booster_combo_common',   type:'booster', subtype:'combo', name:'Pack Combo',   desc:'até 2 cópias c/ edição ou selo',          cost:6,  rarity:'common',   picks:3, choose:1, max_copies:2 },
  { id:'booster_combo_uncommon', type:'booster', subtype:'combo', name:'Pack Combo+',  desc:'até 3 cópias c/ edição ou selo',          cost:9,  rarity:'uncommon', picks:3, choose:1, max_copies:3 },
  { id:'booster_combo_rare',     type:'booster', subtype:'combo', name:'Jumbo Combo',  desc:'até 3 cópias c/ edição E selo',           cost:14, rarity:'rare',     picks:5, choose:2, max_copies:3 },
  // ── BOOSTERS JOKERS ──
  { id:'booster_jok_common',   type:'booster', subtype:'jokers', name:'Pack de Jokers',       desc:'2 jokers — escolha 1',              cost:5,  rarity:'common',   picks:2, choose:1, guaranteed_rare:false },
  { id:'booster_jok_uncommon', type:'booster', subtype:'jokers', name:'Pack de Jokers+',      desc:'2 jokers qualquer rar — escolha 1', cost:8,  rarity:'uncommon', picks:2, choose:1, guaranteed_rare:false },
  { id:'booster_jok_rare',     type:'booster', subtype:'jokers', name:'Jumbo Pack de Jokers', desc:'3 jokers — escolha 1, 1 raro grtd', cost:13, rarity:'rare',     picks:3, choose:1, guaranteed_rare:true  },
  // Cartas especiais extras
  { id: 'extra_freeze', type: 'special', name: '+ Freeze',  desc: 'Adiciona 1 Freeze ao baralho',      cost: 3,  kind: 'freeze', rarity: 'common' },
  { id: 'extra_flip2',  type: 'special', name: '+ Flip2',   desc: 'Adiciona 1 Flip2 ao baralho',       cost: 3,  kind: 'flip2',  rarity: 'common' },
  { id: 'extra_chips',  type: 'special', name: '+ Chips',   desc: 'Adiciona 1 carta +5 chips ao baralho', cost: 4, kind: 'chips', value: 5, rarity: 'common' },
  { id: 'extra_mult',   type: 'special', name: '+ Mult',    desc: 'Adiciona 1 carta +1 mult ao baralho',  cost: 5, kind: 'mult',  value: 1, rarity: 'uncommon' },
  { id: 'second_chance', type: 'special', name: 'Second Chance', desc: 'Ao bustar, cancela o bust uma vez por mão', cost: 6, kind: 'sc', rarity: 'uncommon' },

  // ── UPGRADES (fileira 3) ──
  { id: 'upgrade_chips', type: 'upgrade', name: '+5 Chips', desc: 'Carta +chips do baralho vale +5',   cost: 3, rarity: 'common' },
  { id: 'upgrade_mult',  type: 'upgrade', name: '+1 Mult',  desc: 'Carta +mult do baralho vale +1',    cost: 4, rarity: 'common' },
  { id: 'ed_gold',   type: 'upgrade', name: 'Ed. Dourada',  desc: '✦ +chips ao aparecer (qualquer carta)', cost: 4, edition: 'gold',  rarity: 'common' },
  { id: 'ed_gleam',  type: 'upgrade', name: 'Ed. Reluzente',desc: '◈ +2 mult ao aparecer',              cost: 5, edition: 'gleam', rarity: 'uncommon' },
  { id: 'ed_prism',  type: 'upgrade', name: 'Ed. Prisma',   desc: '◉ Pontua score atual como bônus',    cost: 8, edition: 'prism', rarity: 'rare' },
  { id: 'ed_ghost',  type: 'upgrade', name: 'Ed. Fantasma', desc: '◌ Nunca dá bust, pontua normalmente',cost: 9, edition: 'ghost', rarity: 'rare' },
  { id: 'ed_relic',  type: 'upgrade', name: 'Ed. Relíquia', desc: '⟡ Ao aparecer, cava +1 extra',       cost: 6, edition: 'relic', rarity: 'uncommon' },
  { id: 'seal_red',  type: 'upgrade', name: 'Selo Vermelho',desc: '● +1 mult por carta puxada nessa mão',cost: 5, seal: 'red',  rarity: 'uncommon' },
  { id: 'seal_blue', type: 'upgrade', name: 'Selo Azul',    desc: '◆ +$1 por carta puxada ao terminar', cost: 4, seal: 'blue', rarity: 'common' },
  { id: 'seal_gold', type: 'upgrade', name: 'Selo Dourado', desc: '★ No Flip7, carta ×Mult',            cost: 10, seal: 'gold', rarity: 'rare' },
];

function generateBoosterContents(item, state) {
  const ALL_NUMS = [0,1,2,3,4,5,6,7,8,9,10,11,12];
  const owned = new Set(state.fullDeck.filter(c=>c.kind==='number').map(c=>c.value));

  if (item.subtype === 'uno') {
    const edPools = {
      common:   [null,null,null,'gold','gold','relic'],
      uncommon: [null,null,'gold','gleam','relic','ghost'],
      rare:     [null,'gold','gleam','relic','ghost','prism'],
    };
    const sealPools = {
      common:   [null,null,null,null,'red','blue'],
      uncommon: [null,null,null,'red','blue','gold'],
      rare:     [null,null,'red','blue','gold','gold'],
    };
    const notOwned = ALL_NUMS.filter(n=>!owned.has(n));
    const pool = notOwned.length >= item.picks ? notOwned : [...notOwned,...ALL_NUMS.filter(n=>owned.has(n))];
    const cards=[]; const used=new Set(); let rareDone=false;
    while(cards.length < item.picks) {
      const avail=pool.filter(v=>!used.has(v));
      if(!avail.length) break;
      const val=avail[Math.floor(Math.random()*avail.length)];
      used.add(val);
      let ed=edPools[item.rarity][Math.floor(Math.random()*edPools[item.rarity].length)];
      let seal=sealPools[item.rarity][Math.floor(Math.random()*sealPools[item.rarity].length)];
      if(item.guaranteed_rare && !rareDone && cards.length===item.picks-1){
        ed=['prism','ghost'][Math.floor(Math.random()*2)]; rareDone=true;
      }
      cards.push({kind:'number',value:val,edition:ed,seal,id:`${val}_b_${Date.now()}_${cards.length}`,_isNew:!owned.has(val)});
    }
    return cards;
  }

  if (item.subtype === 'pack') {
    // Oferece valores para adicionar NxN cópias (N cópias do número N)
    const pool = shuffle([...ALL_NUMS.filter(n=>n>0)]).slice(0, item.picks);
    return pool.map(n=>({kind:'number',value:n,count:n,_isPack:true,id:`pack_${n}_${Date.now()}`}));
  }

  if (item.subtype === 'combo') {
    const maxCopies = item.max_copies || 2;
    const edPool  = item.rarity==='rare' ? ['gold','gleam','relic','ghost','prism'] : ['gold','gleam','relic'];
    const sealPool = item.rarity==='rare' ? ['red','blue','gold'] : ['red','blue'];
    const vals = shuffle([...ALL_NUMS.filter(n=>n>0)]).slice(0, item.picks);
    return vals.map(val => {
      const copies = 1 + Math.floor(Math.random() * maxCopies);
      return Array.from({length:copies}, (_,i) => {
        let ed=null, seal=null;
        if(item.rarity==='rare') {
          ed   = edPool[Math.floor(Math.random()*edPool.length)];
          seal = sealPool[Math.floor(Math.random()*sealPool.length)];
        } else {
          if(Math.random()<0.5) ed   = edPool[Math.floor(Math.random()*edPool.length)];
          else                  seal = sealPool[Math.floor(Math.random()*sealPool.length)];
        }
        return {kind:'number',value:val,edition:ed,seal,id:`${val}_combo_${Date.now()}_${i}`};
      });
    });
  }

  // jokers
  const ownedIds=state.jokers.map(j=>j.id);
  const allowed={common:['common','uncommon'],uncommon:['common','uncommon','rare'],rare:['common','uncommon','rare']}[item.rarity];
  let pool=SHOP_CATALOG.filter(i=>i.type==='joker'&&!ownedIds.includes(i.id)&&allowed.includes(i.rarity));
  if(item.guaranteed_rare && !pool.some(i=>i.rarity==='rare'))
    pool=SHOP_CATALOG.filter(i=>i.type==='joker'&&i.rarity==='rare');
  return pickN(pool.flatMap(i=>i.rarity==='common'?[i,i,i]:i.rarity==='uncommon'?[i,i]:[i]),item.picks);
}

function applyBoosterChoice(state, item, chosenIndices, contents) {
  for(const idx of chosenIndices) {
    const pick=contents[idx];
    if(item.subtype==='uno') {
      state.fullDeck.push({kind:'number',value:pick.value,edition:pick.edition,seal:pick.seal,id:pick.id});
      addLog(state,`Uno: +${pick.value}${pick.edition?' ['+pick.edition+']':''}${pick.seal?' ('+pick.seal+')':''}`);
    } else if(item.subtype==='pack') {
      for(let i=0;i<pick.count;i++)
        state.fullDeck.push({kind:'number',value:pick.value,edition:null,seal:null,id:`${pick.value}_pk_${Date.now()}_${i}`});
      addLog(state,`Pack: +${pick.count}×${pick.value} ao baralho`);
    } else if(item.subtype==='combo') {
      // pick is an array of cards
      for(const card of pick)
        state.fullDeck.push({kind:'number',value:card.value,edition:card.edition,seal:card.seal,id:card.id});
      addLog(state,`Combo: +${pick.length}×${pick[0].value}${pick.map(c=>(c.edition?'['+c.edition+']':'')+(c.seal?'('+c.seal+')':'')).join(' ')}`);
    } else {
      state.jokers.push({id:pick.id,name:pick.name,desc:pick.desc});
      addLog(state,`Booster: joker ${pick.name}`);
    }
  }
}

function generateShop(state) {
  const owned = state.jokers.map(j => j.id);

  // Fileira 1: 2 boosters
  const boosterPool = SHOP_CATALOG.filter(i => i.type === 'booster');
  const packRow = pickN(boosterPool.flatMap(i => i.rarity==='common'?[i,i,i]:i.rarity==='uncommon'?[i,i]:[i]), 2);

  // Fileira 2: 2 jokers não comprados
  const jokerPool = SHOP_CATALOG.filter(i => i.type === 'joker' && !owned.includes(i.id));
  const jokerRow = pickN(jokerPool.flatMap(i => i.rarity==='common'?[i,i,i]:i.rarity==='uncommon'?[i,i]:[i]), 2);

  // Fileira 3: 2 upgrades (chips, mult, edições, selos)
  const upgradePool = SHOP_CATALOG.filter(i => i.type === 'upgrade');
  const upgradeRow = pickN(upgradePool.flatMap(i => i.rarity==='common'?[i,i,i]:i.rarity==='uncommon'?[i,i]:[i]), 2);

  return { packRow, jokerRow, upgradeRow };
}

function pickN(weighted, n) {
  const result = []; const used = new Set();
  const pool = [...weighted];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const item = pool[idx];
    if (!used.has(item.id)) { result.push(item); used.add(item.id); }
    pool.splice(idx, 1);
  }
  return result;
}

function buyItem(state, item, targetCardId) {
  if (state.money < item.cost) return { result: 'no_money' };
  state.money -= item.cost;

  if (item.type === 'booster') {
    const contents = generateBoosterContents(item, state);
    return { result: 'open_booster', contents, item };
  }
  if (item.type === 'joker') {
    state.jokers.push({ id: item.id, name: item.name, desc: item.desc });
    addLog(state, `Comprou joker: ${item.name}`);
    return { result: 'ok' };
  }
  if (item.type === 'card') {
    for (let i = 0; i < item.value; i++)
      state.fullDeck.push({ kind: 'number', value: item.value, edition: null, seal: null, id: `${item.value}_b_${Date.now()}_${i}` });
    addLog(state, `+${item.value}× carta ${item.value} ao baralho (regra NxN)`);
    return { result: 'ok' };
  }
  if (item.type === 'pack') {
    for (let i = 0; i < item.count; i++)
      state.fullDeck.push({ kind: 'number', value: item.value, edition: null, seal: null, id: `${item.value}_pk_${Date.now()}_${i}` });
    addLog(state, `Pack: +${item.count}×${item.value} ao baralho`);
    return { result: 'ok' };
  }
  if (item.type === 'special') {
    state.fullDeck.push({ kind: item.kind, value: item.value || undefined, edition: null, seal: null, id: `${item.kind}_extra_${Date.now()}` });
    addLog(state, `+${item.kind} ao baralho`);
    return { result: 'ok' };
  }
  if (item.type === 'edition' || item.type === 'seal') {
    const target = state.fullDeck.find(c => c.id === targetCardId);
    if (!target) return { result: 'no_target' };
    if (item.type === 'edition') target.edition = item.edition;
    else target.seal = item.seal;
    addLog(state, `Aplicou ${item.name} em [${cardName(target)}]`);
    return { result: 'ok', targetCard: target };
  }
  if (item.type === 'remove') {
    const idx = state.fullDeck.findIndex(c => c.id === targetCardId);
    if (idx === -1) return { result: 'no_target' };
    const removed = state.fullDeck.splice(idx, 1)[0];
    addLog(state, `Removeu [${cardName(removed)}] do baralho`);
    return { result: 'ok' };
  }
  if (item.type === 'upgrade') {
    if (item.id === 'upgrade_chips') {
      const c = targetCardId
        ? state.fullDeck.find(c => c.id === targetCardId)
        : state.fullDeck.filter(c => c.kind === 'chips')[Math.floor(Math.random() * state.fullDeck.filter(c => c.kind === 'chips').length)];
      if (c) { c.value += 5; addLog(state, `+chips [${c.id}] agora vale ${c.value}`); }
      return { result: 'ok' };
    }
    if (item.id === 'upgrade_mult') {
      const c = targetCardId
        ? state.fullDeck.find(c => c.id === targetCardId)
        : state.fullDeck.filter(c => c.kind === 'mult')[Math.floor(Math.random() * state.fullDeck.filter(c => c.kind === 'mult').length)];
      if (c) { c.value += 1; addLog(state, `+mult [${c.id}] agora vale ${c.value}`); }
      return { result: 'ok' };
    }
    // edições e selos — precisam de carta alvo
    if (item.edition || item.seal) {
      if (!targetCardId) return { result: 'need_target' };
      const target = state.fullDeck.find(c => c.id === targetCardId);
      if (!target) return { result: 'no_target' };
      if (item.edition) target.edition = item.edition;
      if (item.seal)    target.seal    = item.seal;
      addLog(state, `Aplicou ${item.name} em [${cardName(target)}]`);
      return { result: 'ok', targetCard: target };
    }
    return { result: 'ok' };
  }
  return { result: 'unknown' };
}

function startNextRound(state) { state.round++; state.phase = 'game'; initRound(state); }

function cardName(card) {
  if (!card) return '?';
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'freeze') return 'Freeze';
  if (card.kind === 'flip2')  return 'Flip2';
  if (card.kind === 'chips')  return `+${card.value}chips`;
  if (card.kind === 'mult')   return `+${card.value}mult`;
  if (card.kind === 'sc')     return 'Second Chance';
  return '?';
}

function addLog(state, msg) { state.log.unshift(msg); if (state.log.length > 60) state.log.pop(); }

function getDeckComposition(deck) {
  const counts = {}; const specials = [];
  for (const c of deck) { if (c.kind === 'number') counts[c.value] = (counts[c.value] || 0) + 1; else specials.push(c); }
  return { counts, specials };
}
