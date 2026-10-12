const STORAGE_KEY = 'taskforge_tasks';
const THEME_KEY = 'taskforge_theme';
const PAGE_SIZE = 10;
const PRIORITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

const CARD_STATE_STYLES = {
  pending: ['is-pending', 'bg-white', 'border-slate-200', 'dark:bg-slate-900', 'dark:border-slate-800'],
  completed: ['is-completed', 'bg-slate-50', 'border-slate-200', 'opacity-70', 'dark:bg-slate-950', 'dark:border-slate-800'],
  overdue: ['is-pending', 'is-overdue', 'bg-red-50', 'border-red-200', 'dark:bg-red-950', 'dark:border-red-900']
};

const CARD_PRIORITY_STYLES = {
  low: ['priority-low', 'border-l-green-600', 'dark:border-l-green-500'],
  medium: ['priority-medium', 'border-l-blue-600', 'dark:border-l-blue-500'],
  high: ['priority-high', 'border-l-amber-600', 'dark:border-l-amber-500'],
  critical: ['priority-critical', 'border-l-red-600', 'dark:border-l-red-500']
};

const BADGE_PRIORITY_STYLES = {
  low: ['priority-low', 'bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-200'],
  medium: ['priority-medium', 'bg-blue-100', 'text-blue-800', 'dark:bg-blue-900', 'dark:text-blue-200'],
  high: ['priority-high', 'bg-amber-100', 'text-amber-800', 'dark:bg-amber-900', 'dark:text-amber-200'],
  critical: ['priority-critical', 'bg-red-100', 'text-red-800', 'dark:bg-red-900', 'dark:text-red-200']
};

const BADGE_STATUS_STYLES = {
  pending: ['status-pending', 'bg-slate-200', 'text-slate-700', 'dark:bg-slate-700', 'dark:text-slate-100'],
  completed: ['status-completed', 'bg-emerald-100', 'text-emerald-800', 'dark:bg-emerald-900', 'dark:text-emerald-200'],
  overdue: ['status-overdue', 'bg-red-600', 'text-white']
};

const SELECTED_STYLES = ['is-selected', 'ring-2', 'ring-orange-600'];
const DRAGGING_STYLES = ['dragging', 'opacity-40'];
const INVALID_STYLES = ['field-invalid', 'border-red-500', 'ring-1', 'ring-red-500'];

const PAGE_BUTTON = 'inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-semibold leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:opacity-45';
const PAGE_BUTTON_NORMAL = PAGE_BUTTON + ' border-slate-300 bg-white text-slate-700 enabled:hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:enabled:hover:bg-slate-800';
const PAGE_BUTTON_CURRENT = PAGE_BUTTON + ' border-transparent bg-orange-700 text-white';

let tasks = [];
let selectedIds = [];
let currentPage = 1;
let editingId = null;
let formSnapshot = null;
let pendingConfirm = null;
let lastDeleted = [];
let searchTimer = null;
let draggedCard = null;

const filters = {
  search: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  sort: 'newest'
};

const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');
const addTaskButton = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const pagination = document.getElementById('pagination');
const selectAll = document.getElementById('select-all');
const selectedCount = document.getElementById('selected-count');
const bulkComplete = document.getElementById('bulk-complete');
const bulkPending = document.getElementById('bulk-pending');
const bulkDelete = document.getElementById('bulk-delete');
const clearFiltersButton = document.getElementById('clear-filters');
const exportButton = document.getElementById('export-btn');
const importButton = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');
const formModal = document.getElementById('form-modal');
const formHeading = document.getElementById('form-heading');
const formSubmit = document.getElementById('form-submit');
const taskForm = document.getElementById('task-form');
const detailsModal = document.getElementById('details-modal');
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const toastContainer = document.getElementById('toast-container');
const cardTemplate = document.getElementById('task-template');

function pad(number) {
  if (number < 10) {
    return '0' + number;
  }
  return '' + number;
}

