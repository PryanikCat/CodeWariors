'use strict';

/* ============================================================
   TaskFlow — логика приложения
   ============================================================ */

const STORAGE_KEY = 'taskflow.tasks.v1';
const SEED_KEY = 'taskflow.seeded.v1';

const PRIORITY_LABEL = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
const PRIORITIES = ['low', 'medium', 'high'];

/* ---------- Состояние ---------- */
let tasks = [];
let filter = 'all';
let query = '';

/* ---------- DOM ---------- */
const els = {
  form: document.getElementById('composer'),
  field: document.querySelector('.composer__field'),
  input: document.getElementById('taskInput'),
  priority: document.getElementById('prioritySelect'),
  list: document.getElementById('taskList'),
  empty: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptyText: document.getElementById('emptyText'),
  counter: document.getElementById('counter'),
  clearBtn: document.getElementById('clearCompleted'),
  search: document.getElementById('searchInput'),
  bar: document.getElementById('progressBar'),
  percent: document.getElementById('progressPercent'),
  progressLabel: document.getElementById('progressLabel'),
  date: document.getElementById('today'),
};

/* ============================================================
   Утилиты
   ============================================================ */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function renderDate() {
  const str = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  els.date.textContent = str.charAt(0).toUpperCase() + str.slice(1);
}

/* ============================================================
   Хранилище
   ============================================================ */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    tasks = [];
  }

  tasks = tasks
    .filter(t => t && typeof t.text === 'string')
    .map(t => ({
      id: t.id || uid(),
      text: t.text,
      done: !!t.done,
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      createdAt: t.createdAt || Date.now(),
    }));
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    /* хранилище недоступно — работаем без сохранения */
  }
}

/* Демо-задачи при первом запуске */
function seedIfFirstVisit() {
  if (localStorage.getItem(SEED_KEY)) return;
  localStorage.setItem(SEED_KEY, '1');
  if (tasks.length) return;

  const now = Date.now();
  tasks = [
    { id: uid(), text: 'Изучить TaskFlow и настроить под себя', done: false, priority: 'high',   createdAt: now },
    { id: uid(), text: 'Составить план на день',                done: true,  priority: 'medium', createdAt: now - 3600000 },
    { id: uid(), text: 'Выпить стакан воды 💧',                 done: false, priority: 'low',    createdAt: now - 7200000 },
  ];
  save();
}

/* ============================================================
   Рендер
   ============================================================ */

