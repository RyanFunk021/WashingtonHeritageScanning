// Review overlay for index.html: click anything on the page, comment on it or
// rewrite its text, then "Copy JSON" and paste the result into Claude.
// Loads only when the address has ?feedback (see the end of index.html).
// Notes are kept in the reviewer's own browser; nothing is sent anywhere.
(() => {
  if (window.__feedbackLoaded) return;
  window.__feedbackLoaded = true;

  const PAGE = location.pathname.split('/').pop() || 'index.html';
  const KEY = 'page-feedback:' + PAGE;
  const TEXT_FIELD_MAX = 600; // longer than this, it's a section: comment only

  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { notes = []; }
  let picking = true;
  let cur = null; // { el, note } while the note editor is open
  let clearTimer = null;

  // ---------- UI, isolated from the page's styles in a shadow root ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  * { box-sizing: border-box; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  [hidden] { display: none !important; }
  .hl { position: fixed; border: 2px solid #2563eb; background: rgba(37,99,235,.07); border-radius: 3px; pointer-events: none; display: none; }
  .hl span { position: absolute; top: -21px; left: -2px; background: #2563eb; color: #fff; font-size: 11px; padding: 1px 6px; border-radius: 3px; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
  .pin { position: fixed; pointer-events: auto; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: #dc2626; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.35); transform: translate(-35%, -35%); }
  .pop, .panel { position: fixed; pointer-events: auto; background: #fff; color: #18181b; border: 1px solid #d4d4d8; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.22); padding: 12px; }
  .pop { width: 360px; max-width: calc(100vw - 16px); }
  .panel { right: 16px; bottom: 64px; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 96px); overflow: auto; }
  .head { display: flex; align-items: center; gap: 8px; }
  .head b { flex: 1; font-weight: 700; }
  label { display: block; font-size: 11px; font-weight: 600; color: #52525b; margin: 10px 0 3px; text-transform: uppercase; letter-spacing: .04em; }
  textarea { width: 100%; border: 1px solid #d4d4d8; border-radius: 6px; padding: 6px 8px; resize: vertical; color: #18181b; background: #fff; }
  textarea:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }
  .muted { color: #71717a; font-size: 12px; }
  .row { display: flex; gap: 6px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  .grow { flex: 1; }
  button { border: 1px solid #d4d4d8; background: #fff; color: #18181b; border-radius: 6px; padding: 5px 10px; cursor: pointer; }
  button:hover { background: #f4f4f5; }
  button.primary { background: #18181b; color: #fff; border-color: #18181b; }
  button.danger { color: #b91c1c; }
  .bar { position: fixed; right: 16px; bottom: 16px; pointer-events: auto; display: flex; gap: 6px; background: #18181b; padding: 6px; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
  .bar button { background: #27272a; color: #fff; border-color: #3f3f46; }
  .bar button:hover { background: #3f3f46; }
  .bar button.on { background: #2563eb; border-color: #2563eb; }
  .bar button.primary { background: #fff; color: #18181b; border-color: #fff; }
  .bar button.danger { color: #fca5a5; }
  .item { padding: 7px 8px; border-radius: 6px; cursor: pointer; border-bottom: 1px solid #f4f4f5; }
  .item:hover { background: #f4f4f5; }
  .item .txt { margin-top: 2px; white-space: pre-wrap; }
  .bar button { white-space: nowrap; }
  @media (max-width: 480px) {
    .bar { right: 8px; bottom: 8px; gap: 4px; }
    .bar button { padding: 5px 8px; }
    .long { display: none; }
  }
  .toast { position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%); background: #18181b; color: #fff; padding: 7px 14px; border-radius: 6px; pointer-events: none; }
</style>
<div class="hl"><span></span></div>
<div class="pins"></div>
<div class="pop" hidden>
  <div class="head"><b class="title"></b><button class="up" title="Select the element around this one">&uarr; Bigger</button></div>
  <div class="muted where"></div>
  <div class="textwrap">
    <label>Change text to</label>
    <textarea class="newtext" rows="3"></textarea>
  </div>
  <label>Comment</label>
  <textarea class="comment" rows="3" placeholder="What should change here?"></textarea>
  <div class="row">
    <button class="del danger">Delete</button>
    <span class="grow"></span>
    <button class="cancel">Cancel</button>
    <button class="save primary">Save</button>
  </div>
  <div class="muted" style="margin-top:6px">&#8984;&#8629; saves &middot; Esc cancels &middot; clicking another spot saves this one</div>
</div>
<div class="panel" hidden>
  <div class="head"><b>Notes</b><button class="close">Close</button></div>
  <div class="items"></div>
  <label>JSON to paste into Claude</label>
  <textarea class="json" rows="8" readonly></textarea>
  <div class="row">
    <button class="clear danger">Clear all</button>
    <span class="grow"></span>
    <button class="copy2 primary">Copy JSON</button>
  </div>
</div>
<div class="bar">
  <button class="toggle on" title="When on, clicks pick an element instead of following links"><span class="long">Commenting </span><span class="state">on</span></button>
  <button class="general">+ <span class="long">Page </span>note</button>
  <button class="list">Notes (<span class="count">0</span>)</button>
  <button class="copy primary">Copy JSON</button>
  <button class="clear danger bar-clear" title="Delete all notes, e.g. after pasting them into Claude" hidden>Clear</button>
</div>
<div class="toast" hidden></div>`;

  const $ = (s) => root.querySelector(s);
  const hl = $('.hl'), hlLabel = $('.hl span'), pins = $('.pins'), pop = $('.pop'), panel = $('.panel');
  const newtext = $('.newtext'), comment = $('.comment'), toastEl = $('.toast');

  // ---------- helpers ----------
  const squash = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const isField = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  const textOf = (el) => (!el ? '' : isField(el) ? el.placeholder || el.value || '' : squash(el.innerText));
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
  const inUI = (e) => e.composedPath().includes(host);

  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); return parts.join(' > '); }
      let i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return ['body'].concat(parts).join(' > ');
  }

  function whereOf(el) {
    const s = el.closest('section, header, footer, nav');
    if (!s) return 'page';
    const name = s.id ? '#' + s.id : s.tagName.toLowerCase();
    const h = s.querySelector('h1, h2');
    return h ? name + ' ("' + clip(squash(h.innerText), 40) + '")' : name;
  }

  function find(note) {
    if (!note || !note.selector) return null;
    try { return document.querySelector(note.selector); } catch (e) { return null; }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); }
    catch (e) { toast("This browser won't keep the notes. Copy the JSON before closing."); }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  function showHl(el) {
    if (!el || el === document.body || el === document.documentElement) { hl.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, {
      display: 'block', left: r.left - 2 + 'px', top: r.top - 2 + 'px',
      width: r.width + 4 + 'px', height: r.height + 4 + 'px',
    });
    const t = textOf(el);
    hlLabel.textContent = describe(el) + (t ? ' · ' + clip(t, 40) : '');
  }

  // ---------- note editor ----------
  function openFor(el, note) {
    cur = { el, note };
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    fill(false);
    pop.hidden = false;
    reposition();
    comment.focus();
  }

  function fill(keepComment) {
    const { el, note } = cur;
    const t = textOf(el);
    $('.title').textContent = (note ? '#' + note.n : 'New note') + ' · ' + (el ? describe(el) : 'whole page');
    let where = el ? whereOf(el) : note && note.selector ? note.where + ' (not found on the page now)' : 'Applies to the whole page';
    const editable = !!el && !!t && t.length <= TEXT_FIELD_MAX;
    if (el && t && !editable) where += ' · "' + clip(t, 80) + '"';
    $('.where').textContent = where;
    $('.textwrap').hidden = !editable;
    newtext.value = editable ? (note && note.newText != null && !keepComment ? note.newText : t) : '';
    if (!keepComment) comment.value = note ? note.comment || '' : '';
    $('.del').hidden = !note;
    $('.up').hidden = !el || !el.parentElement || el.parentElement === document.body;
  }

  function close() {
    cur = null;
    pop.hidden = true;
    hl.style.display = 'none';
  }

  function save() {
    if (!cur) return;
    const { el, note } = cur;
    const text = comment.value.trim();
    const before = textOf(el);
    const editable = !$('.textwrap').hidden;
    const after = editable ? newtext.value.trim() : '';
    const changed = editable && squash(after) !== squash(before);
    if (!text && !changed && !(note && !el && note.newText != null)) {
      if (note) { notes = notes.filter((n) => n !== note); toast('Note #' + note.n + ' removed'); }
      persist(); close(); render();
      return;
    }
    const data = el
      ? { where: whereOf(el), selector: cssPath(el), currentText: before ? clip(before, 500) : null,
          newText: changed ? after : null }
      : note
        ? { where: note.where, selector: note.selector, currentText: note.currentText, newText: note.newText }
        : { where: 'whole page', selector: null, currentText: null, newText: null };
    data.comment = text || null;
    data.viewportWidth = innerWidth;
    if (note) Object.assign(note, data);
    else notes.push(Object.assign({ n: notes.reduce((m, x) => Math.max(m, x.n), 0) + 1 }, data));
    const n = note ? note.n : notes[notes.length - 1].n;
    persist(); close(); render();
    toast('Saved #' + n);
  }

  function remove() {
    if (!cur || !cur.note) return;
    const n = cur.note.n;
    notes = notes.filter((x) => x !== cur.note);
    persist(); close(); render();
    toast('Deleted #' + n);
  }

  // ---------- pins, list, JSON ----------
  function exportJSON() {
    return JSON.stringify({
      page: PAGE,
      exported: new Date().toISOString(),
      notes: notes.map((n) => Object.fromEntries(Object.entries(n).filter(([, v]) => v !== null && v !== undefined))),
    }, null, 2);
  }

  function render() {
    $('.count').textContent = notes.length;
    $('.bar-clear').hidden = !notes.length;
    pins.textContent = '';
    for (const note of notes) {
      const el = find(note);
      if (!el) continue;
      const p = document.createElement('div');
      p.className = 'pin';
      p.textContent = note.n;
      p.title = clip(note.comment || ('Text → ' + (note.newText || '')), 120);
      p._el = el;
      p.addEventListener('click', (e) => { e.stopPropagation(); if (cur) save(); openFor(el, note); });
      pins.appendChild(p);
    }
    const items = $('.items');
    items.textContent = '';
    if (!notes.length) items.innerHTML = '<div class="muted" style="padding:6px 0">No notes yet. Click anything on the page.</div>';
    for (const note of notes) {
      const d = document.createElement('div');
      d.className = 'item';
      const head = document.createElement('div');
      head.innerHTML = '<b></b> <span class="muted"></span>';
      head.querySelector('b').textContent = '#' + note.n;
      head.querySelector('.muted').textContent = note.where + (note.selector && !find(note) ? ' · not found on the page now' : '');
      const body = document.createElement('div');
      body.className = 'txt';
      body.textContent = [
        note.newText != null ? 'Text → "' + clip(note.newText, 90) + '"' : '',
        note.comment ? clip(note.comment, 160) : '',
      ].filter(Boolean).join('\n');
      d.append(head, body);
      d.addEventListener('click', () => { panel.hidden = true; openFor(find(note), note); });
      items.appendChild(d);
    }
    $('.json').value = exportJSON();
    placePins();
  }

  function placePins() {
    const stack = new Map();
    for (const p of pins.children) {
      const r = p._el.getBoundingClientRect();
      const visible = r.width + r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      p.hidden = !visible;
      if (!visible) continue;
      const left = Math.max(14, r.left), top = Math.max(14, r.top);
      const k = Math.round(left) + ',' + Math.round(top);
      const i = stack.get(k) || 0;
      stack.set(k, i + 1);
      p.style.left = left + i * 26 + 'px';
      p.style.top = top + 'px';
    }
  }

  function placePop() {
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const r = cur.el ? cur.el.getBoundingClientRect() : null;
    let left, top;
    if (!r) { left = (innerWidth - pw) / 2; top = 80; }
    else {
      left = Math.min(Math.max(8, r.left), innerWidth - pw - 8);
      top = r.bottom + 10;
      if (top + ph > innerHeight - 8) top = r.top - ph - 10;
      if (top < 8) top = Math.max(8, innerHeight - ph - 70);
    }
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  let raf = 0;
  function reposition() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      placePins();
      if (cur) { showHl(cur.el); placePop(); }
    });
  }

  async function copy() {
    const s = exportJSON();
    try {
      await navigator.clipboard.writeText(s);
      toast('Copied ' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + '. Paste into Claude, then Clear.');
    } catch (e) {
      panel.hidden = false;
      const box = $('.json');
      box.value = s;
      box.focus();
      box.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      toast(ok ? 'Copied. Paste into Claude.' : 'Press ⌘C to copy the selected JSON.');
    }
  }

  // ---------- events ----------
  document.addEventListener('mousemove', (e) => {
    if (!picking || cur) return;
    if (inUI(e)) { hl.style.display = 'none'; return; }
    showHl(e.target);
  }, true);
  document.addEventListener('mouseleave', () => { if (!cur) hl.style.display = 'none'; });

  document.addEventListener('click', (e) => {
    if (inUI(e) || !picking) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.target === document.body || e.target === document.documentElement) return;
    if (cur) save();
    openFor(e.target, null);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cur) { close(); e.preventDefault(); }
      else if (!panel.hidden) { panel.hidden = true; e.preventDefault(); }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && cur) {
      e.preventDefault();
      save();
    }
  }, true);

  addEventListener('scroll', reposition, { passive: true, capture: true });
  addEventListener('resize', reposition);

  $('.save').addEventListener('click', save);
  $('.cancel').addEventListener('click', close);
  $('.del').addEventListener('click', remove);
  $('.up').addEventListener('click', () => {
    if (!cur || !cur.el || !cur.el.parentElement) return;
    cur.el = cur.el.parentElement;
    fill(true);
    reposition();
  });
  $('.toggle').addEventListener('click', (e) => {
    picking = !picking;
    e.currentTarget.classList.toggle('on', picking);
    $('.toggle .state').textContent = picking ? 'on' : 'off';
    if (!picking) hl.style.display = cur ? hl.style.display : 'none';
  });
  $('.general').addEventListener('click', () => { if (cur) save(); openFor(null, null); });
  $('.list').addEventListener('click', () => { render(); panel.hidden = !panel.hidden; });
  $('.close').addEventListener('click', () => { panel.hidden = true; });
  $('.copy').addEventListener('click', copy);
  $('.copy2').addEventListener('click', copy);
  // Two of these: "Clear" on the bar (next to Copy JSON, so clearing after a
  // paste is one obvious step) and "Clear all" in the Notes panel.
  const clearButtons = root.querySelectorAll('.clear');
  const resetClear = () => clearButtons.forEach((b) => { b.textContent = b.dataset.label; });
  clearButtons.forEach((b) => {
    b.dataset.label = b.textContent;
    b.addEventListener('click', () => {
      if (!clearTimer) {
        b.textContent = 'Click again to delete all ' + notes.length;
        clearTimer = setTimeout(() => { clearTimer = null; resetClear(); }, 4000);
        return;
      }
      clearTimeout(clearTimer);
      clearTimer = null;
      resetClear();
      notes = [];
      persist(); close(); render();
      toast('All notes cleared');
    });
  });

  render();
})();
