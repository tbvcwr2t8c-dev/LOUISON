export const clone = value => JSON.parse(JSON.stringify(value));
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dayKey = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const dateLabel = value => new Intl.DateTimeFormat('fr-FR', {day:'numeric',month:'short'}).format(new Date(value));
export const uid = () => crypto.randomUUID();
export function readingDays(sessions, days=7, now=new Date()) {
  const cutoff=new Date(now);cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-days+1);
  return new Set(sessions.filter(s=>new Date(s.date)>=cutoff && new Date(s.date)<=now).map(s=>dayKey(s.date))).size;
}
export function historyList(sessions, describe) {
  return sessions.length ? [...sessions].reverse().slice(0,30).map(s=>`<div class="ex"><div><b>${esc(dateLabel(s.date))}</b><div class="muted">${esc(describe(s))}</div></div></div>`).join('') : '<p class="muted">Ton histoire commence avec la première séance.</p>';
}
export function bind(root, selector, handler) { root.querySelectorAll(selector).forEach(el=>el.addEventListener('click',()=>handler(el))); }
