if (typeof document === 'undefined') {
  if (typeof console !== 'undefined') {
    console.log('app.js — это браузерный скрипт. Запускайте через index.html и локальный сервер, а не через `node app.js`.');
  }
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(0);
  }
}

if (typeof document !== 'undefined') {
const STORAGE_KEY = 'writer-dashboard-state-v1';

const defaultState = {
  projects: [
    { id: 1, name: 'Роман «Северный ветер»', words: 18340, status: 'active' },
    { id: 2, name: 'Сборник рассказов', words: 42000, status: 'completed' }
  ],
  documents: [{ id: 1, name: 'Черновик главы 1', content: '' }],
  currentDocId: 1,
  tasks: [],
  allTime: {
    wordsTyped: 0,
    docsCreated: 1,
    tasksDone: 0
  }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      allTime: { ...defaultState.allTime, ...(parsed.allTime || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();
let elapsedSeconds = 0;
let timerId = null;
let lastEditorWordCount = 0;

const totalWordsEl = document.getElementById('totalWords');
const activeProjectsEl = document.getElementById('activeProjects');
const completedProjectsEl = document.getElementById('completedProjects');
const projectsListEl = document.getElementById('projectsList');
const editorWordCountEl = document.getElementById('editorWordCount');
const editorWordCountInlineEl = document.getElementById('editorWordCountInline');

const allTimeWordsTypedEl = document.getElementById('allTimeWordsTyped');
const allTimeDocsCreatedEl = document.getElementById('allTimeDocsCreated');
const allTimeTasksDoneEl = document.getElementById('allTimeTasksDone');

const projectNameInput = document.getElementById('projectName');
const projectWordsInput = document.getElementById('projectWords');
const projectStatusSelect = document.getElementById('projectStatus');
const addProjectBtn = document.getElementById('addProject');

const docsListEl = document.getElementById('docsList');
const newDocNameInput = document.getElementById('newDocName');
const createDocBtn = document.getElementById('createDocBtn');
const currentDocNameEl = document.getElementById('currentDocName');

const editorInput = document.getElementById('editorInput');
const notesInput = document.getElementById('notesInput');
const notesWordCountEl = document.getElementById('notesWordCount');

const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const tasksListEl = document.getElementById('tasksList');

const timerDisplay = document.getElementById('timerDisplay');
const startTimerBtn = document.getElementById('startTimer');
const pauseTimerBtn = document.getElementById('pauseTimer');
const resetTimerBtn = document.getElementById('resetTimer');

const overlay = document.getElementById('overlay');
const panels = {
  timer: document.getElementById('timerPanel'),
  notes: document.getElementById('notesPanel'),
  audio: document.getElementById('audioPanel')
};

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function countWords(text) {
  const normalizedText = text.replace(/<[^>]*>/g, ' ').trim();
  return normalizedText ? normalizedText.split(/\s+/).filter(Boolean).length : 0;
}

function getCurrentDocument() {
  return state.documents.find((document) => document.id === state.currentDocId) || null;
}

function renderAllTime() {
  allTimeWordsTypedEl.textContent = state.allTime.wordsTyped.toLocaleString('ru-RU');
  allTimeDocsCreatedEl.textContent = state.allTime.docsCreated.toLocaleString('ru-RU');
  allTimeTasksDoneEl.textContent = state.allTime.tasksDone.toLocaleString('ru-RU');
}

function renderProjects() {
  const totalWords = state.projects.reduce((sum, project) => sum + project.words, 0);
  const active = state.projects.filter((project) => project.status === 'active').length;
  const completed = state.projects.filter((project) => project.status === 'completed').length;

  totalWordsEl.textContent = totalWords.toLocaleString('ru-RU');
  activeProjectsEl.textContent = active;
  completedProjectsEl.textContent = completed;

  projectsListEl.innerHTML = '';
  state.projects.forEach((project) => {
    const li = document.createElement('li');
    const statusLabel = project.status === 'active' ? 'Активный' : 'Завершённый';
    li.innerHTML = `<span>${project.name}</span><span>${project.words.toLocaleString('ru-RU')} слов • ${statusLabel}</span>`;
    projectsListEl.appendChild(li);
  });
}

function updateEditorWordCounters() {
  const words = countWords(editorInput.innerText);
  editorWordCountEl.textContent = words;
  editorWordCountInlineEl.textContent = words;
  const delta = words - lastEditorWordCount;
  if (delta > 0) {
    state.allTime.wordsTyped += delta;
    renderAllTime();
  }
  lastEditorWordCount = words;
}

function renderDocuments() {
  docsListEl.innerHTML = '';

  state.documents.forEach((document) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = document.name;

    if (document.id === state.currentDocId) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => {
      state.currentDocId = document.id;
      const selected = getCurrentDocument();
      if (!selected) return;
      editorInput.innerHTML = selected.content;
      currentDocNameEl.textContent = selected.name;
      lastEditorWordCount = countWords(editorInput.innerText);
      renderDocuments();
      updateEditorWordCounters();
      persist();
    });

    li.appendChild(button);
    docsListEl.appendChild(li);
  });
}

function createDocument() {
  const name = newDocNameInput.value.trim();
  if (!name) return;

  const newDocument = { id: Date.now(), name, content: '' };
  state.documents.unshift(newDocument);
  state.currentDocId = newDocument.id;
  state.allTime.docsCreated += 1;

  newDocNameInput.value = '';
  editorInput.innerHTML = '';
  currentDocNameEl.textContent = newDocument.name;
  lastEditorWordCount = 0;

  renderDocuments();
  updateEditorWordCounters();
  renderAllTime();
  persist();
}

function saveCurrentDocumentContent() {
  const document = getCurrentDocument();
  if (!document) return;
  document.content = editorInput.innerHTML;
  persist();
}

function renderTasks() {
  tasksListEl.innerHTML = '';

  state.tasks.forEach((task) => {
    const li = document.createElement('li');

    const left = document.createElement('div');
    left.className = 'task-left';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;

    const text = document.createElement('span');
    text.textContent = task.text;
    if (task.done) text.classList.add('task-done');

    checkbox.addEventListener('change', () => {
      const wasDone = task.done;
      task.done = checkbox.checked;
      if (!wasDone && task.done) {
        state.allTime.tasksDone += 1;
      }
      renderTasks();
      renderAllTime();
      persist();
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'task-delete';
    removeBtn.textContent = 'Удалить';
    removeBtn.addEventListener('click', () => {
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      renderTasks();
      persist();
    });

    left.append(checkbox, text);
    li.append(left, removeBtn);
    tasksListEl.appendChild(li);
  });
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;

  state.tasks.unshift({ id: Date.now(), text, done: false });
  taskInput.value = '';
  renderTasks();
  persist();
}

function formatTime(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function updateTimer() {
  timerDisplay.textContent = formatTime(elapsedSeconds);
}

function closeAllPanels() {
  Object.values(panels).forEach((panel) => panel.classList.add('hidden'));
  overlay.classList.add('hidden');
}

function openPanel(name) {
  closeAllPanels();
  panels[name].classList.remove('hidden');
  overlay.classList.remove('hidden');
}

document.querySelectorAll('.tool-fab').forEach((button) => {
  button.addEventListener('click', () => openPanel(button.dataset.tool));
});

document.querySelectorAll('.close-btn').forEach((button) => {
  button.addEventListener('click', closeAllPanels);
});

overlay.addEventListener('click', closeAllPanels);

startTimerBtn.addEventListener('click', () => {
  if (timerId !== null) return;
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    updateTimer();
  }, 1000);
});

pauseTimerBtn.addEventListener('click', () => {
  if (timerId === null) return;
  clearInterval(timerId);
  timerId = null;
});

resetTimerBtn.addEventListener('click', () => {
  clearInterval(timerId);
  timerId = null;
  elapsedSeconds = 0;
  updateTimer();
});

addProjectBtn.addEventListener('click', () => {
  const name = projectNameInput.value.trim();
  const words = Number(projectWordsInput.value);
  const status = projectStatusSelect.value;

  if (!name || Number.isNaN(words) || words < 0) return;

  state.projects.push({ id: Date.now(), name, words, status });
  projectNameInput.value = '';
  projectWordsInput.value = '';
  projectStatusSelect.value = 'active';

  renderProjects();
  persist();
});

createDocBtn.addEventListener('click', createDocument);
newDocNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') createDocument();
});

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addTask();
});

editorInput.addEventListener('input', () => {
  updateEditorWordCounters();
  saveCurrentDocumentContent();
});

document.querySelectorAll('.format-btn').forEach((button) => {
  button.addEventListener('click', () => {
    editorInput.focus();
    document.execCommand(button.dataset.command, false, null);
    updateEditorWordCounters();
    saveCurrentDocumentContent();
  });
});

notesInput.addEventListener('input', () => {
  notesWordCountEl.textContent = countWords(notesInput.value);
});

const initialDocument = getCurrentDocument();
if (initialDocument) {
  currentDocNameEl.textContent = initialDocument.name;
  editorInput.innerHTML = initialDocument.content;
}
lastEditorWordCount = countWords(editorInput.innerText);

renderProjects();
renderDocuments();
renderTasks();
renderAllTime();
updateTimer();
updateEditorWordCounters();
persist();

}
