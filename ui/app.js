const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

/* ═══════════════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════════════ */

let todos = [];
let lists = [];
let activeListId = '';
let filter = 'all';
let expanded = null;
let searchQuery = '';
let undoTimer = null;
let undoData = null;
let kbIndex = -1;
let kbMode = false;
let theme = 'dark';

/* ═══════════════════════════════════════════════════════════════════════════
   DOM
   ═══════════════════════════════════════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const form       = $('#form'),
      input      = $('#input'),
      searchEl   = $('#search'),
      searchClr  = $('#search-clear'),
      listEl     = $('#list'),
      nil        = $('#nil'),
      nilIcon    = $('#nil-icon'),
      nilTitle   = $('#nil-title'),
      nilSub     = $('#nil-sub'),
      foot       = $('#foot'),
      pill       = $('#pill'),
      ctTotal    = $('#ct-total'),
      ctOpen     = $('#ct-open'),
      ctDone     = $('#ct-done'),
      clearBtn   = $('#clear-done'),
      toast      = $('#toast'),
      toastUndo  = $('#toast-undo'),
      barCount   = $('#bar-count'),
      kbHint     = $('#kb-hint'),
      listCurrent = $('#list-current'),
      listName   = $('#list-name'),
      listItems  = $('#list-dropdown-items'),
      listAdd    = $('#list-add'),
      switcher   = $('.list-switcher'),
      themeBtn   = $('#btn-theme');

/* ═══════════════════════════════════════════════════════════════════════════
   Window Controls
   ═══════════════════════════════════════════════════════════════════════════ */

$('#btn-min').onclick = () => getCurrentWindow().minimize();
$('#btn-max').onclick = async () => {
  const w = getCurrentWindow();
  (await w.isMaximized()) ? w.unmaximize() : w.maximize();
};
$('#btn-close').onclick = () => getCurrentWindow().hide();

/* ═══════════════════════════════════════════════════════════════════════════
   Theme
   ═══════════════════════════════════════════════════════════════════════════ */

function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
}

themeBtn.onclick = async () => {
  const next = theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { await invoke('set_theme', { theme: next }); } catch (e) { console.error(e); }
};

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const esc = t => { const e = document.createElement('span'); e.textContent = t; return e.innerHTML; };

function pop(el) {
  el.classList.remove('pop'); void el.offsetWidth;
  el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 300);
}

function visible() {
  let items = todos;
  if (filter === 'active')    items = items.filter(t => !t.completed);
  if (filter === 'completed') items = items.filter(t =>  t.completed);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }
  return items;
}

function formatDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((d - today) / 86400000);
  let label, cls = '';
  if (diff < 0)        { label = diff === -1 ? 'Yesterday' : `${Math.abs(diff)}d overdue`; cls = 'overdue'; }
  else if (diff === 0) { label = 'Today'; cls = 'today'; }
  else if (diff === 1) { label = 'Tomorrow'; }
  else if (diff <= 7)  { label = d.toLocaleDateString('en', { weekday: 'short' }); }
  else                  { label = d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); }
  return { label, cls };
}

