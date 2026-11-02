import { useEffect, useState } from 'react';

async function request(path = '', method = 'GET', body) {
  const res = await fetch(`/api/todos${path}`, {
    method,
    headers: body && { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? '요청에 실패했습니다');
  return res.status === 204 ? null : res.json();
}

const TABS = [
  ['all', '전체'],
  ['active', '진행 중'],
  ['done', '완료'],
];

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [clearing, setClearing] = useState(false);

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    run(async () => {
      setTodos(await request());
      setLoaded(true);
    });
  }, []);

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      const todo = await request('', 'POST', { title });
      setTodos((prev) => [...prev, todo]);
      setTitle('');
    });
  };

  const toggle = (id, completed) =>
    run(async () => {
      const updated = await request(`/${id}`, 'PATCH', { completed });
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });

  const remove = (id) =>
    run(async () => {
      await request(`/${id}`, 'DELETE');
      setTodos((prev) => prev.filter((t) => t.id !== id));
    });

  const clearDone = async () => {
    const ids = todos.filter((t) => t.completed).map((t) => t.id);
    if (!window.confirm(`완료한 ${ids.length}개를 삭제할까요?`)) return;
    setClearing(true);
    await run(async () => {
      // Some deletes can fail: keep those rows on screen and drop only the ones that went through.
      const results = await Promise.allSettled(ids.map((id) => request(`/${id}`, 'DELETE')));
      const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
      setTodos((prev) => prev.filter((t) => !deleted.includes(t.id)));
      if (deleted.length < ids.length) throw new Error(`${ids.length - deleted.length}개를 삭제하지 못했어요.`);
    });
    setClearing(false);
  };

  const done = todos.filter((t) => t.completed).length;
  const left = todos.length - done;
  const counts = { all: todos.length, active: left, done };
  const keyword = query.trim().toLowerCase();
  const visible = todos.filter(
    (t) => (filter === 'all' || t.completed === (filter === 'done')) && t.title.toLowerCase().includes(keyword),
  );
  const heading = !loaded && todos.length === 0
    ? error
      ? '목록을 불러오지 못했어요.'
      : '불러오는 중.'
    : todos.length === 0
      ? '할 일이 없어요.'
      : left === 0
        ? '모두 끝냈어요.'
        : `남은 일 ${left}개.`;

  return (
    <main>
      <p className="brand">Todo</p>
      <h1>{heading}</h1>
      {todos.length > 0 && (
        <>
          <p className="summary">
            전체 {todos.length}개 중 {done}개 완료
          </p>
          <progress aria-label="완료한 할 일" value={done} max={todos.length} />
        </>
      )}
      <form onSubmit={add}>
        <input
          aria-label="새 할 일"
          placeholder="할 일을 입력하세요"
          maxLength={500}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button>추가</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loaded && todos.length === 0 && <p className="empty">위 입력창에 첫 할 일을 적어 보세요.</p>}
      {todos.length > 0 && (
        <>
          <input
            className="search"
            type="search"
            aria-label="할 일 검색"
            placeholder="할 일 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="tools">
            <div className="tabs" role="group" aria-label="할 일 필터">
              {TABS.map(([key, label]) => (
                <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                  {label} <small>{counts[key]}</small>
                </button>
              ))}
            </div>
            {done > 0 && (
              <button className="clear" disabled={clearing} onClick={clearDone}>
                완료한 일 모두 삭제
              </button>
            )}
          </div>
          {visible.length === 0 && <p className="empty">찾는 할 일이 없어요</p>}
        </>
      )}
      <ul>
        {visible.map((todo) => (
          <li key={todo.id}>
            <label>
              <input type="checkbox" checked={todo.completed} onChange={(e) => toggle(todo.id, e.target.checked)} />
              <span>{todo.title}</span>
            </label>
            <button aria-label={`${todo.title} 삭제`} onClick={() => remove(todo.id)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
