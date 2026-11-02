// Demo mode's stand-in for the API: same paths, rules and errors as api/app.js, stored in this browser.
const KEY = 'todo-demo';
const NOT_FOUND = '할 일을 찾을 수 없습니다';
const BAD_TITLE = 'title은 1~500자 문자열이어야 합니다';

let memory = []; // what we fall back on when localStorage is blocked, full or holds garbage
let writable = true; // after a failed write, storage holds stale rows that must not replace memory

function load() {
  if (!writable) return memory;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(stored)) memory = stored.filter((t) => Number.isInteger(t?.id) && typeof t.title === 'string');
  } catch {
    // keep memory
  }
  return memory;
}

function save(todos) {
  memory = todos;
  try {
    localStorage.setItem(KEY, JSON.stringify(todos));
  } catch {
    writable = false;
  }
}

const validTitle = (title) => typeof title === 'string' && title.trim() && title.trim().length <= 500;

export async function demoRequest(path = '', method = 'GET', body) {
  const todos = load();
  if (method === 'GET') return todos;

  if (method === 'POST') {
    if (!validTitle(body?.title) || body.title.length > 500) throw new Error(BAD_TITLE);
    const todo = {
      id: Math.max(0, ...todos.map((t) => t.id)) + 1,
      title: body.title.trim(),
      completed: false,
      created_at: new Date().toISOString(),
    };
    save([...todos, todo]);
    return todo;
  }

  const id = Number(path.slice(1));
  const todo = todos.find((t) => t.id === id);

  if (method === 'PATCH') {
    const { title, completed } = body ?? {};
    if (title !== undefined && !validTitle(title)) throw new Error(BAD_TITLE);
    if (completed === undefined ? title === undefined : typeof completed !== 'boolean') {
      throw new Error('completed는 true 또는 false여야 합니다');
    }
    if (!todo) throw new Error(NOT_FOUND);
    const updated = { ...todo, title: title?.trim() ?? todo.title, completed: completed ?? todo.completed };
    save(todos.map((t) => (t.id === id ? updated : t)));
    return updated;
  }

  if (!todo) throw new Error(NOT_FOUND);
  save(todos.filter((t) => t.id !== id));
  return null;
}