function toDateString(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function todayString() {
  return toDateString(new Date());
}

function dueDateInDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

function createdDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatDueDate(dateString) {
  const parts = dateString.split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCreatedDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generateId() {
  return 'task-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

function isOverdue(task) {
  return !task.completed && task.dueDate < todayString();
}

function getStatus(task) {
  if (task.completed) {
    return 'completed';
  }
  if (isOverdue(task)) {
    return 'overdue';
  }
  return 'pending';
}

function makeSample(title, description, category, priority, dueInDays, createdAgo, completed) {
  return {
    id: generateId(),
    title: title,
    description: description,
    category: category,
    priority: priority,
    dueDate: dueDateInDays(dueInDays),
    createdAt: createdDaysAgo(createdAgo),
    completed: completed
  };
}

function buildSampleTasks() {
  return [
    makeSample('Design landing page hero', 'Sketch the hero section and pick the colors and fonts for the landing page.', 'Frontend', 'high', 3, 1, false),
    makeSample('Fix login API bug', 'Users get a 500 error when the token expires. Find the cause and patch it.', 'Backend', 'critical', -2, 2, false),
    makeSample('Submit JavaScript assignment', 'Finish the DOM manipulation project and push it to GitHub before the deadline.', 'School', 'high', 1, 3, false),
    makeSample('Reconcile payment webhook logs', 'Compare webhook logs with the ledger and flag any missing transactions.', 'Fintech', 'critical', 5, 4, false),
    makeSample('Buy groceries', 'Rice, tomatoes, onions, eggs and some fruit for the week.', 'Personal', 'low', 2, 5, false),
    makeSample('Prepare sprint demo slides', 'Summarize what the team shipped this sprint with two or three screenshots.', 'Work', 'medium', 7, 6, false),
    makeSample('Write unit tests for cart', 'Cover add, remove and total calculation for the shopping cart module.', 'Frontend', 'medium', -5, 7, true),
    makeSample('Set up database backups', 'Schedule a nightly backup and test restoring it on a staging server.', 'Backend', 'high', -1, 8, false),
    makeSample('Read chapter on closures', 'Read the closures chapter and write down three examples in my own words.', 'School', 'low', 10, 9, true),
    makeSample('Integrate payment gateway sandbox', 'Connect the sandbox keys and complete one successful test payment.', 'Fintech', 'high', 4, 10, false),
    makeSample('Plan weekend trip', 'Choose a destination, check transport prices and book a place to stay.', 'Personal', 'low', 14, 11, false),
    makeSample('Clean up old repositories', 'Archive unused repositories and update the README of the active ones.', 'Other', 'low', -3, 12, true)
  ];
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    tasks = buildSampleTasks();
    saveTasks();
    return;
  }
  try {
    tasks = JSON.parse(saved);
  } catch (error) {
    tasks = [];
  }
  if (!Array.isArray(tasks)) {
    tasks = [];
  }
}

function findTask(id) {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === id) {
      return tasks[i];
    }
  }
  return null;
}

function isSelected(id) {
  for (let i = 0; i < selectedIds.length; i++) {
    if (selectedIds[i] === id) {
      return true;
    }
  }
  return false;
}

function setSelected(id, shouldSelect) {
  if (shouldSelect && !isSelected(id)) {
    selectedIds.push(id);
  }
  if (!shouldSelect) {
    const remaining = [];
    for (let i = 0; i < selectedIds.length; i++) {
      if (selectedIds[i] !== id) {
        remaining.push(selectedIds[i]);
      }
    }
    selectedIds = remaining;
  }
}

function clearSelection() {
  selectedIds = [];
}

function matchesSearch(task, term) {
  if (term === '') {
    return true;
  }
  if (task.title.toLowerCase().indexOf(term) !== -1) {
    return true;
  }
  if (task.description.toLowerCase().indexOf(term) !== -1) {
    return true;
  }
  if (task.category.toLowerCase().indexOf(term) !== -1) {
    return true;
  }
  return false;
}

function matchesStatus(task, status) {
  if (status === 'all') {
    return true;
  }
  if (status === 'completed') {
    return task.completed;
  }
  if (status === 'pending') {
    return !task.completed;
  }
  if (status === 'overdue') {
    return isOverdue(task);
  }
  return true;
}

function getFilteredTasks() {
  const result = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!matchesSearch(task, filters.search)) {
      continue;
    }
    if (!matchesStatus(task, filters.status)) {
      continue;
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      continue;
    }
    if (filters.category !== 'all' && task.category !== filters.category) {
      continue;
    }
    result.push(task);
  }
  return result;
}

function compareText(a, b) {
  const first = a.toLowerCase();
  const second = b.toLowerCase();
  if (first < second) {
    return -1;
  }
  if (first > second) {
    return 1;
  }
  return 0;
}

