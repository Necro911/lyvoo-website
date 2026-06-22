# Backup do hero — antes do score longitudinal

Data: 2026-06-22
Tag git (restauro completo, byte a byte): **`hero-pre-score-trend`** → commit `16e59fb`

## Como reverter

Restaurar **apenas o hero** (index.html + en/index.html) ao estado guardado:

```bash
cd "E:/Claude/lyvoo"
git checkout hero-pre-score-trend -- index.html en/index.html
git commit -m "revert: restaura hero original (score estático)"
git push
```

Ver o hero guardado sem mexer no atual:

```bash
git show hero-pre-score-trend:index.html
```

## Estado original do centro do score (referência)

### PT (`index.html`)
```html
<div class="hc-center-content">
  <div class="hc-sd-label">Score de saúde</div>
  <div class="hc-sd-num">87</div>
  <div class="hc-sd-max">/ 100</div>
  <div class="hc-sd-badge">+12 pts este mês</div>
</div>
```

### EN (`en/index.html`)
```html
<div class="hc-center-content">
  <div class="hc-sd-label">Health score</div>
  <div class="hc-sd-num">87</div>
  <div class="hc-sd-max">/ 100</div>
  <div class="hc-sd-badge">+12 pts this month</div>
</div>
```
