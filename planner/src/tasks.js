// GitHub Pages의 localStorage는 같은 계정의 다른 저장소와 공유되므로 키에 저장소 이름을 넣는다.
export const STORAGE_KEY = 'todo-lab-planner';
const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`;

const DEFAULT_ICON = { Work: 'briefcase', Personal: 'home', 'Daily Habits': 'sprout' };
const KNOWN_ICONS = ['briefcase', 'home', 'sprout', 'folder'];

// 저장값을 믿지 않고 항상 그릴 수 있는 이름을 돌려준다. 화면과 저장 데이터 보정이 함께 쓴다.
// shortcut: 기본 리스트의 folder를 잘못된 값으로 본다, F-24에서 아이콘을 고르게 되면 이 규칙을 일회성 이관으로 바꾼다.
export function listIconName(list) {
  const icon = KNOWN_ICONS.includes(list?.icon) ? list.icon : 'folder';
  if (icon === 'folder' && list && Object.hasOwn(DEFAULT_ICON, list.name)) return DEFAULT_ICON[list.name];
  return icon;
}

export const DEFAULT_LISTS = [
  { id: 'l1', name: 'Work', icon: 'briefcase', order: 1 },
  { id: 'l2', name: 'Personal', icon: 'home', order: 2 },
  { id: 'l3', name: 'Daily Habits', icon: 'sprout', order: 3 },
];

// toISOString은 UTC 기준이라 한국에서는 오전 9시 전에 날짜가 하루 밀린다.
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

export function dateLabel(key, today) {
  if (!key) return '날짜 없음';
  if (key === today) return '오늘';
  if (key === addDays(today, 1)) return '내일';
  const d = parseKey(key);
  const monthDay = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return key.slice(0, 4) === today.slice(0, 4) ? monthDay : `${d.getFullYear()}년 ${monthDay}`;
}

// 달력 날짜 차이로 센다. 어제 밤에 지웠으면 몇 시간 전이어도 "1일 전"이다.
export function deletedLabel(iso, now = new Date()) {
  const deleted = new Date(iso);
  if (Number.isNaN(deleted.getTime())) return '삭제됨';
  const days = Math.round((parseKey(dateKey(now)) - parseKey(dateKey(deleted))) / 86400000);
  return days <= 0 ? '오늘 삭제' : `${days}일 전 삭제`;
}

export function shortDate(key, today) {
  if (!key) return '—';
  if (key === today) return '오늘';
  if (key === addDays(today, 1)) return '내일';
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8))}`;
}

export function combinedLabel(key, list, today) {
  const date = key ? `날짜 ${dateLabel(key, today)}` : '날짜 없음';
  return `${date}, 리스트 ${list?.name ?? '없음'}, 변경하기`;
}

export const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function createTask({ title, date, listId }) {
  return { id: newId(), title, listId, date, done: false, doneAt: null, deletedAt: null };
}

export function initialState(today) {
  const sample = (title, listId, date, done = false) => ({
    ...createTask({ title, date, listId }),
    done,
    doneAt: done ? new Date().toISOString() : null,
    sample: true,
  });
  return {
    intro: true,
    lists: DEFAULT_LISTS,
    tasks: [
      sample('예시: 주간 회의 자료 준비하기', 'l1', today),
      sample('예시: 장보기 목록 정리하기', 'l2', today),
      sample('예시: 물 2리터 마시기', 'l3', today, true),
      sample('예시: 치과 예약 전화하기', 'l2', addDays(today, 1)),
      sample('예시: 읽고 싶은 책 고르기', 'l2', null),
    ],
  };
}

const isTask = (t) =>
  t &&
  typeof t.id === 'string' &&
  typeof t.title === 'string' &&
  (t.date === null || /^\d{4}-\d{2}-\d{2}$/.test(t.date));

export function parseState(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.lists)) throw new Error('형식 오류');
  const tasks = parsed.tasks.filter(isTask);
  // icon 값만 바로잡고 이전의 emoji 값을 뺀다. 다른 필드는 건드리지 않으며, 앱의 자동 저장이 이 결과를 기록한다.
  const lists = parsed.lists.map(({ emoji, ...l }) => ({ ...l, icon: listIconName(l) }));
  return { state: { ...parsed, lists, tasks }, damaged: tasks.length !== parsed.tasks.length };
}

export function loadState(storage, today) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: initialState(today), persistent: false };
  }
  if (raw === null) return { state: initialState(today), persistent: true };
  try {
    const { state, damaged } = parseState(raw);
    if (damaged) keepCorrupt(storage, raw);
    return { state, persistent: true };
  } catch {
    keepCorrupt(storage, raw);
    return { state: initialState(today), persistent: true };
  }
}

// 다음 자동 저장이 덮어쓰기 전에 망가진 원본을 복구용으로 남긴다.
function keepCorrupt(storage, raw) {
  try {
    storage.setItem(CORRUPT_KEY, raw);
  } catch {
    // 남길 수 없어도 앱은 계속 동작해야 한다.
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

const byDate = (a, b) => a.date.localeCompare(b.date);

export function viewTasks(tasks, view, today) {
  const live = tasks.filter((t) => !t.deletedAt);
  switch (view) {
    case 'all':
      return live;
    case 'today':
      // 달력이 없는 동안 지난 미완료 항목이 어디서도 안 보이는 일을 막는다.
      return live
        .filter((t) => t.date === today || (t.date && t.date < today && !t.done))
        .sort(byDate);
    case 'upcoming':
      return live.filter((t) => t.date && t.date > today).sort(byDate);
    case 'completed':
      return live.filter((t) => t.done);
    case 'trash':
      return tasks.filter((t) => t.deletedAt);
    default:
      return [];
  }
}

// 날짜 오름차순, 날짜 없는 묶음은 맨 아래.
export function groupByDate(tasks) {
  const groups = new Map();
  for (const t of tasks) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);
  return [...groups]
    .sort(([a], [b]) => (a === null) - (b === null) || (a ?? '').localeCompare(b ?? ''))
    .map(([date, items]) => ({ date, tasks: items }));
}

// F-20: 남은 할 일 개수. 완료함과 휴지통에는 남은 할 일이 없으므로 0이다.
export function remainingCount(tasks, view, today) {
  if (view === 'completed' || view === 'trash') return 0;
  return viewTasks(tasks, view, today).filter((t) => !t.done).length;
}

// 일요일 시작 주 배열. 해당 달이 아닌 칸은 null이다.
export function monthGrid(key) {
  const first = parseKey(key);
  first.setDate(1);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array(first.getDay()).fill(null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(dateKey(new Date(first.getFullYear(), first.getMonth(), day)));
  }
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function dayTitle(key) {
  const d = parseKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export const dayTasks = (tasks, key) => tasks.filter((t) => !t.deletedAt && t.date === key);

// 달력 점: 'open' 미완료 있음, 'done' 모두 완료, null 할 일 없음.
export function dayStatus(tasks, key) {
  const items = dayTasks(tasks, key);
  if (items.length === 0) return null;
  return items.every((t) => t.done) ? 'done' : 'open';
}

// 미완료는 받은 순서 그대로, 완료는 그 아래에 완료한 순서대로 둔다. 원본 순서를 바꾸지 않아 체크를 풀면 제자리로 돌아간다.
export function doneLast(tasks) {
  const done = tasks.filter((t) => t.done).sort((a, b) => (a.doneAt ?? '').localeCompare(b.doneAt ?? ''));
  return [...tasks.filter((t) => !t.done), ...done];
}

export function homeView(task, today) {
  if (!task.date) return 'all';
  return task.date > today ? 'upcoming' : 'today';
}
