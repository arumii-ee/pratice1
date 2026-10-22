const STORAGE_KEY = "todos";
const STATUS_LABEL = { todo: "미완", doing: "진행중", done: "완료" };

const $ = (id) => document.getElementById(id);

// 탭
const tabButtons = document.querySelectorAll(".tabs button");
const views = { calendar: $("calendar-view"), list: $("list-view") };

// 달력
const calTitle = $("cal-title");
const calGrid = $("cal-grid");

// 목록
const list = $("todo-list");
const count = $("todo-count");
const filterButtons = document.querySelectorAll(".filters button");

// 등록/수정 다이얼로그
const formDialog = $("form-dialog");
const form = $("todo-form");
const fText = $("f-text");
const fDate = $("f-date");
const fStatus = $("f-status");
const fMemo = $("f-memo");

// 상세 다이얼로그
const detailDialog = $("detail-dialog");
const dCheck = $("d-check");
const statusButtons = document.querySelectorAll(".status-picker button");

let todos = load();
let filter = "all";
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let editingId = null; // 수정 중인 할 일 (null이면 새로 추가)
let detailId = null; // 상세 창에 열린 할 일

function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const week = "일월화수목금토"[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${week})`;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    // 예전 형식({ done: true })으로 저장된 데이터도 새 형식으로 맞춤
    return saved.map((t) => ({
      id: t.id,
      text: t.text,
      date: t.date || dateKey(new Date(t.id)),
      status: t.status || (t.done ? "done" : "todo"),
      memo: t.memo || "",
    }));
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 저장이 막힌 환경(시크릿 모드 등)에서는 메모리에만 유지
  }
}

function findTodo(id) {
  return todos.find((t) => t.id === id);
}

function render() {
  renderCalendar();
  renderList();
  if (detailDialog.open) renderDetail();
}

function renderCalendar() {
  calTitle.textContent = `${viewYear}년 ${viewMonth + 1}월`;
  $("go-today").textContent = new Date().getDate();
  calGrid.innerHTML = "";

  const first = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const todayKey = dateKey(new Date());

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(viewYear, viewMonth, 1 - first.getDay() + i);
    const key = dateKey(date);

    const cell = document.createElement("div");
    cell.className = "day";
    if (date.getMonth() !== viewMonth) cell.classList.add("other");
    if (key === todayKey) cell.classList.add("today");
    cell.addEventListener("click", () => openForm(null, key));

    const num = document.createElement("span");
    num.className = "day-num";
    if (date.getDay() === 0) num.classList.add("sun");
    if (date.getDay() === 6) num.classList.add("sat");
    num.innerHTML = `<span>${date.getDate()}</span>`;
    cell.appendChild(num);

    // 달력에는 제목만 표시 (메모는 상세 창에서만)
    for (const todo of todos.filter((t) => t.date === key)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip ${todo.status}`;
      chip.textContent = todo.text;
      chip.title = `${todo.text} · ${STATUS_LABEL[todo.status]}`;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetail(todo.id);
      });
      cell.appendChild(chip);
    }

    calGrid.appendChild(cell);
  }
}

function renderList() {
  list.innerHTML = "";
  const items = todos
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "할 일이 없어요";
    list.appendChild(li);
  }

  for (const todo of items) {
    const li = document.createElement("li");
    li.classList.toggle("done", todo.status === "done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.status === "done";
    checkbox.setAttribute("aria-label", "완료");
    checkbox.addEventListener("change", () => setDone(todo.id, checkbox.checked));

    const main = document.createElement("button");
    main.type = "button";
    main.className = "item-main";
    main.innerHTML = `<span class="item-text"></span><span class="item-date"></span>`;
    main.querySelector(".item-text").textContent = todo.text;
    main.querySelector(".item-date").textContent = formatDate(todo.date);
    main.addEventListener("click", () => openDetail(todo.id));

    const badge = document.createElement("span");
    badge.className = `badge ${todo.status}`;
    badge.textContent = STATUS_LABEL[todo.status];

    li.append(checkbox, main, badge);
    list.appendChild(li);
  }

  const n = (s) => todos.filter((t) => t.status === s).length;
  count.textContent = `미완 ${n("todo")} · 진행중 ${n("doing")} · 완료 ${n("done")}`;
}

function renderDetail() {
  const todo = findTodo(detailId);
  if (!todo) {
    detailDialog.close();
    return;
  }
  const done = todo.status === "done";
  $("d-text").textContent = todo.text;
  $("d-date").textContent = formatDate(todo.date);
  $("d-memo").textContent = todo.memo || "메모 없음";
  dCheck.checked = done;
  dCheck.closest("label").classList.toggle("done", done);
  statusButtons.forEach((b) => b.classList.toggle("active", b.dataset.status === todo.status));
}

function setStatus(id, status) {
  const todo = findTodo(id);
  if (todo) todo.status = status;
  save();
  render();
}

function setDone(id, done) {
  setStatus(id, done ? "done" : "todo");
}

function openForm(id, date) {
  const todo = id != null ? findTodo(id) : null;
  editingId = todo ? todo.id : null;
  $("form-title").textContent = todo ? "할 일 수정" : "할 일 추가";
  fText.value = todo ? todo.text : "";
  fDate.value = todo ? todo.date : date || dateKey(new Date());
  fStatus.value = todo ? todo.status : "todo";
  fMemo.value = todo ? todo.memo : "";
  formDialog.showModal();
  fText.focus();
}

function openDetail(id) {
  detailId = id;
  renderDetail();
  detailDialog.showModal();
}

// 이벤트 연결
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    for (const [name, view] of Object.entries(views)) view.hidden = name !== btn.dataset.tab;
  });
});

$("prev-month").addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});

$("next-month").addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

$("go-today").addEventListener("click", () => {
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();
  renderCalendar();
});

document.querySelectorAll(".add-btn").forEach((btn) => {
  btn.addEventListener("click", () => openForm(null));
});

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterButtons.forEach((b) => b.classList.toggle("active", b === btn));
    renderList();
  });
});

$("clear-done").addEventListener("click", () => {
  todos = todos.filter((t) => t.status !== "done");
  save();
  render();
});

form.addEventListener("submit", () => {
  const text = fText.value.trim();
  if (!text) return;
  const data = { text, date: fDate.value, status: fStatus.value, memo: fMemo.value.trim() };
  const todo = findTodo(editingId);
  if (todo) Object.assign(todo, data);
  else todos.push({ id: Date.now(), ...data });
  save();
  render();
});

$("form-cancel").addEventListener("click", () => formDialog.close());

dCheck.addEventListener("change", () => setDone(detailId, dCheck.checked));
statusButtons.forEach((btn) => {
  btn.addEventListener("click", () => setStatus(detailId, btn.dataset.status));
});

$("d-edit").addEventListener("click", () => {
  detailDialog.close();
  openForm(detailId);
});

$("d-delete").addEventListener("click", () => {
  todos = todos.filter((t) => t.id !== detailId);
  save();
  detailDialog.close();
  render();
});

$("d-close").addEventListener("click", () => detailDialog.close());

render();
