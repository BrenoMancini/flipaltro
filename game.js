// ============================================================
// FLIP7 × BALATRO — game.js
// ============================================================

const GAME_CONFIG = {
  TOTAL_ROUNDS: 8,
  HANDS_PER_ROUND: 5,
  DISCARDS_PER_ROUND: 5,
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
    flip7Count: 0, flip7sThisRound: 0, flip5sThisRound: 0,
    fullDeck: buildStarterDeck(),
    deck: [], discardPile: [], table: [],
    seen: new Set(),
    chips: 0, mult: 1, mustDraw: 0,
    handOver: false, lastReason: null, roundWon: false, roundWonHandsBonus: 0,
    blueSealCount: 0, flip5Done: false, flip3Done: false,
    secondChance: false,
    permanentMult: 0, permanentChips: 0,
    removeCost: 2,
    boughtThisRound: 0,
    protectorCounter: 0,
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

function applyJokerOnDraw(state, card) {
  if (card.kind !== 'number') return;
  const v = card.value;
  for (const joker of state.jokers) {
    if (joker.id === 'joker_even' && v % 2 === 0 && v > 0) {
      state.mult += 1; addLog(state, `⚖️ Par: +1 mult → ${liveScore(state)}`);
    }
    if (joker.id === 'joker_odd' && v % 2 !== 0) {
      state.mult += 1; addLog(state, `🎲 Ímpar: +1 mult → ${liveScore(state)}`);
    }
    if (joker.id === 'joker_humble' && (v === 0 || v === 1)) {
      state.mult = Math.ceil(state.mult * 1.5);
      addLog(state, `🙏 Humilde: ×1.5 mult → ${liveScore(state)}`);
    }
    if (joker.id === 'joker_sequence') {
      const s = state.seen;
      let bonus = 0;
      for (const x of [v - 2, v - 1, v]) {
        if (x >= 0 && s.has(x) && s.has(x + 1) && s.has(x + 2)) bonus += 3;
      }
      if (bonus > 0) { state.mult += bonus; addLog(state, `🔢 Sequência: +${bonus} mult → ${liveScore(state)}`); }
    }
  }
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
  state.flip7sThisRound = 0; state.flip5sThisRound = 0;
  state.boughtThisRound = 0;
  state.goal = GAME_CONFIG.ROUND_GOALS[state.round - 1];
  startHand(state);
}

function startHand(state) {
  state.table = [];
  state.seen = new Set();
  state.chips = state.permanentChips; state.mult = 1 + state.permanentMult; state.mustDraw = 0;
  state.handOver = false; state.lastReason = null; state.blueSealCount = 0;
  state.flip5Done = false; state.flip3Done = false;
  state.secondChance = false;
  state.protectorCounter = 0;
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
    // Protetor: a cada 3 cartas numéricas, protege de bust
    const hasProtetor = state.jokers.some(j => j.id === 'joker_protector');
    let protectorBlocked = false;
    if (hasProtetor) {
      state.protectorCounter++;
      if (state.protectorCounter % 3 === 0) protectorBlocked = state.seen.has(card.value);
    }

    if (card.edition !== 'ghost' && !protectorBlocked && state.seen.has(card.value)) {
      if (state.secondChance) {
        state.secondChance = false;
        for (const j of state.jokers)
          if (j.id === 'joker_twins') { state.permanentMult = Math.round((state.permanentMult + 2) * 100) / 100; addLog(state, `👥 Gêmeos: +2 mult perm!`); }
        addLog(state, `🛡 Second Chance! Bust no ${card.value} cancelado!`);
        state.table.pop(); state.discardPile.push(card);
        return { result: 'second_chance', card };
      }
      return endHand(state, 'bust', card);
    }
    if (protectorBlocked) addLog(state, `🛡 Protetor: bust em ${card.value} bloqueado! (${state.protectorCounter}ª carta)`);

    state.seen.add(card.value);
    state.chips += card.value;
    applyEditionOnDraw(state, card);
    applyJokerOnDraw(state, card);
    if (card.seal === 'red') { state.mult += 1; addLog(state, `● Selo Vermelho: +1 mult → ${liveScore(state)}`); }
    if (card.seal === 'blue') state.blueSealCount++;
    if (state.mustDraw > 0) state.mustDraw--;
    addLog(state, `Puxou ${card.value} — score:${liveScore(state)} (${state.seen.size} únicos)`);

    // FLIP3 — bônus intermediário
    if (state.seen.size === 3 && !state.flip3Done) {
      state.chips += 5;
      state.flip3Done = true;
      addLog(state, `⚡ FLIP3! +5 chips → score:${liveScore(state)}`);
      return { result: 'flip3', card };
    }

    // FLIP5 — bônus intermediário, mão continua
    if (state.seen.size === 5 && !state.flip5Done) {
      state.mult += GAME_CONFIG.FLIP5_MULT_BONUS;
      state.flip5Done = true;
      state.flip5sThisRound++;
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
    state.flip7Count++; state.flip7sThisRound++;
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

function rollAcaso() {
  const r = Math.random();
  if (r < 0.50) return Math.floor(Math.random() * 4) + 1;   // 1-4  (50%)
  if (r < 0.75) return Math.floor(Math.random() * 4) + 5;   // 5-8  (25%)
  if (r < 0.90) return Math.floor(Math.random() * 4) + 9;   // 9-12 (15%)
  return Math.floor(Math.random() * 3) + 13;                 // 13-15 (10%)
}

function applyJokerEndHand(joker, state, earned, reason) {
  // ── Jokers de pontuação ─────────────────────────────────
  if (joker.id === 'joker_greedy' && reason !== 'bust') {
    addLog(state, `💰 Avarento: +10 pts`); return earned + 10;
  }
  if (joker.id === 'joker_flip7fan' && reason === 'flip7') {
    addLog(state, `🌀 Fanático: ×3`); return earned * 3;
  }
  if (joker.id === 'joker_stoic' && reason === 'stop' && state.table.filter(c => c.kind === 'number').length === 1) {
    state.permanentMult = Math.round((state.permanentMult + 1) * 100) / 100;
    addLog(state, `🗿 Estoico: +1 mult perm → total ${state.permanentMult}`);
    return earned + state.chips;
  }
  if (joker.id === 'joker_phoenix' && reason === 'bust') {
    const half = Math.floor(state.chips * state.mult / 2);
    addLog(state, `🦅 Fênix: bust → ${half} pts (metade)`); return half;
  }
  if (joker.id === 'joker_daredevil' && reason === 'bust') {
    state.permanentMult = Math.round((state.permanentMult + 0.1) * 100) / 100;
    addLog(state, `😈 Temerário: bust → +0.1 mult perm! Total ${state.permanentMult}`);
  }
  if (joker.id === 'joker_banker' && reason !== 'bust') {
    state.money += 1; addLog(state, `🏦 Banqueiro: +$1`);
  }
  // ── Flip5 ───────────────────────────────────────────────
  if (joker.id === 'joker_pentacle' && state.flip5Done) {
    addLog(state, `⭐ Pentâculo: +15 pts`); return earned + 15;
  }
  if (joker.id === 'joker_catalyst' && state.flip5Done) {
    addLog(state, `⚗️ Catalisador: ×2`); return earned * 2;
  }
  if (joker.id === 'joker_accumulator' && state.flip5Done) {
    state.permanentChips += 5; addLog(state, `⚡ Acumulador: +5 chips perm!`);
  }
  // ── Flip3 ───────────────────────────────────────────────
  if (joker.id === 'joker_disciple' && state.flip3Done) {
    state.permanentMult = Math.round((state.permanentMult + 0.25) * 100) / 100;
    addLog(state, `🧘 Discípulo: Flip3 → +0.25 mult perm → ${state.permanentMult}`);
  }
  // ── Novos ───────────────────────────────────────────────
  if (joker.id === 'joker_luck' && reason === 'stop') {
    const bonus = rollAcaso();
    state.mult += bonus; addLog(state, `🎰 Acaso: parou → +${bonus} mult → ${liveScore(state)}`);
    return state.chips * state.mult;
  }
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
  const excess = Math.floor(Math.max(0, state.roundScore - state.goal) / 15);
  return Math.min(12, 4 + state.handsLeft + excess) + state.flip7sThisRound * 2 + state.flip5sThisRound;
}

// ============================================================
// SHOP
// ============================================================

const SHOP_CATALOG = [
  // ── JOKERS ──
  // ── JOKERS ──
  { id:'joker_greedy',     type:'joker', name:'Avarento',    desc:'+10 pts em toda mão não-bust',                       cost:6,  rarity:'common'   },
  { id:'joker_stoic',      type:'joker', name:'Estoico',     desc:'Parou com 1 carta numérica → +1 mult perm',          cost:5,  rarity:'common'   },
  { id:'joker_phoenix',    type:'joker', name:'Fênix',       desc:'Bust → ganha metade do score atual',                 cost:5,  rarity:'common'   },
  { id:'joker_banker',     type:'joker', name:'Banqueiro',   desc:'Toda mão não-bust → +$1',                            cost:6,  rarity:'uncommon' },
  { id:'joker_flip7fan',   type:'joker', name:'Fanático',    desc:'Flip7 → Score ×3',                                   cost:9,  rarity:'uncommon' },
  { id:'joker_daredevil',  type:'joker', name:'Temerário',   desc:'Bust → +0.1 mult perm (acumulativo)',                cost:9,  rarity:'rare'     },
  { id:'joker_pentacle',   type:'joker', name:'Pentâculo',   desc:'Flip5 → +15 pts',                                    cost:6,  rarity:'common'   },
  { id:'joker_catalyst',   type:'joker', name:'Catalisador', desc:'Flip5 → Score ×2',                                   cost:8,  rarity:'uncommon' },
  { id:'joker_accumulator',type:'joker', name:'Acumulador',  desc:'Flip5 → +5 chips perm',                              cost:9,  rarity:'rare'     },
  { id:'joker_disciple',   type:'joker', name:'Discípulo',   desc:'Flip3 → +0.25 mult perm',                            cost:7,  rarity:'uncommon' },
  { id:'joker_even',       type:'joker', name:'Par',         desc:'Carta par → +1 mult (no draw)',                      cost:5,  rarity:'common'   },
  { id:'joker_odd',        type:'joker', name:'Ímpar',       desc:'Carta ímpar → +1 mult (no draw)',                    cost:5,  rarity:'common'   },
  { id:'joker_humble',     type:'joker', name:'Humilde',     desc:'Carta 0 ou 1 → mult ×1.5 (no draw)',                 cost:7,  rarity:'uncommon' },
  { id:'joker_sequence',   type:'joker', name:'Sequência',   desc:'3 números consecutivos → +3 mult (no draw)',         cost:8,  rarity:'uncommon' },
  { id:'joker_protector',  type:'joker', name:'Protetor',    desc:'A cada 3ª carta: bust bloqueado',                    cost:10, rarity:'rare'     },
  { id:'joker_luck',       type:'joker', name:'Acaso',       desc:'Parar → +mult aleatório 1-15',                       cost:8,  rarity:'uncommon' },
  { id:'joker_twins',      type:'joker', name:'Gêmeos',      desc:'Second Chance ativa → +2 mult perm',                 cost:9,  rarity:'rare'     },
  { id:'joker_ascetic',    type:'joker', name:'Asceta',      desc:'Round sem comprar nada → +1 mult perm',              cost:8,  rarity:'rare'     },

  // ── EXTRAS ──
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

// ============================================================
// PACK SYSTEM — 3 tipos × 3 raridades = 9 packs
// ============================================================

const COMMON_EDITIONS = ['gold'];
const UNCOMMON_EDITIONS = ['gleam', 'relic'];
const RARE_EDITIONS = ['prism', 'ghost'];
const ALL_EDITIONS = ['gold', 'gleam', 'prism', 'ghost', 'relic'];
const COMMON_SEALS = ['blue'];
const ALL_SEALS = ['red', 'blue', 'gold'];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getOwnedValues(state) {
  const vals = new Set();
  for (const c of state.fullDeck) if (c.kind === 'number') vals.add(c.value);
  return vals;
}

function getNewValues(state) {
  const owned = getOwnedValues(state);
  const avail = [];
  for (let v = 0; v <= 12; v++) if (!owned.has(v)) avail.push(v);
  return avail;
}

function randomEffect(tier) {
  if (tier === 'common') {
    const ed = Math.random() < 0.35 ? pickRandom(COMMON_EDITIONS) : null;
    const sl = Math.random() < 0.2 ? pickRandom(COMMON_SEALS) : null;
    return { edition: ed, seal: sl };
  }
  if (tier === 'uncommon') {
    const ed = Math.random() < 0.6 ? pickRandom(ALL_EDITIONS) : null;
    const sl = Math.random() < 0.4 ? pickRandom(ALL_SEALS) : null;
    if (!ed && !sl) return { edition: pickRandom(ALL_EDITIONS), seal: null };
    return { edition: ed, seal: sl };
  }
  if (Math.random() < 0.6) {
    return { edition: pickRandom(RARE_EDITIONS), seal: Math.random() < 0.3 ? pickRandom(ALL_SEALS) : null };
  }
  return { edition: Math.random() < 0.3 ? pickRandom(ALL_EDITIONS) : null, seal: pickRandom(['gold']) };
}

function guaranteedRareEffect() {
  if (Math.random() < 0.6) {
    return { edition: pickRandom(RARE_EDITIONS), seal: Math.random() < 0.3 ? pickRandom(ALL_SEALS) : null };
  }
  return { edition: Math.random() < 0.3 ? pickRandom(ALL_EDITIONS) : null, seal: 'gold' };
}

function makePackCard(value, edition, seal) {
  return {
    kind: 'number', value, edition: edition || null, seal: seal || null,
    id: `${value}_gen_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
  };
}

function effectLabel(card) {
  const edL = { gold:'✦', gleam:'◈', prism:'◉', ghost:'◌', relic:'⟡' };
  const slL = { red:'●', blue:'◆', gold:'★' };
  let lbl = '';
  if (card.edition) lbl += edL[card.edition] || '';
  if (card.seal) lbl += slL[card.seal] || '';
  return lbl;
}

function generatePack(state, packType, rarity) {
  const pack = { type: 'pack', packType, rarity, name: '', desc: '', cost: 0, offerings: [], chooseCount: 0 };

  if (packType === 'unico') {
    let pool = getNewValues(state);
    if (pool.length === 0) pool = [randInt(8, 12)];
    // Fill pool to at least 5 unique values
    while (pool.length < 5) pool.push(randInt(8, 12));

    // Pick 5 distinct values (or repeat if not enough)
    const vals = shuffle([...pool]).slice(0, 5);
    while (vals.length < 5) vals.push(pickRandom(pool));

    if (rarity === 'common') {
      pack.name = 'Pack Único'; pack.cost = 3;
      pack.desc = '5 cartas novas · escolhe 1 · 1 com edição/selo comum';
      // 4 clean + 1 with common edition OR common seal (50/50, never both)
      const special = Math.random() < 0.5
        ? { edition: pickRandom(COMMON_EDITIONS), seal: null }
        : { edition: null, seal: pickRandom(COMMON_SEALS) };
      const cards = vals.map((v, i) => i === 4
        ? makePackCard(v, special.edition, special.seal)
        : makePackCard(v, null, null));
      const shuffled = shuffle(cards);
      pack.offerings = shuffled.map(c => ({ cards: [c], label: `${c.value} ${effectLabel(c)}`.trim() }));
      pack.chooseCount = 1;
    } else if (rarity === 'uncommon') {
      pack.name = 'Pack Único+'; pack.cost = 5;
      pack.desc = '5 cartas novas · escolhe 1 · 1 edição + 1 selo';
      // 3 clean + 1 with any edition (no seal) + 1 with any seal (no edition)
      const cards = vals.map((v, i) => {
        if (i === 3) return makePackCard(v, pickRandom(ALL_EDITIONS), null);
        if (i === 4) return makePackCard(v, null, pickRandom(ALL_SEALS));
        return makePackCard(v, null, null);
      });
      const shuffled = shuffle(cards);
      pack.offerings = shuffled.map(c => ({ cards: [c], label: `${c.value} ${effectLabel(c)}`.trim() }));
      pack.chooseCount = 1;
    } else {
      pack.name = 'Pack Único Jumbo'; pack.cost = 7;
      pack.desc = '5 cartas · escolhe 2 · 1 edição rara garantida';
      // 2 clean + 2 with edition OR seal + 1 guaranteed rare edition (Prism/Ghost)
      const cards = vals.map((v, i) => {
        if (i === 2) return makePackCard(v, Math.random() < 0.5 ? pickRandom(ALL_EDITIONS) : null, Math.random() < 0.5 ? pickRandom(ALL_SEALS) : null);
        if (i === 3) return makePackCard(v, Math.random() < 0.5 ? pickRandom(ALL_EDITIONS) : null, Math.random() < 0.5 ? pickRandom(ALL_SEALS) : null);
        if (i === 4) return makePackCard(v, pickRandom(RARE_EDITIONS), null);
        return makePackCard(v, null, null);
      });
      // Ensure slots 2-3 have at least one effect, never both
      for (let k = 2; k <= 3; k++) {
        const c = cards[k];
        if (c.edition && c.seal) { c.seal = null; } // never both
        if (!c.edition && !c.seal) { // ensure at least one
          if (Math.random() < 0.5) c.edition = pickRandom(ALL_EDITIONS);
          else c.seal = pickRandom(ALL_SEALS);
        }
      }
      const shuffled = shuffle(cards);
      pack.offerings = shuffled.map(c => ({ cards: [c], label: `${c.value} ${effectLabel(c)}`.trim() }));
      pack.chooseCount = 2;
    }
  }

  else if (packType === 'combo') {
    const ownedVals = [...getOwnedValues(state)];
    const pool = ownedVals.length ? ownedVals : [1, 2, 3, 4, 5, 6, 7];

    if (rarity === 'common') {
      pack.name = 'Pack Combo'; pack.cost = 3;
      pack.desc = '3 combos · escolhe 1 · edições comuns';
      const options = [];
      for (let i = 0; i < 3; i++) {
        const val = pickRandom(pool);
        const count = randInt(1, 3);
        const eff = randomEffect('common');
        const cards = [];
        for (let j = 0; j < count; j++) cards.push(makePackCard(val, eff.edition, eff.seal));
        options.push({ cards, label: `${count}×${val} ${effectLabel(cards[0])}`.trim() });
      }
      pack.offerings = options;
      pack.chooseCount = 1;
    } else if (rarity === 'uncommon') {
      pack.name = 'Pack Combo+'; pack.cost = 5;
      pack.desc = '3 combos · escolhe 1 · qualquer edição/selo';
      const options = [];
      for (let i = 0; i < 3; i++) {
        const val = pickRandom(pool);
        const count = randInt(1, 3);
        const eff = randomEffect('uncommon');
        const cards = [];
        for (let j = 0; j < count; j++) cards.push(makePackCard(val, eff.edition, eff.seal));
        options.push({ cards, label: `${count}×${val} ${effectLabel(cards[0])}`.trim() });
      }
      pack.offerings = options;
      pack.chooseCount = 1;
    } else {
      pack.name = 'Pack Combo Jumbo'; pack.cost = 8;
      pack.desc = 'Escolhe 1 combo de 5 · garantido raro';
      const options = [];
      for (let i = 0; i < 5; i++) {
        const val = pickRandom(pool);
        const count = randInt(2, 3);
        const eff = i === 0 ? guaranteedRareEffect() : randomEffect('rare');
        const cards = [];
        for (let j = 0; j < count; j++) cards.push(makePackCard(val, eff.edition, eff.seal));
        options.push({ cards, label: `${count}×${val} ${effectLabel(cards[0])}`.trim() });
      }
      pack.offerings = options;
      pack.chooseCount = 1;
    }
  }

  else if (packType === 'classico') {
    let newVals = getNewValues(state);

    if (rarity === 'common') {
      pack.name = 'Pack Classico'; pack.cost = 4;
      pack.desc = '3 opções N×N · escolhe 1 · sem efeitos';
      let pool = newVals.filter(v => v <= 7);
      if (pool.length < 3) pool = [...pool, ...newVals.filter(v => v > 7)];
      if (pool.length < 3) for (let v = 1; pool.length < 3; v++) if (!pool.includes(v)) pool.push(v);
      const vals = shuffle(pool).slice(0, 3);
      pack.offerings = vals.map(v => {
        const cards = []; for (let i = 0; i < Math.max(1, v); i++) cards.push(makePackCard(v, null, null));
        return { cards, label: `${Math.max(1, v)}×${v}` };
      });
      pack.chooseCount = 1;
    } else if (rarity === 'uncommon') {
      pack.name = 'Pack Classico+'; pack.cost = 6;
      pack.desc = '3 opções melhores N×N · escolhe 1 · sem efeitos';
      let pool = newVals.filter(v => v >= 5);
      if (pool.length < 3) pool = [...pool, ...newVals];
      if (pool.length < 3) for (let v = 5; pool.length < 3; v++) if (!pool.includes(v)) pool.push(v);
      const vals = shuffle(pool).slice(0, 3);
      pack.offerings = vals.map(v => {
        const cards = []; for (let i = 0; i < Math.max(1, v); i++) cards.push(makePackCard(v, null, null));
        return { cards, label: `${Math.max(1, v)}×${v}` };
      });
      pack.chooseCount = 1;
    } else {
      pack.name = 'Pack Classico Jumbo'; pack.cost = 9;
      pack.desc = '5 opções N×N · escolhe 2 · sem efeitos';
      let pool = newVals.length >= 5 ? newVals : [...newVals];
      for (let v = 1; pool.length < 5; v++) if (!pool.includes(v)) pool.push(v);
      const vals = shuffle(pool).slice(0, 5);
      pack.offerings = vals.map(v => {
        const cards = []; for (let i = 0; i < Math.max(1, v); i++) cards.push(makePackCard(v, null, null));
        return { cards, label: `${Math.max(1, v)}×${v}` };
      });
      pack.chooseCount = 2;
    }
  }

  return pack;
}

// ── Shop generation (conteúdo definido ao abrir) ──

function generateShop(state) {
  const owned = state.jokers.map(j => j.id);

  // Fileira 1: 2 packs (tipo × raridade aleatórios, conteúdo pré-gerado)
  const packTypes = ['unico', 'combo', 'classico'];
  const rarityWeights = ['common','common','common','uncommon','uncommon','rare'];
  const packRow = [];
  for (let i = 0; i < 2; i++) {
    packRow.push(generatePack(state, pickRandom(packTypes), pickRandom(rarityWeights)));
  }

  // Fileira 2: 2 jokers não comprados
  const jokerPool = SHOP_CATALOG.filter(i => i.type === 'joker' && !owned.includes(i.id));
  const jokerRow = pickN(jokerPool.flatMap(i => i.rarity==='common'?[i,i,i]:i.rarity==='uncommon'?[i,i]:[i]), 2);

  // Fileira 3: 2 upgrades/especiais
  const upgradePool = SHOP_CATALOG.filter(i => ['upgrade','special'].includes(i.type));
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

// ── Pack operations ──

function buyPack(state, pack) {
  if (state.money < pack.cost) return { result: 'no_money' };
  state.money -= pack.cost;
  state.boughtThisRound++;
  return { result: 'ok' };
}

function confirmPack(state, pack, selectedIndices) {
  const toAdd = [];
  if (pack.chooseCount === 0) {
    toAdd.push(...pack.offerings[0].cards);
  } else {
    for (const idx of selectedIndices) {
      if (pack.offerings[idx]) toAdd.push(...pack.offerings[idx].cards);
    }
  }
  for (const card of toAdd) {
    state.fullDeck.push({
      kind: card.kind, value: card.value, edition: card.edition, seal: card.seal,
      id: `${card.value}_pk_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
    });
  }
  addLog(state, `${pack.name}: +${toAdd.length} carta${toAdd.length > 1 ? 's' : ''} ao baralho`);
  return { result: 'ok', added: toAdd };
}

function refundPack(state, pack) {
  state.money += pack.cost;
  state.boughtThisRound = Math.max(0, state.boughtThisRound - 1);
  addLog(state, `Reembolso: ${pack.name} — +$${pack.cost}`);
  return { result: 'ok' };
}

// ── Regular item purchase ──

function buyItem(state, item, targetCardId) {
  if (state.money < item.cost) return { result: 'no_money' };
  state.money -= item.cost;
  state.boughtThisRound++;

  if (item.type === 'joker') {
    state.jokers.push({ id: item.id, name: item.name, desc: item.desc });
    addLog(state, `Comprou joker: ${item.name}`);
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

function checkAsceta(state) {
  if (state.jokers.some(j => j.id === 'joker_ascetic') && state.boughtThisRound === 0) {
    state.permanentMult = Math.round((state.permanentMult + 1) * 100) / 100;
    addLog(state, `🧘 Asceta: round sem comprar → +1 mult perm → ${state.permanentMult}`);
    return true;
  }
  return false;
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
