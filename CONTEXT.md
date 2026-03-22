# Flip7 × Balatro — Contexto do Projeto

Documento de design e decisões tomadas na sessão de 22/03/2026.
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

### Deck inicial (32 cartas)
- 1×1, 2×2, 3×3, 4×4, 5×5, 6×6, 7×7 (28 cartas numéricas)
- 1× Freeze (para obrigatoriamente)
- 1× Flip2 (obriga a cavar +2; cancela Freeze se vier antes)
- 1× +5 Chips (carta de pontuação, não conta pro Flip7)
- 1× +1 Mult (carta de pontuação, não conta pro Flip7)

**Motivo do range 1-7:** mantém a identidade NxN, Flip7 é possível, números altos (8-12) são conquistas compradas na loja.

### Loop de round
- **5 mãos por round**
- **3 descartes de topo por round** (remove carta do topo do deck sem ver, às cegas — ver a carta tiraria a decisão)
- **Deck persiste entre mãos** (não reembaralha entre mãos, só quando o deck esvazia)
- Cartas usadas (bust, stop, freeze, flip7) vão para pilha de descarte
- Quando deck esvazia → descarte é reembaralhado

### Scoring
```
score = chips × mult
```
- Cartas numéricas somam ao chips
- Flip7 → score × 3
- Bust → 0 pontos nessa mão

### Metas por round
| Round | Meta |
|-------|------|
| 1 | 50 |
| 2 | 120 |
| 3 | 220 |
| 4 | 360 |
| 5 | 550 |
| 6 | 800 |
| 7 | 1100 |
| 8 | 1500 |

**Meta 50 no round 1:** calibrada para que um jogador que sabe parar (~score ≥ 10-12 por mão) tenha ~47% de chance. Exige aprender quando parar.

### Filosofia de parada
O jogo é sobre **saber quando parar e quando cavar**. Cavar sempre = quase sempre bust. O skill é ler o deck e tomar a decisão certa.

---

## Tipos de carta

### Cartas numéricas
- Valor N, aparece N vezes no deck
- Podem ter **Edição** e **Selo**

### Cartas especiais (no baralho)
| Carta | Efeito |
|-------|--------|
| **Freeze** | Para a mão obrigatoriamente, pontua o que está na mesa |
| **Flip2** | Obriga a cavar +2 cartas; cancela Freeze se vier enquanto ativo |
| **+Chips** | Adiciona chips ao score desta mão (não conta pro Flip7) |
| **+Mult** | Adiciona mult ao score desta mão (não conta pro Flip7) |

---

## Edições (modificam scoring)

| Edição | Efeito | Raridade |
|--------|--------|----------|
| **Dourada** | +chips fixos ao valor da carta | Comum |
| **Reluzente** | +2 mult ao aparecer | Incomum |
| **Prisma** | Pontua imediatamente o score atual da mesa como bônus | Rara |
| **Fantasma** | Nunca dá bust, pontua normalmente | Rara |
| **Relíquia** | Ao aparecer, cava +1 extra | Incomum |

**Regras:** cada carta tem no máximo 1 edição. Edições são compradas na loja e aplicadas a uma carta específica do baralho.

---

## Selos (modificam economia e triggers)

| Selo | Trigger | Efeito | Raridade |
|------|---------|--------|----------|
| **Vermelho** | Cada carta puxada | +1 mult | Incomum |
| **Azul** | Ao terminar a mão | +$1 por carta puxada | Comum |
| **Dourado** | Ao completar Flip7 | Carta pontua xMult em vez de +chips | Rara |

**Separação intencional:** Edições = pontuação. Selos = economia e triggers situacionais.

---

## Builds emergentes

| Build | Foco | Investe em |
|-------|------|-----------|
| **Dourada** (Flip7) | Flip7 consistente | Deck enxuto, remover cópias, Selos Dourados |
| **Vermelha** (Mult) | Mult agressivo | Cavar muito, Selos Vermelhos, Edição Reluzente |
| **Azul** (Farm $) | Economia | Selos Azuis, muitas mãos, comprar mais na loja |

---

## Jokers (passivos permanentes, comprados na loja)

| Joker | Efeito | Custo |
|-------|--------|-------|
| Avarento | +10 pts em toda mão não-bust | $6 |
| Fanático | Flip7 vale ×2 | $8 |
| Estoico | +15 pts ao parar voluntariamente | $7 |
| Fênix | Bust gera +5 pts | $5 |
| Banqueiro | +$1 por Flip7 no round | $6 |
| Temerário | Cada bust +3 mult próxima mão | $9 |

---

## Loja

- Aparece entre rounds
- Mostra 4 itens aleatórios (ponderado por raridade)
- Dinheiro inicial: $4
- Ganho por round: $3 + $1 a cada 20 pts acima da meta
- Itens: Jokers, Cartas novas (8-10), Blocos (+cópias), Edições, Selos, Remover carta, Upgrades (+chips/+mult)

---

## Stack técnica

HTML/CSS/JS puro — sem frameworks, sem build step.

```
index.html   — layout das 3 telas (jogo, loja, fim)
game.js      — lógica: deck, mãos, scoring, loja, jokers
ui.js        — renderização e event handlers
style.css    — visual dark card-game (Syne + DM Mono)
```

**Deploy:** GitHub Pages (grátis) ou itch.io (zip do projeto).

---

## O que falta / próximos passos

- [ ] Mais jokers (mínimo 15-20 para variedade de builds)
- [ ] Mais cartas especiais (ex: Double — dobra o próximo número; Skip — pula para próxima mão com pontos)
- [ ] Analytics (Google Analytics ou Supabase para coletar dados de runs)
- [ ] Tela de tutorial / onboarding
- [ ] SFX e feedback visual mais rico (animação de Flip7, bust, etc.)
- [ ] Balanceamento das metas com dados reais de jogadores
- [ ] Decks iniciais alternativos (como no Balatro) para rejogabilidade
- [ ] Cartas 11 e 12 na loja (mais arriscadas, mais recompensadoras)
- [ ] Evento especial no Flip7 (além do ×3)
- [ ] Mobile polish

---

## Matemática validada (simulações com 500k runs)

- **Deck inicial puro, nunca para:** média 7.9 pts / 5 mãos
- **Jogador que para em score ≥ 10:** média 46 pts / 5 mãos, ~47% de atingir 50
- **Ponto ótimo de parada:** score 10-12 por mão
- **Flip7 com deck inicial:** ~0.3% por mão (raro mas possível)
- **Com 1 Freeze + 1 Flip2:** ~12-30% de Flip7 dependendo de quantos Freezes
