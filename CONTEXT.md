# Flip7 × Balatro — Contexto do Projeto

Documento de design e decisões tomadas nas sessões de 22-23/03/2026.
Use este arquivo para continuar o desenvolvimento em outras sessões.

---

## Conceito

Balatrizar o Flip7: transformar o jogo de cartas Flip7 num roguelite de deckbuilding no estilo Balatro.

**Loop principal:**
```
Deck inicial → Round (M mãos para atingir P pontos) → Loja → próximo round
```

---

## Regras do Flip7 (base)

- Baralho com cartas numéricas onde **cada número N aparece N vezes** (ex: 3 cartas "3", 7 cartas "7")
- Você cava cartas uma a uma
- Se puxar um número já na mesa → **bust** (perde tudo da mão)
- Se completar 7 números únicos → **Flip7** (bônus enorme)
- Pode parar voluntariamente a qualquer momento

---

## Decisões de Design

### Deck inicial (33 cartas)
- 1×0 (carta zero — não dá bust fácil, não soma chips)
- 1×1, 2×2, 3×3, 4×4, 5×5, 6×6, 7×7 (28 cartas numéricas)
- 1× Freeze (para obrigatoriamente)
- 1× Flip2 (obriga a cavar +2; cancela Freeze se vier antes)
- 1× +5 Chips (carta de pontuação, não conta pro Flip7)
- 1× +1 Mult (carta de pontuação, não conta pro Flip7)

**Motivo do range 1-7:** mantém a identidade NxN, Flip7 é possível, números altos (8-12) são conquistas compradas na loja.

### Loop de round
- **5 mãos por round**
- **Freeze NÃO conta como mão** (não decrementa handsLeft)
- **3 descartes de topo por round** (remove carta do topo do deck sem ver, às cegas)
- **Deck persiste entre mãos** (não reembaralha entre mãos, só quando o deck esvazia)
- Cartas usadas (bust, stop, freeze, flip7) vão para pilha de descarte
- Quando deck esvazia → descarte é reembaralhado

### Scoring
```
score = chips × mult
```
- Cartas numéricas somam ao chips
- Flip5 (5 únicos) → +1 mult, mão continua
- Flip7 (7 únicos) → mult ×2
- Bust → 0 pontos nessa mão
- **permanentMult** — bônus de mult que persiste entre mãos (dado por Estoico, Acumulador)

### Metas por round
| Round | Meta |
|-------|------|
| 1 | 30 |
| 2 | 50 |
| 3 | 80 |
| 4 | 130 |
| 5 | 200 |
| 6 | 300 |
| 7 | 450 |
| 8 | 650 |

---

## Tipos de carta

### Cartas numéricas
- Valor N, aparece N vezes no deck (regra NxN)
- Comprar carta nova na loja adiciona N cópias (ex: carta 8 = 8 cópias)
- Podem ter **Edição** e **Selo**

### Cartas especiais (no baralho)
| Carta | Efeito |
|-------|--------|
| **Freeze** | Para a mão obrigatoriamente, pontua o que está na mesa. **Não gasta mão.** |
| **Flip2** | Obriga a cavar +2 cartas; cancela Freeze se vier enquanto ativo |
| **+Chips** | Adiciona chips ao score desta mão (não conta pro Flip7) |
| **+Mult** | Adiciona mult ao score desta mão (não conta pro Flip7) |
| **Second Chance** | Ao ser puxada, ativa proteção. Próximo bust da mão é cancelado (1× por mão) |

---

## Edições (modificam scoring)

| Edição | Efeito | Raridade |
|--------|--------|----------|
| **Dourada** | +chips fixos ao valor da carta | Comum |
| **Reluzente** | +2 mult ao aparecer | Incomum |
| **Prisma** | Pontua imediatamente o score atual da mesa como bônus | Rara |
| **Fantasma** | Nunca dá bust, pontua normalmente | Rara |
| **Relíquia** | Ao aparecer, cava +1 extra | Incomum |

---

## Selos (modificam economia e triggers)

