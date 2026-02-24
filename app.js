if (typeof document === 'undefined') {
  if (typeof console !== 'undefined') {
    console.log('app.js — это браузерный скрипт. Запускайте через index.html и локальный сервер, а не через `node app.js`.');
  }
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(0);
  }
}

if (typeof document !== 'undefined') {
  const STORAGE_KEY = 'writer-dashboard-state-v2';

  const defaultState = {
    projects: [
      { id: 1, name: 'Роман «Северный ветер»', status: 'active' },
      { id: 2, name: 'Сборник рассказов', status: 'completed' }
    ],
    documents: [{ id: 1, name: 'Черновик главы 1', content: '' }],
    currentDocId: 1,
    tasks: [],
    notes: [{ id: 1, title: 'Идея сюжета', content: '' }],
    currentNoteId: 1,
    audio: {
      source: 'spotify',
      url: '',
      embedUrl: ''
    },
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
        allTime: { ...defaultState.allTime, ...(parsed.allTime || {}) },
        audio: { ...defaultState.audio, ...(parsed.audio || {}) }
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
  const totalCharsEl = document.getElementById('totalChars');
  const editorWordCountEl = document.getElementById('editorWordCount');
  const editorCharCountEl = document.getElementById('editorCharCount');
  const editorWordCountInlineEl = document.getElementById('editorWordCountInline');
  const editorCharCountInlineEl = document.getElementById('editorCharCountInline');

  const allTimeWordsTypedEl = document.getElementById('allTimeWordsTyped');
  const allTimeDocsCreatedEl = document.getElementById('allTimeDocsCreated');
  const allTimeTasksDoneEl = document.getElementById('allTimeTasksDone');

  const projectNameInput = document.getElementById('projectName');
  const projectStatusSelect = document.getElementById('projectStatus');
  const addProjectBtn = document.getElementById('addProject');

  const docsListEl = document.getElementById('docsList');
  const newDocNameInput = document.getElementById('newDocName');
  const createDocBtn = document.getElementById('createDocBtn');
  const currentDocNameEl = document.getElementById('currentDocName');

  const editorInput = document.getElementById('editorInput');

  const notesListEl = document.getElementById('notesList');
  const newNoteTitleInput = document.getElementById('newNoteTitle');
  const addNoteBtn = document.getElementById('addNoteBtn');
  const notesInput = document.getElementById('notesInput');
  const notesWordCountEl = document.getElementById('notesWordCount');

  const audioSourceType = document.getElementById('audioSourceType');
  const audioUrlInput = document.getElementById('audioUrlInput');
  const applyAudioBtn = document.getElementById('applyAudioBtn');
  const audioEmbed = document.getElementById('audioEmbed');
  const audioHelp = document.getElementById('audioHelp');

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

  function countChars(text) {
    return text.replace(/\s/g, '').length;
  }

  function getDocumentsTextStats() {
    const plain = state.documents.map((doc) => (doc.content || '').replace(/<[^>]*>/g, ' ')).join(' ');
    return {
      words: countWords(plain),
      chars: countChars(plain)
    };
  }

  function getCurrentDocument() {
    return state.documents.find((documentItem) => documentItem.id === state.currentDocId) || null;
  }

  function getCurrentNote() {
    return state.notes.find((note) => note.id === state.currentNoteId) || null;
  }

  function renderAllTime() {
    allTimeWordsTypedEl.textContent = state.allTime.wordsTyped.toLocaleString('ru-RU');
    allTimeDocsCreatedEl.textContent = state.allTime.docsCreated.toLocaleString('ru-RU');
    allTimeTasksDoneEl.textContent = state.allTime.tasksDone.toLocaleString('ru-RU');
  }

  function updateProjectMetrics() {
    const docsStats = getDocumentsTextStats();
    const active = state.projects.filter((project) => project.status === 'active').length;
    const completed = state.projects.filter((project) => project.status === 'completed').length;

    totalWordsEl.textContent = docsStats.words.toLocaleString('ru-RU');
    totalCharsEl.textContent = docsStats.chars.toLocaleString('ru-RU');
    activeProjectsEl.textContent = active;
    completedProjectsEl.textContent = completed;
  }

  function renderProjects() {
    updateProjectMetrics();
    projectsListEl.innerHTML = '';

    state.projects.forEach((project) => {
      const li = document.createElement('li');
      const projectMain = document.createElement('div');
      projectMain.className = 'project-main';
      const statusLabel = project.status === 'active' ? 'Активный' : 'Завершённый';
      projectMain.innerHTML = `<strong>${project.name}</strong><small>${statusLabel}</small>`;

      const actions = document.createElement('div');
      actions.className = 'project-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'action-btn edit';
      editBtn.textContent = 'Ред.';
      editBtn.addEventListener('click', () => {
        const name = prompt('Новое название проекта:', project.name);
        if (name === null) return;
        if (!name.trim()) return;
        const status = confirm('Нажмите OK для статуса "Завершённый", Отмена — "Активный".') ? 'completed' : 'active';
        project.name = name.trim();
        project.status = status;
        renderProjects();
        persist();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'action-btn delete';
      deleteBtn.textContent = 'Удал.';
      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Удалить проект "${project.name}"?`)) return;
        state.projects = state.projects.filter((item) => item.id !== project.id);
        renderProjects();
        persist();
      });

      actions.append(editBtn, deleteBtn);
      li.append(projectMain, actions);
      projectsListEl.appendChild(li);
    });
  }

  function updateEditorWordCounters() {
    const plainText = editorInput.innerText || '';
    const words = countWords(plainText);
    const chars = countChars(plainText);
    editorWordCountEl.textContent = words;
    editorCharCountEl.textContent = chars;
    editorWordCountInlineEl.textContent = words;
    editorCharCountInlineEl.textContent = chars;
    const delta = words - lastEditorWordCount;
    if (delta > 0) {
      state.allTime.wordsTyped += delta;
      renderAllTime();
    }
    lastEditorWordCount = words;
    updateProjectMetrics();
  }

  function renderDocuments() {
    docsListEl.innerHTML = '';

    state.documents.forEach((documentItem) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = documentItem.name;

      if (documentItem.id === state.currentDocId) {
        button.classList.add('active');
      }

      button.addEventListener('click', () => {
        state.currentDocId = documentItem.id;
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
    const documentItem = getCurrentDocument();
    if (!documentItem) return;
    documentItem.content = editorInput.innerHTML;
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
      removeBtn.className = 'action-btn delete';
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

  function renderNotes() {
    notesListEl.innerHTML = '';

    state.notes.forEach((note) => {
      const li = document.createElement('li');
      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = note.id === state.currentNoteId ? 'active' : '';
      selectBtn.textContent = note.title;
      selectBtn.addEventListener('click', () => {
        state.currentNoteId = note.id;
        const current = getCurrentNote();
        notesInput.value = current ? current.content : '';
        notesWordCountEl.textContent = countWords(notesInput.value);
        renderNotes();
        persist();
      });

      const actions = document.createElement('div');
      actions.className = 'note-actions';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'action-btn delete';
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', () => {
        if (state.notes.length === 1) return;
        state.notes = state.notes.filter((item) => item.id !== note.id);
        if (state.currentNoteId === note.id) {
          state.currentNoteId = state.notes[0].id;
          notesInput.value = state.notes[0].content;
        }
        notesWordCountEl.textContent = countWords(notesInput.value);
        renderNotes();
        persist();
      });

      actions.appendChild(deleteBtn);
      li.append(selectBtn, actions);
      notesListEl.appendChild(li);
    });
  }

  function addNote() {
    const title = newNoteTitleInput.value.trim() || `Заметка ${state.notes.length + 1}`;
    const note = { id: Date.now(), title, content: '' };
    state.notes.unshift(note);
    state.currentNoteId = note.id;
    newNoteTitleInput.value = '';
    notesInput.value = '';
    notesWordCountEl.textContent = '0';
    renderNotes();
    persist();
  }

  function saveCurrentNote() {
    const note = getCurrentNote();
    if (!note) return;
    note.content = notesInput.value;
    notesWordCountEl.textContent = countWords(note.content);
    persist();
  }

  function buildSpotifyEmbed(url) {
    const normalized = url.trim();
    if (!normalized) return '';
    const match = normalized.match(/spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
    if (!match) return '';
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`;
  }

  function buildYouTubeEmbed(url) {
    const normalized = url.trim();
    if (!normalized) return '';
    const shortMatch = normalized.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

    try {
      const parsed = new URL(normalized);
      if (parsed.hostname.includes('youtube.com')) {
        if (parsed.pathname === '/watch') {
          const id = parsed.searchParams.get('v');
          return id ? `https://www.youtube.com/embed/${id}` : '';
        }
        if (parsed.pathname.startsWith('/embed/')) {
          return normalized;
        }
      }
    } catch {
      return '';
    }

    return '';
  }

  function applyAudioEmbed() {
    const source = audioSourceType.value;
    const url = audioUrlInput.value.trim();
    const embedUrl = source === 'spotify' ? buildSpotifyEmbed(url) : buildYouTubeEmbed(url);

    if (!embedUrl) {
      audioHelp.textContent = 'Не удалось распознать ссылку. Для Spotify: track/album/playlist, для YouTube: watch или youtu.be.';
      audioEmbed.removeAttribute('src');
      return;
    }

    state.audio = { source, url, embedUrl };
    audioEmbed.src = embedUrl;
    audioHelp.textContent = `Подключено: ${source === 'spotify' ? 'Spotify' : 'YouTube'}`;
    persist();
  }

  function initAudioEmbed() {
    audioSourceType.value = state.audio.source || 'spotify';
    audioUrlInput.value = state.audio.url || '';
    if (state.audio.embedUrl) {
      audioEmbed.src = state.audio.embedUrl;
      audioHelp.textContent = `Подключено: ${state.audio.source === 'spotify' ? 'Spotify' : 'YouTube'}`;
    }
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
    const status = projectStatusSelect.value;

    if (!name) return;

    state.projects.push({ id: Date.now(), name, status });
    projectNameInput.value = '';
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

  addNoteBtn.addEventListener('click', addNote);
  newNoteTitleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addNote();
  });

  notesInput.addEventListener('input', saveCurrentNote);

  applyAudioBtn.addEventListener('click', applyAudioEmbed);

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

  const initialDocument = getCurrentDocument();
  if (initialDocument) {
    currentDocNameEl.textContent = initialDocument.name;
    editorInput.innerHTML = initialDocument.content;
  }

  const initialNote = getCurrentNote();
  if (initialNote) {
    notesInput.value = initialNote.content;
    notesWordCountEl.textContent = countWords(initialNote.content);
  }

  lastEditorWordCount = countWords(editorInput.innerText);

  renderProjects();
  renderDocuments();
  renderTasks();
  renderNotes();
  renderAllTime();
  initAudioEmbed();
  updateTimer();
  updateEditorWordCounters();
  persist();
}