function compareTasks(a, b, mode) {
  if (mode === 'newest') {
    return new Date(b.createdAt) - new Date(a.createdAt);
  }
  if (mode === 'oldest') {
    return new Date(a.createdAt) - new Date(b.createdAt);
  }
  if (mode === 'az') {
    return compareText(a.title, b.title);
  }
  if (mode === 'za') {
    return compareText(b.title, a.title);
  }
  if (mode === 'priority-high') {
    return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  }
  if (mode === 'priority-low') {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }
  if (mode === 'due-soon') {
    return compareText(a.dueDate, b.dueDate);
  }
  if (mode === 'due-late') {
    return compareText(b.dueDate, a.dueDate);
  }
  return 0;
}

function sortTasks(list, mode) {
  if (mode === 'custom') {
    return list;
  }
  for (let i = 1; i < list.length; i++) {
    const current = list[i];
    let j = i - 1;
    while (j >= 0 && compareTasks(list[j], current, mode) > 0) {
      list[j + 1] = list[j];
      j--;
    }
    list[j + 1] = current;
  }
  return list;
}

function getVisibleTasks() {
  return sortTasks(getFilteredTasks(), filters.sort);
}

function addClasses(element, names) {
  for (let i = 0; i < names.length; i++) {
    element.classList.add(names[i]);
  }
}

function removeClasses(element, names) {
  for (let i = 0; i < names.length; i++) {
    element.classList.remove(names[i]);
  }
}

function removeGroup(element, group) {
  for (const key in group) {
    removeClasses(element, group[key]);
  }
}

function setClasses(element, names, isOn) {
  if (isOn) {
    addClasses(element, names);
  } else {
    removeClasses(element, names);
  }
}

function applyStateClasses(card, task) {
  const status = getStatus(task);

  removeGroup(card, CARD_STATE_STYLES);
  removeGroup(card, CARD_PRIORITY_STYLES);
  addClasses(card, CARD_STATE_STYLES[status]);
  addClasses(card, CARD_PRIORITY_STYLES[task.priority]);
  setClasses(card, SELECTED_STYLES, isSelected(task.id));
  card.querySelector('.task-title').classList.toggle('line-through', task.completed);
}

function applyBadgeClasses(statusBadge, priorityBadge, task) {
  const status = getStatus(task);

  removeGroup(statusBadge, BADGE_STATUS_STYLES);
  removeGroup(priorityBadge, BADGE_PRIORITY_STYLES);
  addClasses(statusBadge, BADGE_STATUS_STYLES[status]);
  addClasses(priorityBadge, BADGE_PRIORITY_STYLES[task.priority]);
  statusBadge.textContent = capitalize(status);
  priorityBadge.textContent = capitalize(task.priority);
}

function buildCard(task) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const row = card.firstElementChild;
  const checkbox = row.firstElementChild;
  const body = checkbox.nextElementSibling;
  const actions = row.lastElementChild;
  const completeButton = actions.firstElementChild;

  card.dataset.id = task.id;
  card.dataset.status = getStatus(task);
  card.dataset.priority = task.priority;
  card.dataset.category = task.category;
  card.dataset.due = task.dueDate;

  checkbox.checked = isSelected(task.id);
  checkbox.setAttribute('aria-label', 'Select ' + task.title);

  body.querySelector('.task-title').textContent = task.title;
  body.querySelector('.task-description').textContent = task.description;
  body.querySelector('.task-category').textContent = task.category;
  body.querySelector('.task-due').textContent = formatDueDate(task.dueDate);
  body.querySelector('.task-created').textContent = formatCreatedDate(task.createdAt);
  applyBadgeClasses(body.querySelector('.task-status'), body.querySelector('.task-priority'), task);

  if (task.completed) {
    completeButton.textContent = 'Mark pending';
  } else {
    completeButton.textContent = 'Complete';
  }

  applyStateClasses(card, task);
  return card;
}

function renderStats() {
  let completed = 0;
  let pending = 0;
  let overdue = 0;

  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].completed) {
      completed++;
    } else {
      pending++;
      if (isOverdue(tasks[i])) {
        overdue++;
      }
    }
  }

  const values = { total: tasks.length, completed: completed, pending: pending, overdue: overdue };
  const cards = document.querySelectorAll('.stat-card');

  for (let j = 0; j < cards.length; j++) {
    const key = cards[j].dataset.stat;
    cards[j].lastElementChild.textContent = values[key];
  }
}

