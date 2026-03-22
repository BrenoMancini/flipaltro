# Flip7 × Balatro

Um jogo de deckbuilding baseado no Flip7, com mecânicas inspiradas no Balatro.

## Como jogar

- **Cavar** — puxa a próxima carta do deck
- **Parar** — encerra a mão e pontua (chips × mult)
- **Descartar topo** — remove a próxima carta do deck sem cavá-la (3 por round)
- Repita de bust é 0 pontos
- 7 únicos = **Flip7** → score × 3
- Alcance a meta de pontos em 5 mãos para avançar

## Loop do jogo

```
Round → 5 mãos para atingir a meta
  → Loja (comprar jokers, edições, selos, cartas novas)
  → Próximo round (meta maior)
```

## Metas por round

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

## Deck inicial (32 cartas)

- 1×1, 2×2, 3×3, 4×4, 5×5, 6×6, 7×7
- 1× Freeze, 1× Flip2
- 1× +5 Chips, 1× +1 Mult

## Deploy

### GitHub Pages (recomendado)

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/SEU_USER/flip7-balatro.git
git push -u origin main
```

Depois em Settings → Pages → Source: `main` branch.

### Itch.io

1. Zipar a pasta inteira
2. Em itch.io → Upload → HTML game
3. Marcar "This file will be played in the browser"

## Estrutura

```
index.html   — HTML + layout das 3 telas (jogo, loja, fim)
game.js      — Toda a lógica: deck, mãos, scoring, loja
ui.js        — Renderização e handlers de botão
style.css    — Visual dark card-game
```