function updateTitle() {
  const openN = todos.filter(t => !t.completed).length;
  const label = openN === 0 ? 'All done' : `${openN} open`;
  barCount.textContent = `· ${label}`;
  getCurrentWindow().setTitle(`Todo — ${label}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Empty State Icons (context-aware SVGs)
   ═══════════════════════════════════════════════════════════════════════════ */

const emptyIcons = {
  all: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <rect x="14" y="12" width="36" height="40" rx="6" stroke="currentColor" stroke-width="1.5"/>
    <line x1="22" y1="24" x2="42" y2="24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22" y1="32" x2="36" y2="32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="22" y1="40" x2="30" y2="40" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  active: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="1.5"/>
    <path d="M22 32L29 39L42 25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  completed: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
    <line x1="26" y1="32" x2="38" y2="32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  search: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <circle cx="28" cy="28" r="14" stroke="currentColor" stroke-width="1.5"/>
    <line x1="38" y1="38" x2="50" y2="50" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="22" y1="28" x2="34" y2="28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
};

/* ═══════════════════════════════════════════════════════════════════════════
   List Switcher
   ═══════════════════════════════════════════════════════════════════════════ */

function renderLists() {
  const current = lists.find(l => l.id === activeListId);
  listName.textContent = current ? current.name : 'Personal';

  listItems.innerHTML = lists.map(l => `
    <div class="list-dropdown-item${l.id === activeListId ? ' active' : ''}" data-lid="${l.id}">
      <span class="list-dropdown-item-name">${esc(l.name)}</span>
      <span class="list-dropdown-item-count">${l.count}</span>
      ${lists.length > 1 ? `<button class="list-dropdown-item-del" data-del="${l.id}" aria-label="Delete list">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </button>` : ''}
    </div>
  `).join('');

  listItems.querySelectorAll('.list-dropdown-item').forEach(el => {
    const lid = el.dataset.lid;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.list-dropdown-item-del')) return;
      switchList(lid);
    });
  });
  listItems.querySelectorAll('.list-dropdown-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteList(btn.dataset.del); });
  });
}

listCurrent.onclick = () => switcher.classList.toggle('open');
document.addEventListener('click', (e) => { if (!switcher.contains(e.target)) switcher.classList.remove('open'); });

listAdd.onclick = async () => {
  const name = prompt('List name:');
  if (!name || !name.trim()) return;
  try {
    const info = await invoke('create_list', { name: name.trim() });
    activeListId = info.id;
    lists = await invoke('get_lists');
    todos = await invoke('get_todos');
    expanded = null; kbIndex = -1;
    renderLists(); render(true);
    switcher.classList.remove('open');
  } catch (err) { console.error(err); }
};

async function switchList(id) {
  if (id === activeListId) { switcher.classList.remove('open'); return; }
  try {
    todos = await invoke('switch_list', { id });
    activeListId = id;
    lists = await invoke('get_lists');
    expanded = null; kbIndex = -1;
    renderLists(); render(true);
    switcher.classList.remove('open');
  } catch (err) { console.error(err); }
}

async function deleteList(id) {
  if (!confirm('Delete this list and all its tasks?')) return;
  try {
    await invoke('delete_list', { id });
    lists = await invoke('get_lists');
    activeListId = await invoke('get_active_list');
    todos = await invoke('get_todos');
    expanded = null; kbIndex = -1;
    renderLists(); render(true);
  } catch (err) { console.error(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Render
   ═══════════════════════════════════════════════════════════════════════════ */

function render(anim) {
  const items = visible();
  const openN = todos.filter(t => !t.completed).length;
  const doneN = todos.filter(t =>  t.completed).length;

  ctTotal.textContent = todos.length;
  ctOpen.textContent  = openN;
  ctDone.textContent  = doneN;
  if (anim) { pop(ctTotal); pop(ctOpen); pop(ctDone); }

  doneN > 0 ? foot.classList.add('on') : foot.classList.remove('on');
  updateTitle();

  if (!items.length) {
    listEl.innerHTML = '';
    nil.classList.add('on');
    if (searchQuery) {
      nilIcon.innerHTML = emptyIcons.search;
      nilTitle.textContent = 'No matches';
      nilSub.textContent = 'Try a different search';
    } else if (filter === 'active') {
      nilIcon.innerHTML = emptyIcons.active;
      nilTitle.textContent = 'All done!';
      nilSub.textContent = 'Everything is checked off';
    } else if (filter === 'completed') {
      nilIcon.innerHTML = emptyIcons.completed;
      nilTitle.textContent = 'Nothing done yet';
      nilSub.textContent = 'Complete a task to see it here';
    } else {
      nilIcon.innerHTML = emptyIcons.all;
      nilTitle.textContent = 'No tasks';
      nilSub.textContent = 'Type above to add one';
    }
    return;
  }
  nil.classList.remove('on');

  if (kbIndex >= items.length) kbIndex = items.length - 1;

  listEl.innerHTML = items.map((t, idx) => {
    const hasNote = t.description && t.description.trim().length > 0;
    const isOpen = expanded === t.id;
    const due = formatDue(t.due_date);
    const focused = kbMode && kbIndex === idx;

    return `
    <li class="item${t.completed ? ' done' : ''}${isOpen ? ' open' : ''}${focused ? ' kb-focus' : ''}" data-id="${t.id}" data-idx="${idx}">
      <div class="item-row">
        <div class="drag-handle" title="Drag to reorder">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
            <circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/>
            <circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>
            <circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/>
          </svg>
        </div>
        <label class="ck"><input type="checkbox"${t.completed ? ' checked' : ''}/><span class="ck-mark"></span></label>
        <div class="item-content">
          <span class="item-title">${esc(t.title)}${hasNote && !isOpen ? '<span class="item-has-note"></span>' : ''}</span>
          ${hasNote && !isOpen ? `<div class="item-note-preview">${esc(t.description)}</div>` : ''}
          ${due && !isOpen ? `<div class="item-meta"><span class="item-due ${due.cls}">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 3.5V6.5L8 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            ${due.label}</span></div>` : ''}
        </div>
        <div class="acts">
          <button class="act act-edit" aria-label="Edit title">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M10 1.5L12.5 4L4.5 12H2V9.5L10 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button class="act act-del" aria-label="Delete">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 3.5L11 11.5M11 3.5L3 11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="item-detail">
        <div class="item-detail-inner">
          <div class="detail-due">
            <span class="detail-due-label">Due</span>
            <input type="date" class="detail-due-input" value="${t.due_date || ''}" />
            ${t.due_date ? '<button class="detail-due-clear" aria-label="Clear date">✕</button>' : ''}
          </div>
          <textarea class="note-area" placeholder="Add a note…" rows="3">${hasNote ? esc(t.description) : ''}</textarea>
          <div class="note-hint">Press <kbd>Esc</kbd> to close</div>
        </div>
      </div>
    </li>`;
  }).join('');

  bindItems();

  if (kbMode && kbIndex >= 0) {
    const focused = listEl.querySelector('.kb-focus');
    if (focused) focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Bind Item Events
   ═══════════════════════════════════════════════════════════════════════════ */

function bindItems() {
  listEl.querySelectorAll('.item').forEach(el => {
    const id = el.dataset.id;

    el.querySelector('input[type=checkbox]').onchange = (e) => { e.stopPropagation(); toggle(id); };
    el.querySelector('.act-edit').onclick = (e) => { e.stopPropagation(); editTitle(id); };
    el.querySelector('.act-del').onclick  = (e) => { e.stopPropagation(); remove(id, el); };

    el.querySelector('.item-content').onclick = () => {
      expanded = expanded === id ? null : id;
      render();
      if (expanded === id) {
        setTimeout(() => {
          const ta = listEl.querySelector(`[data-id="${id}"] .note-area`);
          if (ta) ta.focus();
        }, 50);
      }
    };

    const ta = el.querySelector('.note-area');
    if (ta) {
      let timer = null;
      ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => saveNote(id, ta.value), 400); });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); saveNote(id, ta.value).then(() => { expanded = null; render(); }); }
      });
      ta.addEventListener('blur', () => saveNote(id, ta.value));
      ta.addEventListener('click', (e) => e.stopPropagation());
    }

    const dateInput = el.querySelector('.detail-due-input');
    if (dateInput) {
      dateInput.addEventListener('change', () => saveDue(id, dateInput.value || null));
      dateInput.addEventListener('click', (e) => e.stopPropagation());
    }

    const dateClear = el.querySelector('.detail-due-clear');
    if (dateClear) {
      dateClear.addEventListener('click', (e) => { e.stopPropagation(); saveDue(id, null); });
    }

    const handle = el.querySelector('.drag-handle');
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDrag(el, id, e);
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pointer-based Drag & Drop
   ═══════════════════════════════════════════════════════════════════════════ */

let dragState = null;

function startDrag(el, id, e) {
  const rect = el.getBoundingClientRect();
  const scrollContainer = document.getElementById('scroll');

  // Create ghost clone
  const ghost = el.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = rect.width + 'px';
  ghost.style.position = 'fixed';
  ghost.style.zIndex = '100';
  ghost.style.pointerEvents = 'none';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  document.body.appendChild(ghost);

  el.classList.add('dragging');

  dragState = {
    id,
    el,
    ghost,
    offsetY: e.clientY - rect.top,
    startY: e.clientY,
    scrollContainer,
  };

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e) {
  if (!dragState) return;
  const { ghost, offsetY, scrollContainer } = dragState;

  // Move ghost
  ghost.style.top = (e.clientY - offsetY) + 'px';

  // Find drop target
  const items = listEl.querySelectorAll('.item:not(.dragging)');
  let closest = null;
  let closestDist = Infinity;

  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const dist = Math.abs(e.clientY - mid);
    if (dist < closestDist) {
      closestDist = dist;
      closest = item;
    }
    item.classList.remove('drag-over');
  });

  if (closest) closest.classList.add('drag-over');

  // Auto-scroll when near edges
  const sr = scrollContainer.getBoundingClientRect();
  const edge = 40;
  if (e.clientY < sr.top + edge) {
    scrollContainer.scrollTop -= 6;
  } else if (e.clientY > sr.bottom - edge) {
    scrollContainer.scrollTop += 6;
  }
}

function onDragEnd(e) {
  if (!dragState) return;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);

  const { id, el, ghost } = dragState;

  // Find drop target
  const items = listEl.querySelectorAll('.item:not(.dragging)');
  let target = null;
  let closestDist = Infinity;

  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const dist = Math.abs(e.clientY - mid);
    if (dist < closestDist) {
      closestDist = dist;
      target = item;
    }
    item.classList.remove('drag-over');
  });

  // Clean up
  ghost.remove();
  el.classList.remove('dragging');

  const toId = target?.dataset.id;
  if (toId && toId !== id) {
    reorder(id, toId);
  }

  dragState = null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Actions
   ═══════════════════════════════════════════════════════════════════════════ */

async function add(e) {
  e.preventDefault();
  const v = input.value.trim(); if (!v) return;
  input.value = '';
  try {
    const t = await invoke('add_todo', { title: v });
    todos.unshift(t);
    lists = await invoke('get_lists'); renderLists();
    render(true); input.focus();
  } catch (err) { console.error(err); }
}

async function toggle(id) {
  try {
    const u = await invoke('toggle_todo', { id });
    const i = todos.findIndex(t => t.id === id); if (i > -1) todos[i] = u;
    lists = await invoke('get_lists'); renderLists();
    render(true);
  } catch (err) { console.error(err); }
}

async function remove(id, el) {
  if (expanded === id) expanded = null;
  el.classList.add('out');
  await new Promise(r => setTimeout(r, 260));
  try {
    const idx = todos.findIndex(t => t.id === id);
    const deleted = await invoke('delete_todo', { id });
    todos = todos.filter(t => t.id !== id);
    lists = await invoke('get_lists'); renderLists();
    render(true); showUndo(deleted, idx);
  } catch (err) { console.error(err); }
}

async function clearDone() {
  expanded = null;
  try {
    todos = await invoke('clear_completed');
    lists = await invoke('get_lists'); renderLists();
    render(true);
  } catch (err) { console.error(err); }
}

async function saveNote(id, text) {
  try { const u = await invoke('update_description', { id, description: text }); const i = todos.findIndex(t => t.id === id); if (i > -1) todos[i] = u; }
  catch (err) { console.error(err); }
}

async function saveDue(id, date) {
  try { const u = await invoke('update_due_date', { id, dueDate: date }); const i = todos.findIndex(t => t.id === id); if (i > -1) todos[i] = u; render(); }
  catch (err) { console.error(err); }
}

async function reorder(fromId, toId) {
  const fromIdx = todos.findIndex(t => t.id === fromId);
  const toIdx   = todos.findIndex(t => t.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = todos.splice(fromIdx, 1);
  todos.splice(toIdx, 0, moved);
  render();
  try { await invoke('reorder_todos', { ids: todos.map(t => t.id) }); }
  catch (err) { console.error(err); }
}

function editTitle(id) {
  const todo = todos.find(t => t.id === id); if (!todo) return;
  const el = listEl.querySelector(`[data-id="${id}"]`);
  const content = el.querySelector('.item-content');
  const acts = el.querySelector('.acts');

  const inp = document.createElement('input');
  inp.className = 'item-edit'; inp.value = todo.title; inp.maxLength = 200;
  content.replaceWith(inp); acts.style.display = 'none';
  inp.focus(); inp.select();

  const done = async () => {
    const v = inp.value.trim();
    if (v && v !== todo.title) {
      try { const u = await invoke('update_todo', { id, title: v }); const i = todos.findIndex(t => t.id === id); if (i > -1) todos[i] = u; }
      catch (err) { console.error(err); }
    }
    render();
  };

  inp.addEventListener('blur', done, { once: true });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.value = todo.title; inp.blur(); }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Undo Toast
   ═══════════════════════════════════════════════════════════════════════════ */

function showUndo(todo, index) {
  clearTimeout(undoTimer);
  undoData = { todo, index };
  toast.classList.remove('on'); void toast.offsetWidth; toast.classList.add('on');
  undoTimer = setTimeout(() => { toast.classList.remove('on'); undoData = null; }, 4000);
}

toastUndo.onclick = async () => {
  if (!undoData) return;
  clearTimeout(undoTimer);
  toast.classList.remove('on');
  try {
    todos = await invoke('restore_todo', { todo: undoData.todo, index: undoData.index });
    undoData = null;
    lists = await invoke('get_lists'); renderLists();
    render(true);
  } catch (err) { console.error(err); }
};

/* ═══════════════════════════════════════════════════════════════════════════
   Search
   ═══════════════════════════════════════════════════════════════════════════ */

searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value.trim();
  searchClr.classList.toggle('on', searchQuery.length > 0);
  render();
});
searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { searchEl.value = ''; searchQuery = ''; searchClr.classList.remove('on'); render(); searchEl.blur(); }
});
searchClr.onclick = () => { searchEl.value = ''; searchQuery = ''; searchClr.classList.remove('on'); render(); searchEl.focus(); };

/* ═══════════════════════════════════════════════════════════════════════════
   Filters
   ═══════════════════════════════════════════════════════════════════════════ */

const tabMap = { all: '0', active: '1', completed: '2' };
document.querySelectorAll('.tab').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    b.classList.add('on');
    filter = b.dataset.f;
    pill.setAttribute('data-i', tabMap[filter]);
    kbIndex = -1;
    render();
  };
});

/* ═══════════════════════════════════════════════════════════════════════════
   Keyboard Navigation
   ═══════════════════════════════════════════════════════════════════════════ */

function showKbHint(text) {
  kbHint.innerHTML = text;
  kbHint.classList.add('on');
  clearTimeout(kbHint._t);
  kbHint._t = setTimeout(() => kbHint.classList.remove('on'), 2000);
}

function getKbId() { return visible()[kbIndex]?.id || null; }

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); input.focus(); exitKbMode(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchEl.focus(); exitKbMode(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { if (undoData) { e.preventDefault(); toastUndo.click(); } return; }

  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const items = visible();
  if (!items.length) return;

  switch (e.key) {
    case 'ArrowDown': case 'j':
      e.preventDefault(); kbMode = true;
      kbIndex = Math.min(kbIndex + 1, items.length - 1);
      render();
      showKbHint('<kbd>↑↓</kbd> navigate  <kbd>Space</kbd> toggle  <kbd>E</kbd> edit  <kbd>D</kbd> delete  <kbd>Enter</kbd> expand');
      break;
    case 'ArrowUp': case 'k':
      e.preventDefault(); kbMode = true;
      kbIndex = Math.max(kbIndex - 1, 0);
      render(); break;
    case ' ':
      if (kbMode && kbIndex >= 0) { e.preventDefault(); const id = getKbId(); if (id) toggle(id); }
      break;
    case 'e': case 'E':
      if (kbMode && kbIndex >= 0) { e.preventDefault(); const id = getKbId(); if (id) editTitle(id); }
      break;
    case 'd': case 'D':
      if (kbMode && kbIndex >= 0) {
        e.preventDefault(); const id = getKbId();
        const el = listEl.querySelector(`[data-id="${id}"]`);
        if (id && el) remove(id, el);
      }
      break;
    case 'Enter':
      if (kbMode && kbIndex >= 0) {
        e.preventDefault(); const id = getKbId();
        if (id) {
          expanded = expanded === id ? null : id;
          render();
          if (expanded === id) {
            setTimeout(() => {
              const ta = listEl.querySelector(`[data-id="${id}"] .note-area`);
              if (ta) ta.focus();
            }, 50);
          }
        }
      }
      break;
    case 'Escape':
      if (kbMode) { exitKbMode(); render(); }
      break;
  }
});

function exitKbMode() { kbMode = false; kbIndex = -1; kbHint.classList.remove('on'); }
document.addEventListener('mousedown', () => { if (kbMode) { exitKbMode(); render(); } });

/* ═══════════════════════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════════════════════ */

form.onsubmit = add;
clearBtn.onclick = clearDone;

(async () => {
  try {
    // Load theme first (before any render to avoid flash)
    theme = await invoke('get_theme');
    applyTheme(theme);

    lists = await invoke('get_lists');
    activeListId = await invoke('get_active_list');
    todos = await invoke('get_todos');
    renderLists();
    render();
    input.focus();

    // Remove boot animation class after startup
    setTimeout(() => document.querySelector('.window').classList.remove('boot'), 1000);
  } catch (err) { console.error(err); }
})();