function updateEmptyState(visibleCount) {
  const oldState = document.getElementById('empty-state');
  const freshState = document.createElement('div');
  freshState.id = 'empty-state';

  if (visibleCount > 0) {
    freshState.className = 'hidden';
  } else if (tasks.length === 0) {
    freshState.className = 'mt-4 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700';
    freshState.innerHTML = '<h2 class="font-display text-lg font-bold">No tasks yet</h2>' +
      '<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Press N or choose Add Task to create your first task.</p>';
  } else {
    freshState.className = 'mt-4 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700';
    freshState.innerHTML = '<h2 class="font-display text-lg font-bold">No tasks found</h2>' +
      '<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Nothing matches your search or filters. Try different words or choose Clear filters.</p>';
  }

  oldState.replaceWith(freshState);
}

function renderList(visible) {
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, visible.length);
  const fragment = document.createDocumentFragment();

  for (let i = start; i < end; i++) {
    fragment.append(buildCard(visible[i]));
  }

  taskList.innerHTML = '';
  taskList.appendChild(fragment);
  updateEmptyState(visible.length);
}

function renderPagination(count, totalPages) {
  pagination.innerHTML = '';

  if (count <= PAGE_SIZE) {
    pagination.classList.add('hidden');
    pagination.classList.remove('flex');
    return;
  }

  pagination.classList.remove('hidden');
  pagination.classList.add('flex');

  const previousDisabled = currentPage === 1 ? ' disabled' : '';
  const nextDisabled = currentPage === totalPages ? ' disabled' : '';

  pagination.insertAdjacentHTML('beforeend', '<button type="button" class="' + PAGE_BUTTON_NORMAL + '" data-page="prev"' + previousDisabled + '>Previous</button>');

  for (let page = 1; page <= totalPages; page++) {
    let buttonClass = PAGE_BUTTON_NORMAL;
    let current = '';
    if (page === currentPage) {
      buttonClass = PAGE_BUTTON_CURRENT;
      current = ' aria-current="page"';
    }
    pagination.insertAdjacentHTML('beforeend', '<button type="button" class="' + buttonClass + '" data-page="' + page + '"' + current + '>' + page + '</button>');
  }

  pagination.insertAdjacentHTML('beforeend', '<button type="button" class="' + PAGE_BUTTON_NORMAL + '" data-page="next"' + nextDisabled + '>Next</button>');
}

function renderBulkBar(visible) {
  let selectedVisible = 0;
  for (let i = 0; i < visible.length; i++) {
    if (isSelected(visible[i].id)) {
      selectedVisible++;
    }
  }

  selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
  selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  selectAll.disabled = visible.length === 0;
  selectedCount.textContent = selectedIds.length + ' selected';

  const noneSelected = selectedIds.length === 0;
  bulkComplete.disabled = noneSelected;
  bulkPending.disabled = noneSelected;
  bulkDelete.disabled = noneSelected;
}

function render() {
  const visible = getVisibleTasks();
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  renderStats();
  renderList(visible);
  renderPagination(visible.length, totalPages);
  renderBulkBar(visible);
}

function showToast(message, withUndo) {
  if (withUndo) {
    const oldUndoButtons = toastContainer.querySelectorAll('[data-action="undo"]');
    for (let i = 0; i < oldUndoButtons.length; i++) {
      oldUndoButtons[i].closest('.toast').remove();
    }
  }

  const toast = document.createElement('div');
  toast.className = 'toast flex items-center gap-4 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900';

  const text = document.createElement('span');
  text.textContent = message;
  toast.append(text);

  if (withUndo) {
    const undoButton = document.createElement('button');
    undoButton.type = 'button';
    undoButton.dataset.action = 'undo';
    undoButton.className = 'font-bold text-orange-300 underline dark:text-orange-700';
    undoButton.textContent = 'Undo';
    toast.append(undoButton);
  }

  toastContainer.prepend(toast);

  let duration = 3500;
  if (withUndo) {
    duration = 8000;
  }

  setTimeout(function () {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, duration);
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.setAttribute('aria-hidden', 'true');
}

function isModalOpen(modal) {
  return !modal.classList.contains('hidden');
}

function showConfirm(title, message, confirmLabel, callback) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOk.textContent = confirmLabel;
  pendingConfirm = callback;
  openModal(confirmModal);
  confirmCancel.focus();
}