function getVisibleTasks() {
  const q = query.trim().toLowerCase();
  return tasks.filter(t => {
    if (filter === 'active' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (q && !t.text.toLowerCase().includes(q)) return false;
    return true;
  });
}

function createTaskElement(task, canDrag) {
  const li = document.createElement('li');
  li.className = 'task' + (task.done ? ' task--done' : '');
  li.dataset.id = task.id;
  li.dataset.priority = task.priority;
  li.draggable = !!canDrag;

  /* Чекбокс */
  const check = document.createElement('button');
  check.className = 'task__check';
  check.type = 'button';
  check.setAttribute('aria-label', task.done ? 'Снять отметку' : 'Отметить выполненной');
  check.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* Контент */
  const body = document.createElement('div');
  body.className = 'task__body';

  const text = document.createElement('span');
  text.className = 'task__text';
  text.textContent = task.text;
  text.title = 'Двойной клик — редактировать';

  const meta = document.createElement('div');
  meta.className = 'task__meta';

  const badge = document.createElement('span');
  badge.className = 'task__badge task__badge--' + task.priority;
  badge.textContent = PRIORITY_LABEL[task.priority];

  const time = document.createElement('span');
  time.textContent = formatTime(task.createdAt);

  meta.append(badge, time);
  body.append(text, meta);

  /* Удаление */
  const del = document.createElement('button');
  del.className = 'task__delete';
  del.type = 'button';
  del.setAttribute('aria-label', 'Удалить задачу');
  del.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  li.append(check, body, del);
  return li;
}

function render() {
  const visible = getVisibleTasks();
  const canDrag = filter === 'all' && !query.trim();

  els.list.innerHTML = '';
  const frag = document.createDocumentFragment();
  visible.forEach(t => frag.appendChild(createTaskElement(t, canDrag)));
  els.list.appendChild(frag);

  /* Пустое состояние */
  if (visible.length === 0) {
    els.empty.hidden = false;
    if (query.trim()) {
      els.emptyTitle.textContent = 'Ничего не найдено';
      els.emptyText.textContent = 'Попробуйте изменить запрос или сбросить фильтр.';
    } else if (filter === 'done') {
      els.emptyTitle.textContent = 'Пока нет выполненных задач';
      els.emptyText.textContent = 'Отметьте задачу галочкой — и она появится здесь.';
    } else if (filter === 'active') {
      els.emptyTitle.textContent = 'Все задачи выполнены! 🎉';
      els.emptyText.textContent = 'Отличная работа. Самое время немного отдохнуть.';
    } else {
      els.emptyTitle.textContent = 'Список пуст';
      els.emptyText.textContent = 'Добавьте первую задачу — и начнём!';
    }
  } else {
    els.empty.hidden = true;
  }

  updateStats();
  updateProgress();
}

function updateStats() {
  const total = tasks.length;
  const left = tasks.filter(t => !t.done).length;

  els.counter.textContent = total === 0
    ? 'Задач пока нет'
    : 'Осталось ' + left + ' из ' + total;

  els.clearBtn.disabled = (total - left) === 0;
}

function updateProgress() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  els.bar.style.width = pct + '%';
  els.percent.textContent = pct + '%';
  els.progressLabel.textContent = (total > 0 && done === total)
    ? 'Всё готово! Отличная работа 🎉'
    : 'Прогресс дня';
}

/* ============================================================
   Действия с задачами
   ============================================================ */

function findLi(id) {
  return [...els.list.children].find(el => el.dataset.id === id) || null;
}

function addTask(text, priority) {
  tasks.unshift({
    id: uid(),
    text,
    done: false,
    priority,
    createdAt: Date.now(),
  });
  save();

  /* Если новая задача не попадёт в текущее представление — покажем её */
  if (filter === 'done' || (query.trim() && !text.toLowerCase().includes(query.trim().toLowerCase()))) {
    filter = 'all';
    query = '';
    els.search.value = '';
    syncFilterButtons();
  }

  render();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.done = !task.done;
  save();

  const li = findLi(id);
  if (li) {
    li.classList.toggle('task--done', task.done);
    const check = li.querySelector('.task__check');
    if (check) {
      check.setAttribute('aria-label', task.done ? 'Снять отметку' : 'Отметить выполненной');
    }
  }

  updateStats();
  updateProgress();

  /* Задача должна исчезнуть из текущего фильтра — плавно убираем */
  const willHide = (filter === 'active' && task.done) || (filter === 'done' && !task.done);
  if (willHide) {
    setTimeout(() => {
      if (li) li.classList.add('task--removing');
      setTimeout(render, 210);
    }, 280);
  }
}

function removeTask(id) {
  const li = findLi(id);
  const finalize = () => {
    tasks = tasks.filter(t => t.id !== id);
    save();
    render();
  };

  if (!li) { finalize(); return; }

  li.classList.add('task--removing');
  setTimeout(finalize, 220);
}

function clearCompleted() {
  const doneEls = [...els.list.children].filter(el => el.classList.contains('task--done'));

  doneEls.forEach(el => el.classList.add('task--removing'));

  setTimeout(() => {
    tasks = tasks.filter(t => !t.done);
    save();
    render();
  }, doneEls.length ? 220 : 0);
}