| Selo | Trigger | Efeito | Raridade |
|------|---------|--------|----------|
| **Vermelho** | Cada carta puxada | +1 mult | Incomum |
| **Azul** | Ao terminar a mão | +$1 por carta puxada | Comum |
| **Dourado** | Ao completar Flip7 | Carta pontua xMult em vez de +chips | Rara |

---

## Jokers (passivos permanentes, comprados na loja)

| ID | Nome | Trigger | Efeito | Custo | Raridade |
|----|------|---------|--------|-------|----------|
| joker_greedy | Avarento | Mão não-bust | +10 pts | $6 | Common |
| joker_flip7fan | Fanático | Flip7 | Score ×2 | $8 | Uncommon |
| joker_stoic | Estoico | Parar com exatamente 1 carta numérica | +1 mult permanente | $5 | Common |
| joker_phoenix | Fênix | Bust | +5 pts | $5 | Common |
| joker_banker | Banqueiro | Toda mão jogada (não-bust) | +$1 | $6 | Uncommon |
| joker_pentacle | Pentâculo | Flip5 | +15 pts | $6 | Common |
| joker_catalyst | Catalisador | Flip5 | Score ×2 nessa mão | $8 | Uncommon |
| joker_accumulator | Acumulador | Flip5 | +1 mult permanente no run | $9 | Rare |
| joker_daredevil | Temerário | Bust | +3 mult próxima mão | $9 | Rare |

---

## Loja

- Aparece entre rounds
- **3 fileiras de ofertas** (2 itens cada, aleatórias por raridade):
  - Fileira 1: Cartas & especiais (só números que o player ainda não tem)
  - Fileira 2: Jokers (não repetidos)
  - Fileira 3: Upgrades (edições, selos, +chips, +mult)
- **Botão fixo "Remover carta — $2"** (sempre disponível, não depende de sorte)
- Dinheiro inicial: $4
- Ganho por round: $3 + $1 a cada 20 pts acima da meta + mãos restantes como bônus

---

## Builds emergentes

| Build | Foco | Investe em |
|-------|------|-----------|
| **Dourada** (Flip7) | Flip7 consistente | Deck enxuto, remover cópias, Selos Dourados |
| **Vermelha** (Mult) | Mult agressivo | Cavar muito, Selos Vermelhos, Edição Reluzente |
| **Azul** (Farm $) | Economia | Selos Azuis, muitas mãos, comprar mais na loja |
| **Estoica** (permanentMult) | Parar com 1 carta | Estoico + cartas altas, mult escala a cada mão |
| **Flip5** (Pentâculo/Catalisador) | Atingir 5 únicos | Números variados, Acumulador |

---

## Stack técnica

HTML/CSS/JS puro — sem frameworks, sem build step.

```
index.html   — layout das telas (menu, tutorial, jogo, loja, fim)
game.js      — lógica: deck, mãos, scoring, loja, jokers
ui.js        — renderização e event handlers
style.css    — visual dark card-game (Syne + DM Mono)
CONTEXT.md   — este arquivo
```

**Deploy:** GitHub Pages → https://brenomancini.github.io/flipaltro/

---

## Git Flow

- `main` — branch de produção (GitHub Pages deploy)
- `develop` — branch de desenvolvimento
- `feature/*` — branches de feature (merge em develop)

---

## O que falta / próximos passos

- [ ] Mais jokers (mínimo 15-20 para variedade de builds)
- [ ] Mais cartas especiais (ex: Double — dobra o próximo número; Skip — pula para próxima mão com pontos)
- [ ] Temerário (joker_daredevil) — implementar lógica de +3 mult na próxima mão após bust
- [ ] Analytics (Google Analytics ou Supabase para coletar dados de runs)
- [ ] SFX e feedback visual mais rico (animação de Flip7, bust, etc.)
- [ ] Balanceamento das metas com dados reais de jogadores
- [ ] Decks iniciais alternativos (como no Balatro) para rejogabilidade
- [ ] Mobile polish