function closeConfirm() {
  pendingConfirm = null;
  closeModal(confirmModal);
}

function readForm() {
  const data = new FormData(taskForm);
  return {
    title: String(data.get('title')).trim(),
    description: String(data.get('description')).trim(),
    category: String(data.get('category')),
    priority: String(data.get('priority')),
    dueDate: String(data.get('dueDate'))
  };
}

function validateForm(values) {
  const errors = {};

  if (values.title === '') {
    errors.title = 'Title is required.';
  } else if (values.title.length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  }

  if (values.description === '') {
    errors.description = 'Description is required.';
  } else if (values.description.length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  }

  if (values.category === '') {
    errors.category = 'Please choose a category.';
  }

  if (values.priority === '') {
    errors.priority = 'Please choose a priority.';
  }

  if (values.dueDate === '') {
    errors.dueDate = 'Please choose a due date.';
  }

  return errors;
}

function hasErrors(errors) {
  for (const key in errors) {
    return true;
  }
  return false;
}

function showErrors(errors) {
  const messages = taskForm.querySelectorAll('[data-error-for]');

  for (let i = 0; i < messages.length; i++) {
    const messageElement = messages[i];
    const fieldName = messageElement.dataset.errorFor;
    const input = messageElement.parentElement.querySelector('[name="' + fieldName + '"]');

    if (errors[fieldName]) {
      messageElement.textContent = errors[fieldName];
      messageElement.classList.remove('hidden');
      addClasses(input, INVALID_STYLES);
      input.setAttribute('aria-invalid', 'true');
    } else {
      messageElement.textContent = '';
      messageElement.classList.add('hidden');
      removeClasses(input, INVALID_STYLES);
      input.removeAttribute('aria-invalid');
    }
  }
}

function resetForm() {
  taskForm.reset();
  showErrors({});
}

function setFormMode(isEditing) {
  if (isEditing) {
    formHeading.textContent = 'Edit task';
    formSubmit.textContent = 'Save changes';
  } else {
    formHeading.textContent = 'Add task';
    formSubmit.textContent = 'Add task';
  }
}

function openAddForm() {
  editingId = null;
  formSnapshot = null;
  taskForm.removeAttribute('data-editing-id');
  resetForm();
  setFormMode(false);
  openModal(formModal);
  taskForm.elements['title'].focus();
}

function openEditForm(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }

  editingId = id;
  taskForm.setAttribute('data-editing-id', id);
  resetForm();
  taskForm.elements['title'].value = task.title;
  taskForm.elements['description'].value = task.description;
  taskForm.elements['category'].value = task.category;
  taskForm.elements['priority'].value = task.priority;
  taskForm.elements['dueDate'].value = task.dueDate;
  formSnapshot = readForm();
  setFormMode(true);
  openModal(formModal);
  taskForm.elements['title'].focus();
}

function closeForm() {
  closeModal(formModal);
  resetForm();
  editingId = null;
  formSnapshot = null;
  taskForm.removeAttribute('data-editing-id');
}

function hasUnsavedChanges() {
  if (!editingId || !formSnapshot) {
    return false;
  }
  const current = readForm();
  for (const key in formSnapshot) {
    if (formSnapshot[key] !== current[key]) {
      return true;
    }
  }
  return false;
}

function requestCloseForm() {
  if (hasUnsavedChanges()) {
    showConfirm(
      'Discard changes?',
      'You have unsaved changes. If you close now they will be lost.',
      'Discard',
      function () {
        closeForm();
      }
    );
  } else {
    closeForm();
  }
}

function addTask(values) {
  const task = {
    id: generateId(),
    title: values.title,
    description: values.description,
    category: values.category,
    priority: values.priority,
    dueDate: values.dueDate,
    createdAt: new Date().toISOString(),
    completed: false
  };
  tasks.unshift(task);
}

function updateTask(id, values) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  task.title = values.title;
  task.description = values.description;
  task.category = values.category;
  task.priority = values.priority;
  task.dueDate = values.dueDate;
}

function toggleTask(id) {
  const task = findTask(id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    render();
  }
}

function deleteTasks(ids) {
  const remaining = [];
  const removed = [];

  for (let i = 0; i < tasks.length; i++) {
    let shouldDelete = false;
    for (let j = 0; j < ids.length; j++) {
      if (ids[j] === tasks[i].id) {
        shouldDelete = true;
      }
    }
    if (shouldDelete) {
      removed.push({ task: tasks[i], index: i });
    } else {
      remaining.push(tasks[i]);
    }
  }

  tasks = remaining;
  lastDeleted = removed;

  for (let k = 0; k < removed.length; k++) {
    setSelected(removed[k].task.id, false);
  }

  saveTasks();
  render();
}