function startEdit(li) {
  const task = tasks.find(t => t.id === li.dataset.id);
  if (!task) return;

  const textEl = li.querySelector('.task__text');
  if (!textEl) return;

  const input = document.createElement('input');
  input.className = 'task__edit';
  input.type = 'text';
  input.value = task.text;
  input.maxLength = 140;

  textEl.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let settled = false;

  const commit = (apply) => {
    if (settled) return;
    settled = true;

    if (apply) {
      const val = input.value.trim();
      if (val) task.text = val;
    }
    save();
    render();
  };

  input.addEventListener('blur', () => commit(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(true); }
    if (e.key === 'Escape') { e.preventDefault(); commit(false); }
  });
}

/* ============================================================
   Фильтры
   ============================================================ */

function syncFilterButtons() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.filter === filter);
  });
}

document.querySelectorAll('.filter').forEach(btn => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    syncFilterButtons();
    render();
  });
});

/* ============================================================
   Поиск
   ============================================================ */

els.search.addEventListener('input', () => {
  query = els.search.value;
  render();
});

els.search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    els.search.value = '';
    query = '';
    render();
  }
});

/* ============================================================
   Добавление задачи
   ============================================================ */

els.form.addEventListener('submit', (e) => {
  e.preventDefault();

  const text = els.input.value.trim();
  if (!text) {
    els.field.classList.remove('shake');
    void els.field.offsetWidth; /* перезапуск анимации */
    els.field.classList.add('shake');
    els.input.focus();
    return;
  }

  addTask(text, els.priority.value);
  els.input.value = '';
  els.input.focus();
});

els.field.addEventListener('animationend', () => {
  els.field.classList.remove('shake');
});

/* ============================================================
   Делегирование событий списка
   ============================================================ */

els.list.addEventListener('click', (e) => {
  const li = e.target.closest('.task');
  if (!li) return;

  if (e.target.closest('.task__check')) {
    toggleTask(li.dataset.id);
  } else if (e.target.closest('.task__delete')) {
    removeTask(li.dataset.id);
  }
});

els.list.addEventListener('dblclick', (e) => {
  const textEl = e.target.closest('.task__text');
  if (!textEl) return;
  const li = textEl.closest('.task');
  if (li) startEdit(li);
});

/* ---------- Очистка выполненных ---------- */
els.clearBtn.addEventListener('click', clearCompleted);

/* ============================================================
   Drag & Drop (только в режиме «Все» без поиска)
   ============================================================ */

let dragEl = null;

els.list.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.task');
  if (!li || !li.draggable) return;

  dragEl = li;
  li.classList.add('task--dragging');

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
  }
});

els.list.addEventListener('dragover', (e) => {
  if (!dragEl) return;
  e.preventDefault();

  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

  const after = getDragAfterElement(els.list, e.clientY);
  if (after == null) {
    els.list.appendChild(dragEl);
  } else if (after !== dragEl) {
    els.list.insertBefore(dragEl, after);
  }
});

els.list.addEventListener('dragend', () => {
  if (!dragEl) return;
  dragEl.classList.remove('task--dragging');
  dragEl = null;
  syncOrderFromDOM();
});

function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.task:not(.task--dragging)')];

  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function syncOrderFromDOM() {
  const ids = [...els.list.children].map(el => el.dataset.id);
  const map = new Map(tasks.map(t => [t.id, t]));

  const ordered = ids.map(id => map.get(id)).filter(Boolean);
  const rest = tasks.filter(t => !ids.includes(t.id));

  tasks = [...ordered, ...rest];
  save();
  render();
}

/* ============================================================
   Горячие клавиши
   ============================================================ */

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement ? document.activeElement.tagName : '';
  const isTyping = /INPUT|TEXTAREA|SELECT/.test(tag);

  if (e.key === '/' && !isTyping) {
    e.preventDefault();
    els.input.focus();
  }
});

/* ============================================================
   Инициализация
   ============================================================ */

(function init() {
  renderDate();
  load();
  seedIfFirstVisit();
  syncFilterButtons();
  render();
})();
