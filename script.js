/* Tigerès Logs — storefront interactions */

/* ---------- category filter ---------- */
const pills = document.querySelectorAll('.pill');
const logs = document.querySelectorAll('.log');
const emptyNote = document.getElementById('empty-note');

pills.forEach((pill) => {
  pill.addEventListener('click', () => {
    pills.forEach((p) => {
      p.classList.toggle('is-active', p === pill);
      p.setAttribute('aria-pressed', p === pill ? 'true' : 'false');
    });
    const cat = pill.dataset.filter;
    let visible = 0;
    logs.forEach((tile) => {
      const show = cat === 'all' || tile.dataset.cat === cat;
      tile.classList.toggle('hide', !show);
      if (show) visible++;
    });
    emptyNote.hidden = visible !== 0;
  });
});

/* ---------- scroll reveal ---------- */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

/* ---------- header balance (reads what the deposit page persists) ---------- */
(function syncBalanceChip() {
  const chip = document.getElementById('balance-amount');
  if (!chip) return;
  const key = localStorage.getItem('tigeres_key');
  if (!key) return;
  fetch('/api/deposits/' + encodeURIComponent(key))
    .then((r) => (r.ok ? r.json() : null))
    .then((items) => {
      if (!Array.isArray(items)) return;
      const balance = items
        .filter((d) => d.status === 'fulfilled')
        .reduce((sum, d) => sum + Number(d.usd_amount), 0);
      chip.textContent = '$' + balance.toFixed(2).replace(/\.00$/, '');
    })
    .catch(() => {});
})();

/* ---------- footer year ---------- */
document.getElementById('year').textContent = new Date().getFullYear();