function restoreDeleted() {
  if (lastDeleted.length === 0) {
    return;
  }
  for (let i = 0; i < lastDeleted.length; i++) {
    tasks.splice(lastDeleted[i].index, 0, lastDeleted[i].task);
  }
  const count = lastDeleted.length;
  lastDeleted = [];
  saveTasks();
  render();
  if (count === 1) {
    showToast('Task restored', false);
  } else {
    showToast(count + ' tasks restored', false);
  }
}

function requestDelete(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  showConfirm(
    'Delete this task?',
    '"' + task.title + '" will be removed from your list.',
    'Delete',
    function () {
      closeModal(detailsModal);
      deleteTasks([id]);
      showToast('Task deleted', true);
    }
  );
}

function requestBulkDelete() {
  const ids = selectedIds.slice();
  if (ids.length === 0) {
    return;
  }
  let label = ids.length + ' selected tasks';
  if (ids.length === 1) {
    label = '1 selected task';
  }
  showConfirm(
    'Delete ' + label + '?',
    'These tasks will be removed from your list.',
    'Delete',
    function () {
      deleteTasks(ids);
      showToast(label + ' deleted', true);
    }
  );
}

function setSelectedCompleted(isCompleted) {
  if (selectedIds.length === 0) {
    return;
  }
  const count = selectedIds.length;
  for (let i = 0; i < tasks.length; i++) {
    if (isSelected(tasks[i].id)) {
      tasks[i].completed = isCompleted;
    }
  }
  clearSelection();
  saveTasks();
  render();
  if (isCompleted) {
    showToast(count + ' marked as completed', false);
  } else {
    showToast(count + ' marked as pending', false);
  }
}

function openDetails(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }

  detailsModal.dataset.id = id;
  document.getElementById('detail-title').textContent = task.title;
  document.getElementById('detail-description').textContent = task.description;
  document.getElementById('detail-category').textContent = task.category;
  document.getElementById('detail-due').textContent = formatDueDate(task.dueDate);
  document.getElementById('detail-created').textContent = formatCreatedDate(task.createdAt);
  applyBadgeClasses(document.getElementById('detail-status'), document.getElementById('detail-priority'), task);
  openModal(detailsModal);
}

function applyNewOrder(pageIds) {
  const visible = getVisibleTasks();
  const start = (currentPage - 1) * PAGE_SIZE;
  const newOrder = [];

  for (let i = 0; i < start; i++) {
    newOrder.push(visible[i]);
  }
  for (let j = 0; j < pageIds.length; j++) {
    newOrder.push(findTask(pageIds[j]));
  }
  for (let k = start + pageIds.length; k < visible.length; k++) {
    newOrder.push(visible[k]);
  }

  const slots = [];
  for (let m = 0; m < tasks.length; m++) {
    for (let n = 0; n < visible.length; n++) {
      if (visible[n].id === tasks[m].id) {
        slots.push(m);
      }
    }
  }
  for (let p = 0; p < slots.length; p++) {
    tasks[slots[p]] = newOrder[p];
  }

  filters.sort = 'custom';
  document.getElementById('sort-select').value = 'custom';
  saveTasks();
  render();
  showToast('Custom order saved', false);
}

function exportTasks() {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'taskforge-tasks-' + todayString() + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Tasks exported', false);
}

function isValidImportedTask(item) {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  if (typeof item.title !== 'string' || typeof item.description !== 'string') {
    return false;
  }
  if (typeof item.category !== 'string' || !PRIORITY_RANK[item.priority]) {
    return false;
  }
  if (typeof item.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
    return false;
  }
  if (typeof item.createdAt !== 'string' || isNaN(new Date(item.createdAt).getTime())) {
    return false;
  }
  if (typeof item.completed !== 'boolean') {
    return false;
  }
  return true;
}

