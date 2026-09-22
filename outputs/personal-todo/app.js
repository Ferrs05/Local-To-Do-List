const STORAGE_KEY = "personalWorkplaceTodos.v1";
const LOGBOOK_STORAGE_KEY = "personalWorkplaceLogbook.v1";
const REMINDER_SERVICE_URL = "http://127.0.0.1:8765/api/tasks";
const ATTACHMENT_DB_NAME = "personalWorkplaceTodoMedia";
const ATTACHMENT_STORE_NAME = "attachments";

const state = {
  tasks: [],
  logs: [],
  logColumns: [],
  filter: "all",
  search: "",
  sort: "deadline",
  logSearch: "",
  draftSubtasks: [],
  attachmentDrafts: [],
  activePage: "todo",
  draggedLogId: ""
};

const els = {
  taskForm: document.querySelector("#taskForm"),
  taskId: document.querySelector("#taskId"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  titleInput: document.querySelector("#titleInput"),
  notesInput: document.querySelector("#notesInput"),
  startDateInput: document.querySelector("#startDateInput"),
  startTimeInput: document.querySelector("#startTimeInput"),
  deadlineDateInput: document.querySelector("#deadlineDateInput"),
  deadlineTimeInput: document.querySelector("#deadlineTimeInput"),
  reminderAmountInput: document.querySelector("#reminderAmountInput"),
  reminderUnitInput: document.querySelector("#reminderUnitInput"),
  priorityInput: document.querySelector("#priorityInput"),
  categoryInput: document.querySelector("#categoryInput"),
  tagsInput: document.querySelector("#tagsInput"),
  subtaskInput: document.querySelector("#subtaskInput"),
  addSubtaskBtn: document.querySelector("#addSubtaskBtn"),
  subtaskDraftList: document.querySelector("#subtaskDraftList"),
  subtaskCount: document.querySelector("#subtaskCount"),
  attachmentInput: document.querySelector("#attachmentInput"),
  attachmentDraftList: document.querySelector("#attachmentDraftList"),
  attachmentCount: document.querySelector("#attachmentCount"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  todoPage: document.querySelector("#todoPage"),
  notebookPage: document.querySelector("#notebookPage"),
  appNavButtons: document.querySelectorAll("[data-page]"),
  addLogRowBtn: document.querySelector("#addLogRowBtn"),
  deleteLogRowsBtn: document.querySelector("#deleteLogRowsBtn"),
  addLogColumnBtn: document.querySelector("#addLogColumnBtn"),
  removeLogColumnBtn: document.querySelector("#removeLogColumnBtn"),
  exportLogJsonBtn: document.querySelector("#exportLogJsonBtn"),
  importLogInput: document.querySelector("#importLogInput"),
  exportLogExcelBtn: document.querySelector("#exportLogExcelBtn"),
  logSearchInput: document.querySelector("#logSearchInput"),
  logTableHead: document.querySelector("#logTableHead"),
  logTableBody: document.querySelector("#logTableBody"),
  logEmptyState: document.querySelector("#logEmptyState"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  filterTabs: document.querySelector(".filter-tabs"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  clearCompletedBtn: document.querySelector("#clearCompletedBtn"),
  toast: document.querySelector("#toast"),
  statTotal: document.querySelector("#statTotal"),
  statOverdue: document.querySelector("#statOverdue"),
  statToday: document.querySelector("#statToday"),
  statDone: document.querySelector("#statDone"),
  reminderServiceStatus: document.querySelector("#reminderServiceStatus"),
  reminderServiceText: document.querySelector("#reminderServiceText"),
  scheduleButtons: document.querySelectorAll("[data-schedule][data-preset]")
};

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayString() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function localDateTimeString(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function normalizeDateTime(value, fallbackTime = "00:00") {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T${fallbackTime}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  return "";
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function splitDateTime(value) {
  const normalized = normalizeDateTime(value);
  if (!normalized) return { date: "", time: "" };
  return {
    date: normalized.slice(0, 10),
    time: normalized.slice(11, 16)
  };
}

function combineDateTime(dateValue, timeValue, fallbackTime) {
  const date = String(dateValue || "").trim();
  const time = String(timeValue || "").trim();
  if (!date && !time) return "";
  const finalDate = date || todayString();
  const finalTime = time || fallbackTime;
  return normalizeDateTime(`${finalDate}T${finalTime}`, fallbackTime);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function mediaTypeFromMime(mime) {
  if (String(mime).startsWith("image/")) return "image";
  if (String(mime).startsWith("video/")) return "video";
  if (String(mime).startsWith("audio/")) return "audio";
  return "file";
}

function formatFileSize(size) {
  const bytes = Number(size) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function normalizeAttachment(item) {
  return {
    id: typeof item.id === "string" && item.id ? item.id : uid(),
    name: String(item.name ?? "Media").trim().slice(0, 180),
    type: ["image", "video", "audio", "file"].includes(item.type) ? item.type : mediaTypeFromMime(item.mime),
    mime: String(item.mime ?? item.type ?? "application/octet-stream").slice(0, 120),
    size: Number(item.size) || 0,
    createdAt: item.createdAt || new Date().toISOString()
  };
}

function reminderToMinutes(amountValue, unitValue) {
  const amount = Number.parseInt(amountValue, 10);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const clamped = Math.min(amount, 10080);
  if (unitValue === "days") return clamped * 1440;
  if (unitValue === "hours") return clamped * 60;
  return clamped;
}

function splitReminder(minutesValue) {
  const minutes = Number.parseInt(minutesValue, 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return { amount: "", unit: "minutes" };
  if (minutes % 1440 === 0) return { amount: String(minutes / 1440), unit: "days" };
  if (minutes % 60 === 0) return { amount: String(minutes / 60), unit: "hours" };
  return { amount: String(minutes), unit: "minutes" };
}

function reminderLabel(minutesValue) {
  const reminder = splitReminder(minutesValue);
  if (!reminder.amount) return "Tanpa reminder";
  const unit = { minutes: "menit", hours: "jam", days: "hari" }[reminder.unit];
  return `Reminder ${reminder.amount} ${unit} sebelumnya`;
}

function logStatusLabel(value) {
  return {
    progress: "Progress",
    blocked: "Blocked",
    done: "Selesai",
    note: "Catatan"
  }[value] || "Progress";
}

function normalizeTask(task) {
  const done = Boolean(task.done);
  const now = new Date().toISOString();
  return {
    id: typeof task.id === "string" && task.id ? task.id : uid(),
    title: String(task.title ?? "").trim().slice(0, 120),
    notes: String(task.notes ?? "").trim().slice(0, 700),
    startAt: normalizeDateTime(task.startAt, "09:00"),
    deadline: normalizeDateTime(task.deadline, "23:59"),
    remindBeforeMinutes: reminderToMinutes(task.remindBeforeMinutes ?? task.reminderMinutes ?? 0, "minutes"),
    attachments: Array.isArray(task.attachments) ? task.attachments.map(normalizeAttachment) : [],
    priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
    status: done ? "completed" : "active",
    done,
    createdAt: task.createdAt || now,
    updatedAt: task.updatedAt || now,
    category: String(task.category ?? "").trim().slice(0, 40),
    tags: Array.isArray(task.tags) ? task.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 12) : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : uid(),
          title: String(item.title ?? "").trim().slice(0, 100),
          done: Boolean(item.done)
        })).filter((item) => item.title)
      : []
  };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.tasks = raw ? JSON.parse(raw).map(normalizeTask).filter((task) => task.title) : [];
  } catch {
    state.tasks = [];
    showToast("Data lokal tidak bisa dibaca. App mulai dari daftar kosong.");
  }
}

function normalizeLogEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : uid(),
    date: String(entry.date || todayString()).slice(0, 10),
    status: ["progress", "blocked", "done", "note"].includes(entry.status) ? entry.status : "progress",
    title: String(entry.title ?? "").trim().slice(0, 120),
    body: String(entry.body ?? "").trim().slice(0, 1600),
    taskId: String(entry.taskId ?? ""),
    custom: entry.custom && typeof entry.custom === "object" ? { ...entry.custom } : {},
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now
  };
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(LOGBOOK_STORAGE_KEY);
    if (!raw) {
      state.logs = [];
      state.logColumns = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.logs = parsed.map(normalizeLogEntry);
      state.logColumns = [];
      saveLogs();
      return;
    }
    state.logs = Array.isArray(parsed.entries) ? parsed.entries.map(normalizeLogEntry) : [];
    state.logColumns = Array.isArray(parsed.columns)
      ? parsed.columns.map((column) => ({
          id: typeof column.id === "string" && column.id ? column.id : uid(),
          title: String(column.title ?? "Kolom").trim().slice(0, 40) || "Kolom"
        }))
      : [];
  } catch {
    state.logs = [];
    state.logColumns = [];
    showToast("Data logbook tidak bisa dibaca. Logbook mulai kosong.");
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  syncTasksToReminderService();
}

function saveLogs() {
  localStorage.setItem(LOGBOOK_STORAGE_KEY, JSON.stringify({
    version: 2,
    columns: state.logColumns,
    entries: state.logs
  }));
}

let attachmentDbPromise;

function openAttachmentDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (attachmentDbPromise) return attachmentDbPromise;
  attachmentDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(ATTACHMENT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE_NAME)) {
        db.createObjectStore(ATTACHMENT_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return attachmentDbPromise;
}

async function saveAttachmentBlob(meta, file) {
  const db = await openAttachmentDb();
  if (!db) throw new Error("IndexedDB tidak tersedia");
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    tx.objectStore(ATTACHMENT_STORE_NAME).put({ ...meta, blob: file });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAttachmentRecord(id) {
  const db = await openAttachmentDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readonly");
    const request = tx.objectStore(ATTACHMENT_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteAttachmentBlob(id) {
  const db = await openAttachmentDb();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    tx.objectStore(ATTACHMENT_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function syncTasksToReminderService() {
  if (!window.fetch) return;
  fetch(REMINDER_SERVICE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: 1,
      syncedAt: new Date().toISOString(),
      tasks: state.tasks
    })
  }).catch(() => {
    // The app still works if the background reminder helper is not running.
  });
}

function updateReminderServiceStatus(status, text) {
  if (!els.reminderServiceStatus || !els.reminderServiceText) return;
  els.reminderServiceStatus.dataset.status = status;
  els.reminderServiceText.textContent = text;
}

function checkReminderService() {
  if (!window.fetch) {
    updateReminderServiceStatus("offline", "Reminder offline");
    return;
  }
  fetch("http://127.0.0.1:8765/api/health", { method: "GET" })
    .then((response) => {
      if (!response.ok) throw new Error("Reminder helper offline");
      updateReminderServiceStatus("online", "Reminder aktif");
    })
    .catch(() => updateReminderServiceStatus("offline", "Reminder offline"));
}

function deadlineState(task) {
  if (!task.deadline || task.done) return "";
  const now = localDateTimeString();
  const today = todayString();
  if (task.deadline < now) return "overdue";
  if (task.deadline.slice(0, 10) === today) return "today";
  return "upcoming";
}

function priorityLabel(value) {
  return {
    high: "Tinggi",
    medium: "Sedang",
    low: "Rendah"
  }[value] || "Sedang";
}

function dateLabel(value) {
  if (!value) return "Tanpa deadline";
  const normalized = normalizeDateTime(value, "23:59");
  const date = new Date(normalized);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function dateOnlyLabel(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function startLabel(value) {
  if (!value) return "Mulai belum diatur";
  return `Mulai ${dateLabel(value)}`;
}

function deadlineLabel(value) {
  if (!value) return "Tanpa deadline";
  return `Deadline ${dateLabel(value)}`;
}

function updateStats() {
  const today = todayString();
  const now = localDateTimeString();
  els.statTotal.textContent = state.tasks.length;
  els.statDone.textContent = state.tasks.filter((task) => task.done).length;
  els.statToday.textContent = state.tasks.filter((task) => !task.done && task.deadline && task.deadline.slice(0, 10) === today).length;
  els.statOverdue.textContent = state.tasks.filter((task) => !task.done && task.deadline && task.deadline < now).length;
}

function matchesFilter(task) {
  const due = deadlineState(task);
  if (state.filter === "completed") return task.done;
  if (state.filter === "today") return due === "today";
  if (state.filter === "upcoming") return !task.done && due === "upcoming";
  if (state.filter === "overdue") return due === "overdue";
  return true;
}

function matchesSearch(task) {
  const q = state.search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    task.title,
    task.notes,
    task.category,
    task.priority,
    ...task.tags,
    ...task.subtasks.map((item) => item.title)
  ].join(" ").toLowerCase();
  return haystack.includes(q);
}

function sortTasks(tasks) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (state.sort === "priority") {
      return priorityRank[a.priority] - priorityRank[b.priority] || compareDeadline(a, b);
    }
    if (state.sort === "created") return b.createdAt.localeCompare(a.createdAt);
    if (state.sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
    return compareDeadline(a, b);
  });
}

function compareDeadline(a, b) {
  const aDate = a.deadline || "9999-12-31T23:59";
  const bDate = b.deadline || "9999-12-31T23:59";
  return aDate.localeCompare(bDate) || a.createdAt.localeCompare(b.createdAt);
}

function renderDraftSubtasks() {
  els.subtaskCount.textContent = `${state.draftSubtasks.length} item`;
  els.subtaskDraftList.innerHTML = state.draftSubtasks.map((item) => `
    <div class="draft-item" data-id="${escapeHtml(item.id)}">
      <span>${escapeHtml(item.title)}</span>
      <button type="button" data-action="remove-draft" aria-label="Hapus checklist">Hapus</button>
    </div>
  `).join("");
}

function renderAttachmentDrafts() {
  els.attachmentCount.textContent = `${state.attachmentDrafts.length} file`;
  els.attachmentDraftList.innerHTML = state.attachmentDrafts.map((item) => `
    <div class="attachment-item" data-id="${escapeHtml(item.id)}">
      <div class="attachment-info">
        <span class="attachment-name">${escapeHtml(item.name)}</span>
        <span class="attachment-meta">${escapeHtml(item.type)} - ${escapeHtml(formatFileSize(item.size))}${item.file ? " - baru" : ""}</span>
      </div>
      <div class="attachment-actions">
        ${item.file ? "" : `<button type="button" data-action="open-draft-attachment">Buka</button>`}
        <button type="button" data-action="remove-draft-attachment">Hapus</button>
      </div>
    </div>
  `).join("");
}

function renderTasks() {
  updateStats();
  renderLogTaskOptions();
  const tasks = sortTasks(state.tasks.filter(matchesFilter).filter(matchesSearch));
  els.emptyState.classList.toggle("hidden", tasks.length > 0);

  els.taskList.innerHTML = tasks.map((task) => {
    const due = deadlineState(task);
    const tags = task.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
    const subtasks = task.subtasks.map((item) => `
      <label class="subtask-row ${item.done ? "done" : ""}">
        <input class="subtask-check" type="checkbox" data-action="toggle-subtask" data-task-id="${escapeHtml(task.id)}" data-subtask-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""}>
        <span>${escapeHtml(item.title)}</span>
      </label>
    `).join("");
    const attachments = task.attachments.map((item) => `
      <div class="attachment-item" data-attachment-id="${escapeHtml(item.id)}">
        <div class="attachment-info">
          <span class="attachment-name">${escapeHtml(item.name)}</span>
          <span class="attachment-meta">${escapeHtml(item.type)} - ${escapeHtml(formatFileSize(item.size))}</span>
        </div>
        <div class="attachment-actions">
          <button type="button" data-action="open-attachment" data-attachment-id="${escapeHtml(item.id)}">Buka</button>
        </div>
      </div>
    `).join("");
    const dueBadge = due ? `<span class="badge ${due}">${due === "overdue" ? "Overdue" : due === "today" ? "Hari ini" : "Upcoming"}</span>` : "";

    return `
      <article class="task-card priority-${escapeHtml(task.priority)} ${task.done ? "completed" : ""}" data-id="${escapeHtml(task.id)}">
        <input class="task-check" type="checkbox" data-action="toggle-task" ${task.done ? "checked" : ""} aria-label="Tandai task selesai">
        <div class="task-content">
          <div class="task-title-row">
            <span class="task-title">${escapeHtml(task.title)}</span>
            ${dueBadge}
          </div>
          ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
          <div class="meta-line">
            <span class="badge">${escapeHtml(priorityLabel(task.priority))}</span>
            <span class="badge">${escapeHtml(startLabel(task.startAt))}</span>
            <span class="badge">${escapeHtml(deadlineLabel(task.deadline))}</span>
            <span class="badge">${escapeHtml(reminderLabel(task.remindBeforeMinutes))}</span>
            ${task.category ? `<span class="badge">${escapeHtml(task.category)}</span>` : ""}
          </div>
          ${tags ? `<div class="tag-line">${tags}</div>` : ""}
          ${subtasks ? `<div class="subtask-list">${subtasks}</div>` : ""}
          ${attachments ? `<div class="attachment-list">${attachments}</div>` : ""}
        </div>
        <div class="task-actions">
          <button class="small-action" type="button" data-action="edit-task" aria-label="Edit task">Edit</button>
          <button class="small-action delete" type="button" data-action="delete-task" aria-label="Hapus task">Hapus</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderLogTaskOptions() {
  return state.tasks.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join("");
}

function renderLogs() {
  const q = state.logSearch.trim().toLowerCase();
  const logs = state.logs.filter((entry) => {
      if (!q) return true;
      const task = state.tasks.find((item) => item.id === entry.taskId);
      return [entry.title, entry.body, entry.status, task?.title || "", ...Object.values(entry.custom || {})].join(" ").toLowerCase().includes(q);
    });

  els.logEmptyState.classList.toggle("hidden", logs.length > 0);
  const taskOptions = renderLogTaskOptions();
  els.logTableHead.innerHTML = `
    <tr>
      <th class="log-row-check-cell"><input id="selectAllLogRows" type="checkbox" aria-label="Pilih semua baris logbook"></th>
      <th class="log-drag-cell" aria-label="Urutkan baris"></th>
      <th class="log-row-number">No</th>
      <th>Tanggal</th>
      <th>Status</th>
      <th>Judul</th>
      <th>Progress / Catatan</th>
      <th>Task terkait</th>
      ${state.logColumns.map((column) => `
        <th>
          <div class="custom-column-head">
            <input class="column-title-input" data-column-id="${escapeHtml(column.id)}" value="${escapeHtml(column.title)}" aria-label="Nama kolom custom">
          </div>
        </th>
      `).join("")}
    </tr>
  `;
  els.logTableBody.innerHTML = logs.map((entry, index) => `
    <tr data-id="${escapeHtml(entry.id)}" draggable="true">
      <td class="log-row-check-cell"><input class="log-row-select" type="checkbox" aria-label="Pilih baris logbook"></td>
      <td class="log-drag-cell"><button class="log-drag-handle" type="button" draggable="true" title="Pindahkan baris" aria-label="Pindahkan baris"><span class="drag-grip" aria-hidden="true"></span></button></td>
      <td class="log-row-number">${index + 1}</td>
      <td><input class="log-cell-input" type="date" data-field="date" value="${escapeHtml(entry.date)}"></td>
      <td>
        <select class="log-cell-select" data-field="status">
          ${["progress", "blocked", "done", "note"].map((status) => `<option value="${status}" ${entry.status === status ? "selected" : ""}>${escapeHtml(logStatusLabel(status))}</option>`).join("")}
        </select>
      </td>
      <td><input class="log-cell-input" data-field="title" maxlength="120" value="${escapeHtml(entry.title)}" placeholder="Judul log"></td>
      <td><textarea class="log-cell-textarea" data-field="body" maxlength="1600" placeholder="Catatan progress">${escapeHtml(entry.body)}</textarea></td>
      <td>
        <select class="log-cell-select" data-field="taskId">
          <option value="">Tidak dikaitkan</option>
          ${taskOptions.replace(`value="${escapeHtml(entry.taskId)}"`, `value="${escapeHtml(entry.taskId)}" selected`)}
        </select>
      </td>
      ${state.logColumns.map((column) => `
        <td><textarea class="log-cell-textarea" data-custom-column="${escapeHtml(column.id)}" maxlength="1200">${escapeHtml(entry.custom?.[column.id] || "")}</textarea></td>
      `).join("")}
    </tr>
  `).join("");
}

function resetForm() {
  els.taskId.value = "";
  els.formTitle.textContent = "Tambah Task";
  els.cancelEditBtn.classList.add("hidden");
  els.taskForm.reset();
  els.priorityInput.value = "medium";
  state.draftSubtasks = [];
  state.attachmentDrafts = [];
  renderDraftSubtasks();
  renderAttachmentDrafts();
}

function fillForm(task) {
  els.taskId.value = task.id;
  els.formTitle.textContent = "Edit Task";
  els.cancelEditBtn.classList.remove("hidden");
  els.titleInput.value = task.title;
  els.notesInput.value = task.notes;
  setScheduleInputs("start", task.startAt);
  setScheduleInputs("deadline", task.deadline);
  setReminderInputs(task.remindBeforeMinutes);
  els.priorityInput.value = task.priority;
  els.categoryInput.value = task.category;
  els.tagsInput.value = task.tags.join(", ");
  state.draftSubtasks = task.subtasks.map((item) => ({ ...item }));
  state.attachmentDrafts = task.attachments.map((item) => ({ ...item, file: null }));
  renderDraftSubtasks();
  renderAttachmentDrafts();
  els.titleInput.focus();
}

async function upsertTask(event) {
  event.preventDefault();
  const title = els.titleInput.value.trim();
  if (!title) return;

  const now = new Date().toISOString();
  const existingId = els.taskId.value;
  const existing = state.tasks.find((task) => task.id === existingId);
  const taskId = existingId || uid();
  const attachments = state.attachmentDrafts.map((item) => normalizeAttachment(item));
  const next = normalizeTask({
    id: taskId,
    title,
    notes: els.notesInput.value,
    startAt: combineDateTime(els.startDateInput.value, els.startTimeInput.value, "09:00"),
    deadline: combineDateTime(els.deadlineDateInput.value, els.deadlineTimeInput.value, "23:59"),
    remindBeforeMinutes: reminderToMinutes(els.reminderAmountInput.value, els.reminderUnitInput.value),
    priority: els.priorityInput.value,
    done: existing ? existing.done : false,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    category: els.categoryInput.value,
    tags: parseTags(els.tagsInput.value),
    subtasks: state.draftSubtasks,
    attachments
  });

  try {
    const currentIds = new Set(attachments.map((item) => item.id));
    const removed = existing ? existing.attachments.filter((item) => !currentIds.has(item.id)) : [];
    await Promise.all(removed.map((item) => deleteAttachmentBlob(item.id)));
    await Promise.all(state.attachmentDrafts.filter((item) => item.file).map((item) => saveAttachmentBlob(normalizeAttachment(item), item.file)));
  } catch {
    showToast("Beberapa media tidak bisa disimpan. Task tetap disimpan.");
  }

  if (existing) {
    state.tasks = state.tasks.map((task) => task.id === existingId ? next : task);
    showToast("Task diperbarui.");
  } else {
    state.tasks.unshift(next);
    showToast("Task ditambahkan.");
  }

  saveTasks();
  resetForm();
  renderTasks();
}

function setReminderInputs(minutesValue) {
  const reminder = splitReminder(minutesValue);
  els.reminderAmountInput.value = reminder.amount;
  els.reminderUnitInput.value = reminder.unit;
}

function setScheduleInputs(kind, value) {
  const parts = splitDateTime(value);
  if (kind === "start") {
    els.startDateInput.value = parts.date;
    els.startTimeInput.value = parts.time;
    return;
  }
  els.deadlineDateInput.value = parts.date;
  els.deadlineTimeInput.value = parts.time;
}

function applySchedulePreset(kind, preset) {
  if (preset === "clear") {
    setScheduleInputs(kind, "");
    return;
  }

  const now = new Date();
  const today = todayString();
  const tomorrow = localDateTimeString(addDays(now, 1)).slice(0, 10);

  const presets = {
    now: { date: today, time: localDateTimeString(now).slice(11, 16) },
    "today-0900": { date: today, time: "09:00" },
    "today-1700": { date: today, time: "17:00" },
    "tomorrow-0900": { date: tomorrow, time: "09:00" },
    "tomorrow-1700": { date: tomorrow, time: "17:00" }
  };

  const value = presets[preset];
  if (!value) return;
  setScheduleInputs(kind, `${value.date}T${value.time}`);
}

function addDraftSubtask() {
  const title = els.subtaskInput.value.trim();
  if (!title) return;
  state.draftSubtasks.push({ id: uid(), title, done: false });
  els.subtaskInput.value = "";
  renderDraftSubtasks();
}

function addAttachmentFiles(files) {
  const accepted = Array.from(files || []).filter((file) => ["image", "video", "audio"].includes(mediaTypeFromMime(file.type)));
  const rejected = (files?.length || 0) - accepted.length;
  accepted.forEach((file) => {
    state.attachmentDrafts.push({
      id: uid(),
      name: file.name,
      type: mediaTypeFromMime(file.type),
      mime: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      file
    });
  });
  if (rejected) showToast(`${rejected} file dilewati. Hanya gambar, video, atau audio yang didukung.`);
  renderAttachmentDrafts();
}

async function openAttachment(id) {
  try {
    const record = await getAttachmentRecord(id);
    if (!record || !record.blob) {
      showToast("Media belum tersedia. Jika task hasil import, file media perlu ditambahkan ulang.");
      return;
    }
    const url = URL.createObjectURL(record.blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    showToast("Media tidak bisa dibuka.");
  }
}

function updateTask(id, updater) {
  state.tasks = state.tasks.map((task) => {
    if (task.id !== id) return task;
    const updated = normalizeTask(updater({ ...task }));
    updated.updatedAt = new Date().toISOString();
    return updated;
  });
  saveTasks();
  renderTasks();
}

async function deleteTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  if (!confirm(`Hapus task "${task.title}"?`)) return;
  await Promise.all(task.attachments.map((item) => deleteAttachmentBlob(item.id)));
  state.tasks = state.tasks.filter((item) => item.id !== id);
  saveTasks();
  renderTasks();
  showToast("Task dihapus.");
}

function handleTaskAction(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  if (action === "open-attachment") {
    openAttachment(event.target.dataset.attachmentId);
    return;
  }

  if (action === "toggle-subtask") {
    const taskId = event.target.dataset.taskId;
    const subtaskId = event.target.dataset.subtaskId;
    updateTask(taskId, (task) => ({
      ...task,
      subtasks: task.subtasks.map((item) => item.id === subtaskId ? { ...item, done: event.target.checked } : item)
    }));
    return;
  }

  const card = event.target.closest(".task-card");
  const taskId = card?.dataset.id;
  if (!taskId) return;

  if (action === "toggle-task") {
    updateTask(taskId, (task) => ({ ...task, done: event.target.checked, status: event.target.checked ? "completed" : "active" }));
  }

  if (action === "edit-task") {
    const task = state.tasks.find((item) => item.id === taskId);
    if (task) fillForm(task);
  }

  if (action === "delete-task") {
    deleteTask(taskId);
  }
}

function exportTasks() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `personal-workplace-todo-${todayString()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Backup JSON dibuat.");
}

function importTasks(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || payload.version !== 1 || !Array.isArray(payload.tasks)) {
        throw new Error("Invalid export payload");
      }
      const imported = payload.tasks.map(normalizeTask).filter((task) => task.title);
      state.tasks = imported;
      saveTasks();
      resetForm();
      renderTasks();
      showToast(`${imported.length} task berhasil diimport.`);
    } catch {
      showToast("File JSON tidak valid untuk Personal Workplace ToDo.");
    } finally {
      els.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

async function clearCompleted() {
  const completed = state.tasks.filter((task) => task.done);
  const count = completed.length;
  if (!count) {
    showToast("Belum ada task selesai.");
    return;
  }
  if (!confirm(`Hapus ${count} task yang sudah selesai?`)) return;
  await Promise.all(completed.flatMap((task) => task.attachments).map((item) => deleteAttachmentBlob(item.id)));
  state.tasks = state.tasks.filter((task) => !task.done);
  saveTasks();
  renderTasks();
  showToast(`${count} task selesai dihapus.`);
}

function switchPage(page) {
  state.activePage = page === "notebook" ? "notebook" : "todo";
  els.todoPage.classList.toggle("active", state.activePage === "todo");
  els.notebookPage.classList.toggle("active", state.activePage === "notebook");
  els.appNavButtons.forEach((button) => button.classList.toggle("active", button.dataset.page === state.activePage));
  if (state.activePage === "notebook") {
    renderLogTaskOptions();
    renderLogs();
  }
}

function handleLogAction(event) {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const entry = state.logs.find((item) => item.id === row.dataset.id);
  if (!entry) return;
  entry.updatedAt = new Date().toISOString();

  if (event.target.dataset.field) {
    entry[event.target.dataset.field] = event.target.value;
  }

  if (event.target.dataset.customColumn) {
    entry.custom = entry.custom || {};
    entry.custom[event.target.dataset.customColumn] = event.target.value;
  }

  saveLogs();
}

function clearLogDragState() {
  state.draggedLogId = "";
  els.logTableBody.querySelectorAll("tr.is-dragging, tr.drop-before, tr.drop-after").forEach((row) => {
    row.classList.remove("is-dragging", "drop-before", "drop-after");
  });
}

function handleLogDragStart(event) {
  const row = event.target.closest("tr[data-id]");
  const handle = event.target.closest(".log-drag-handle");
  if (!row || !handle) {
    event.preventDefault();
    return;
  }
  state.draggedLogId = row.dataset.id;
  row.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", state.draggedLogId);
}

function handleLogDragOver(event) {
  const row = event.target.closest("tr[data-id]");
  if (!row || !state.draggedLogId || row.dataset.id === state.draggedLogId) return;
  event.preventDefault();
  const isAfter = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
  els.logTableBody.querySelectorAll("tr.drop-before, tr.drop-after").forEach((item) => item.classList.remove("drop-before", "drop-after"));
  row.classList.add(isAfter ? "drop-after" : "drop-before");
  event.dataTransfer.dropEffect = "move";
}

function handleLogDrop(event) {
  const targetRow = event.target.closest("tr[data-id]");
  if (!targetRow || !state.draggedLogId || targetRow.dataset.id === state.draggedLogId) return;
  event.preventDefault();
  const sourceIndex = state.logs.findIndex((entry) => entry.id === state.draggedLogId);
  let targetIndex = state.logs.findIndex((entry) => entry.id === targetRow.dataset.id);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const isAfter = targetRow.classList.contains("drop-after") || event.clientY > targetRow.getBoundingClientRect().top + targetRow.getBoundingClientRect().height / 2;
  const [moved] = state.logs.splice(sourceIndex, 1);
  if (sourceIndex < targetIndex) targetIndex -= 1;
  state.logs.splice(isAfter ? targetIndex + 1 : targetIndex, 0, moved);
  saveLogs();
  clearLogDragState();
  renderLogs();
}

function addLogRow() {
  state.logs.unshift(normalizeLogEntry({
    id: uid(),
    date: todayString(),
    status: "progress",
    title: "",
    body: "",
    taskId: "",
    custom: {}
  }));
  saveLogs();
  renderLogs();
}

function deleteSelectedLogRows() {
  const selectedIds = Array.from(els.logTableBody.querySelectorAll(".log-row-select:checked"))
    .map((checkbox) => checkbox.closest("tr")?.dataset.id)
    .filter(Boolean);
  if (!selectedIds.length) {
    showToast("Pilih baris logbook yang ingin dihapus.");
    return;
  }
  if (!confirm(`Hapus ${selectedIds.length} baris logbook?`)) return;
  const selected = new Set(selectedIds);
  state.logs = state.logs.filter((entry) => !selected.has(entry.id));
  saveLogs();
  renderLogs();
}

function addLogColumn() {
  const title = prompt("Nama kolom baru:", `Kolom ${state.logColumns.length + 1}`);
  if (!title) return;
  state.logColumns.push({ id: uid(), title: title.trim().slice(0, 40) || "Kolom" });
  saveLogs();
  renderLogs();
}

function removeLastLogColumn() {
  if (!state.logColumns.length) {
    showToast("Belum ada kolom custom.");
    return;
  }
  const column = state.logColumns[state.logColumns.length - 1];
  if (!confirm(`Hapus kolom "${column.title}"?`)) return;
  state.logColumns.pop();
  state.logs = state.logs.map((entry) => {
    const custom = { ...(entry.custom || {}) };
    delete custom[column.id];
    return { ...entry, custom };
  });
  saveLogs();
  renderLogs();
}

function updateLogColumnTitle(columnId, title) {
  state.logColumns = state.logColumns.map((column) => column.id === columnId ? { ...column, title: title.trim().slice(0, 40) || "Kolom" } : column);
  saveLogs();
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function uint16(value) {
  return [value & 255, (value >>> 8) & 255];
}

function uint32(value) {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

function encodeText(value) {
  return new TextEncoder().encode(value);
}

function dosDateTime(date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  files.forEach((file) => {
    const name = encodeText(file.name);
    const data = encodeText(file.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array([
      ...uint32(0x04034b50),
      ...uint16(20),
      ...uint16(0),
      ...uint16(0),
      ...uint16(dosTime),
      ...uint16(dosDate),
      ...uint32(checksum),
      ...uint32(data.length),
      ...uint32(data.length),
      ...uint16(name.length),
      ...uint16(0)
    ]);
    localParts.push(localHeader, name, data);

    const centralHeader = new Uint8Array([
      ...uint32(0x02014b50),
      ...uint16(20),
      ...uint16(20),
      ...uint16(0),
      ...uint16(0),
      ...uint16(dosTime),
      ...uint16(dosDate),
      ...uint32(checksum),
      ...uint32(data.length),
      ...uint32(data.length),
      ...uint16(name.length),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(0),
      ...uint32(offset)
    ]);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const localFiles = concatBytes(localParts);
  const endRecord = new Uint8Array([
    ...uint32(0x06054b50),
    ...uint16(0),
    ...uint16(0),
    ...uint16(files.length),
    ...uint16(files.length),
    ...uint32(centralDirectory.length),
    ...uint32(localFiles.length),
    ...uint16(0)
  ]);
  return concatBytes([localFiles, centralDirectory, endRecord]);
}

function createXlsxBlob(headers, rows) {
  const allRows = [headers, ...rows];
  const preferredWidths = headers.map((header, index) => {
    if (index === 0) return 14;
    if (index === 1) return 14;
    if (index === 2) return 32;
    if (index === 3) return 72;
    if (index === 4) return 34;
    return 24;
  });
  const estimateLines = (value, width) => String(value ?? "")
    .split(/\r?\n/)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / width)), 0);

  const sheetRows = allRows.map((row, rowIndex) => {
    const cells = row.map((cell, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? 1 : ([3, 4].includes(colIndex) ? 2 : 0);
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
    }).join("");
    const wrappedLines = rowIndex === 0
      ? 1
      : Math.max(1, estimateLines(row[3], preferredWidths[3]), estimateLines(row[4], preferredWidths[4]));
    const height = rowIndex === 0 ? 24 : Math.min(409, Math.max(24, wrappedLines * 15 + 8));
    return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("");

  const colDefs = headers.map((header, index) => {
    const values = rows.map((row) => String(row[index] ?? ""));
    const contentWidth = Math.max(String(header).length + 2, ...values.map((value) => Math.min(value.length + 2, preferredWidths[index])));
    const width = Math.min(90, Math.max(preferredWidths[index], contentWidth));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${colDefs}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A1:${columnName(headers.length - 1)}${allRows.length}"/>
</worksheet>`;

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Logbook" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="0"/>
  <fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><bottom style="thin"><color rgb="FFD9E2E1"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
    },
    { name: "xl/worksheets/sheet1.xml", content: worksheet }
  ];

  return new Blob([createZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function exportLogExcel() {
  const headers = ["Tanggal", "Status", "Judul", "Progress / Catatan", "Task terkait", ...state.logColumns.map((column) => column.title)];
  const rows = state.logs.map((entry) => {
      const task = state.tasks.find((item) => item.id === entry.taskId);
      return [
        entry.date,
        logStatusLabel(entry.status),
        entry.title,
        entry.body,
        task?.title || "",
        ...state.logColumns.map((column) => entry.custom?.[column.id] || "")
      ];
    });
  const blob = createXlsxBlob(headers, rows);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `personal-workplace-logbook-${todayString()}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Logbook diexport ke Excel .xlsx.");
}

function exportLogJson() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    columns: state.logColumns,
    entries: state.logs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `personal-workplace-logbook-${todayString()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Backup logbook dibuat.");
}

function importLogJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || payload.version !== 1 || !Array.isArray(payload.entries) || !Array.isArray(payload.columns)) {
        throw new Error("Invalid logbook payload");
      }
      state.logs = payload.entries.map(normalizeLogEntry);
      state.logColumns = payload.columns.map((column) => ({
        id: typeof column.id === "string" && column.id ? column.id : uid(),
        title: String(column.title ?? "Kolom").trim().slice(0, 40) || "Kolom"
      }));
      saveLogs();
      renderLogs();
      showToast(`${state.logs.length} baris logbook berhasil diimport.`);
    } catch {
      showToast("File logbook tidak valid atau versinya tidak didukung.");
    } finally {
      els.importLogInput.value = "";
    }
  };
  reader.readAsText(file);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

els.taskForm.addEventListener("submit", upsertTask);
els.addSubtaskBtn.addEventListener("click", addDraftSubtask);
els.subtaskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDraftSubtask();
  }
});
els.subtaskDraftList.addEventListener("click", (event) => {
  if (event.target.dataset.action !== "remove-draft") return;
  const id = event.target.closest(".draft-item")?.dataset.id;
  state.draftSubtasks = state.draftSubtasks.filter((item) => item.id !== id);
  renderDraftSubtasks();
});
els.attachmentInput.addEventListener("change", (event) => {
  addAttachmentFiles(event.target.files);
  els.attachmentInput.value = "";
});
els.attachmentDraftList.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  const id = event.target.closest(".attachment-item")?.dataset.id;
  if (!id) return;
  if (action === "open-draft-attachment") {
    openAttachment(id);
    return;
  }
  if (action === "remove-draft-attachment") {
    state.attachmentDrafts = state.attachmentDrafts.filter((item) => item.id !== id);
    renderAttachmentDrafts();
  }
});
els.cancelEditBtn.addEventListener("click", resetForm);
els.scheduleButtons.forEach((button) => {
  button.addEventListener("click", () => applySchedulePreset(button.dataset.schedule, button.dataset.preset));
});
els.taskList.addEventListener("click", (event) => {
  if (event.target.matches('input[type="checkbox"]')) return;
  handleTaskAction(event);
});
els.taskList.addEventListener("change", handleTaskAction);
els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderTasks();
});
els.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderTasks();
});
els.filterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter-pill").forEach((pill) => pill.classList.toggle("active", pill === button));
  renderTasks();
});
els.exportBtn.addEventListener("click", exportTasks);
els.importInput.addEventListener("change", (event) => importTasks(event.target.files[0]));
els.clearCompletedBtn.addEventListener("click", clearCompleted);
els.appNavButtons.forEach((button) => {
  button.addEventListener("click", () => switchPage(button.dataset.page));
});
els.addLogRowBtn.addEventListener("click", addLogRow);
els.deleteLogRowsBtn.addEventListener("click", deleteSelectedLogRows);
els.addLogColumnBtn.addEventListener("click", addLogColumn);
els.removeLogColumnBtn.addEventListener("click", removeLastLogColumn);
els.exportLogJsonBtn.addEventListener("click", exportLogJson);
els.importLogInput.addEventListener("change", (event) => importLogJson(event.target.files[0]));
els.exportLogExcelBtn.addEventListener("click", exportLogExcel);
els.logSearchInput.addEventListener("input", (event) => {
  state.logSearch = event.target.value;
  renderLogs();
});
els.logTableBody.addEventListener("input", handleLogAction);
els.logTableBody.addEventListener("change", handleLogAction);
els.logTableBody.addEventListener("dragstart", handleLogDragStart);
els.logTableBody.addEventListener("dragover", handleLogDragOver);
els.logTableBody.addEventListener("drop", handleLogDrop);
els.logTableBody.addEventListener("dragend", clearLogDragState);
els.logTableHead.addEventListener("input", (event) => {
  if (!event.target.dataset.columnId) return;
  updateLogColumnTitle(event.target.dataset.columnId, event.target.value);
});
els.logTableHead.addEventListener("change", (event) => {
  if (event.target.id !== "selectAllLogRows") return;
  els.logTableBody.querySelectorAll(".log-row-select").forEach((checkbox) => {
    checkbox.checked = event.target.checked;
  });
});

loadTasks();
loadLogs();
renderDraftSubtasks();
renderAttachmentDrafts();
renderTasks();
renderLogs();
checkReminderService();
syncTasksToReminderService();
setInterval(checkReminderService, 30000);