function importFromText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    showToast('Import failed: the file is not valid JSON', false);
    return;
  }
  if (!Array.isArray(data)) {
    showToast('Import failed: expected a list of tasks', false);
    return;
  }

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!isValidImportedTask(item)) {
      skipped++;
      continue;
    }
    if (typeof item.id === 'string' && findTask(item.id)) {
      skipped++;
      continue;
    }
    if (typeof item.id !== 'string') {
      item.id = generateId();
    }
    tasks.push({
      id: item.id,
      title: item.title,
      description: item.description,
      category: item.category,
      priority: item.priority,
      dueDate: item.dueDate,
      createdAt: item.createdAt,
      completed: item.completed
    });
    added++;
  }

  saveTasks();
  render();
  showToast('Imported ' + added + ' tasks, skipped ' + skipped, false);
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  themeToggle.setAttribute('aria-pressed', isDark);
  if (isDark) {
    themeToggle.textContent = 'Light mode';
  } else {
    themeToggle.textContent = 'Dark mode';
  }
}

function handleClose(modalId) {
  if (modalId === 'form-modal') {
    requestCloseForm();
  } else if (modalId === 'details-modal') {
    closeModal(detailsModal);
  } else if (modalId === 'confirm-modal') {
    closeConfirm();
  }
}

function closeTopModal() {
  if (isModalOpen(confirmModal)) {
    closeConfirm();
  } else if (isModalOpen(detailsModal)) {
    closeModal(detailsModal);
  } else if (isModalOpen(formModal)) {
    requestCloseForm();
  }
}

function anyModalOpen() {
  return isModalOpen(formModal) || isModalOpen(detailsModal) || isModalOpen(confirmModal);
}

function isTypingTarget(element) {
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

addTaskButton.addEventListener('click', openAddForm);

themeToggle.addEventListener('click', function () {
  let next = 'dark';
  if (document.documentElement.classList.contains('dark')) {
    next = 'light';
  }
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

searchInput.addEventListener('input', function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function () {
    filters.search = searchInput.value.trim().toLowerCase();
    currentPage = 1;
    clearSelection();
    render();
  }, 300);
});

const filterControls = document.querySelectorAll('[data-filter]');
for (let i = 0; i < filterControls.length; i++) {
  filterControls[i].addEventListener('change', function (event) {
    const control = event.currentTarget;
    filters[control.dataset.filter] = control.value;
    currentPage = 1;
    clearSelection();
    render();
  });
}

clearFiltersButton.addEventListener('click', function () {
  filters.search = '';
  filters.status = 'all';
  filters.priority = 'all';
  filters.category = 'all';
  filters.sort = 'newest';
  searchInput.value = '';
  for (let i = 0; i < filterControls.length; i++) {
    const name = filterControls[i].dataset.filter;
    filterControls[i].value = filters[name];
  }
  currentPage = 1;
  clearSelection();
  render();
});

taskList.addEventListener('click', function (event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }
  const card = trigger.closest('.task-card');
  if (!card) {
    return;
  }

  const id = card.dataset.id;
  const action = trigger.dataset.action;

  if (action === 'toggle') {
    toggleTask(id);
  } else if (action === 'edit') {
    openEditForm(id);
  } else if (action === 'delete') {
    requestDelete(id);
  } else if (action === 'details') {
    openDetails(id);
  }
});

taskList.addEventListener('keydown', function (event) {
  if (event.key === 'Enter' && event.target.classList.contains('task-body')) {
    openDetails(event.target.closest('.task-card').dataset.id);
  }
});

taskList.addEventListener('change', function (event) {
  if (!event.target.classList.contains('task-checkbox')) {
    return;
  }
  const card = event.target.closest('.task-card');
  setSelected(card.dataset.id, event.target.checked);
  setClasses(card, SELECTED_STYLES, event.target.checked);
  renderBulkBar(getVisibleTasks());
});

taskList.addEventListener('dragstart', function (event) {
  const card = event.target.closest('.task-card');
  if (!card) {
    return;
  }
  draggedCard = card;
  addClasses(card, DRAGGING_STYLES);
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', card.dataset.id);
});

taskList.addEventListener('dragover', function (event) {
  if (!draggedCard) {
    return;
  }
  event.preventDefault();
  const over = event.target.closest('.task-card');
  if (!over || over === draggedCard) {
    return;
  }
  const box = over.getBoundingClientRect();
  const middle = box.top + box.height / 2;
  if (event.clientY < middle) {
    if (over.previousElementSibling !== draggedCard) {
      taskList.insertBefore(draggedCard, over);
    }
  } else {
    if (over.nextElementSibling !== draggedCard) {
      taskList.insertBefore(draggedCard, over.nextElementSibling);
    }
  }
});

taskList.addEventListener('dragend', function () {
  if (!draggedCard) {
    return;
  }
  removeClasses(draggedCard, DRAGGING_STYLES);
  draggedCard = null;

  const visible = getVisibleTasks();
  const start = (currentPage - 1) * PAGE_SIZE;
  const newIds = [];
  let changed = false;

  for (let i = 0; i < taskList.children.length; i++) {
    const id = taskList.children[i].dataset.id;
    newIds.push(id);
    if (visible[start + i].id !== id) {
      changed = true;
    }
  }

  if (changed) {
    applyNewOrder(newIds);
  }
});

pagination.addEventListener('click', function (event) {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) {
    return;
  }
  const value = button.dataset.page;
  if (value === 'prev') {
    currentPage--;
  } else if (value === 'next') {
    currentPage++;
  } else {
    currentPage = Number(value);
  }
  render();
  taskList.scrollIntoView({ block: 'start' });
});

selectAll.addEventListener('change', function () {
  const visible = getVisibleTasks();
  for (let i = 0; i < visible.length; i++) {
    setSelected(visible[i].id, selectAll.checked);
  }
  render();
});

bulkComplete.addEventListener('click', function () {
  setSelectedCompleted(true);
});

bulkPending.addEventListener('click', function () {
  setSelectedCompleted(false);
});

bulkDelete.addEventListener('click', requestBulkDelete);

taskForm.addEventListener('submit', function (event) {
  event.preventDefault();

  const values = readForm();
  const errors = validateForm(values);
  showErrors(errors);

  if (hasErrors(errors)) {
    const firstInvalid = taskForm.querySelector('.field-invalid');
    firstInvalid.focus();
    return;
  }

  const idBeingEdited = taskForm.getAttribute('data-editing-id');

  if (idBeingEdited) {
    updateTask(idBeingEdited, values);
    showToast('Task updated', false);
  } else {
    addTask(values);
    showToast('Task added', false);
  }

  saveTasks();
  closeForm();
  render();
});

taskForm.addEventListener('input', function (event) {
  const field = event.target;
  if (field.classList.contains('field-invalid')) {
    removeClasses(field, INVALID_STYLES);
    field.removeAttribute('aria-invalid');
    const message = field.parentElement.querySelector('[data-error-for]');
    message.textContent = '';
    message.classList.add('hidden');
  }
});

detailsModal.addEventListener('click', function (event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }
  const id = detailsModal.dataset.id;
  if (trigger.dataset.action === 'edit-from-details') {
    closeModal(detailsModal);
    openEditForm(id);
  } else if (trigger.dataset.action === 'delete-from-details') {
    requestDelete(id);
  }
});

confirmOk.addEventListener('click', function () {
  const action = pendingConfirm;
  closeConfirm();
  if (action) {
    action();
  }
});

toastContainer.addEventListener('click', function (event) {
  const undoButton = event.target.closest('[data-action="undo"]');
  if (!undoButton) {
    return;
  }
  undoButton.closest('.toast').remove();
  restoreDeleted();
});

document.addEventListener('click', function (event) {
  const closer = event.target.closest('[data-close]');
  if (closer) {
    handleClose(closer.dataset.close);
    return;
  }
  if (event.target.classList.contains('modal')) {
    handleClose(event.target.id);
  }
});

document.addEventListener('keydown', function (event) {
  const key = event.key;

  if (key === 'Escape') {
    closeTopModal();
    return;
  }

  if (key === 'Enter' && (event.ctrlKey || event.metaKey) && isModalOpen(formModal)) {
    event.preventDefault();
    taskForm.requestSubmit();
    return;
  }

  if (isTypingTarget(event.target) || anyModalOpen()) {
    return;
  }

  if (key === '/') {
    event.preventDefault();
    searchInput.focus();
  }

  if ((key === 'n' || key === 'N') && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    openAddForm();
  }
});

exportButton.addEventListener('click', exportTasks);

importButton.addEventListener('click', function () {
  importInput.click();
});

importInput.addEventListener('change', function () {
  const file = importInput.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    importFromText(reader.result);
    importInput.value = '';
  };
  reader.readAsText(file);
});

function init() {
  let savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme !== 'dark') {
    savedTheme = 'light';
  }
  applyTheme(savedTheme);
  loadTasks();
  render();
}

init();