import { useEffect, useRef, useState } from 'react';
import { demoRequest } from './demo.js';

const DEMO = import.meta.env.VITE_DEMO === 'true';

async function apiRequest(path = '', method = 'GET', body) {
  const res = await fetch(`/api/todos${path}`, {
    method,
    headers: body && { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
    // A delete sent while the tab is closing must outlive the page.
    keepalive: method === 'DELETE',
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? '요청에 실패했습니다');
  return res.status === 204 ? null : res.json();
}

const request = DEMO ? demoRequest : apiRequest;

const TABS = [
  ['all', '전체'],
  ['active', '진행 중'],
  ['done', '완료'],
];
const UNDO_MS = 5000;
const DOUBLE_CLICK_MS = 250;

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [clearing, setClearing] = useState(false);
  const [leaving, setLeaving] = useState([]);
  const [pending, setPending] = useState([]);
  const [editing, setEditing] = useState(null);
  const undoTimers = useRef(new Map());
  const titleClick = useRef();
  const editSaving = useRef(false);

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

  useEffect(() => {
    const flushDeletes = () => {
      for (const [id, timer] of undoTimers.current) {
        clearTimeout(timer);
        request(`/${id}`, 'DELETE').catch(() => {});
      }
      undoTimers.current.clear();
    };
    // Back from bfcache, the page would still offer undo for rows already deleted.
    const reloadIfRestored = (e) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pagehide', flushDeletes);
    window.addEventListener('pageshow', reloadIfRestored);
    return () => {
      window.removeEventListener('pagehide', flushDeletes);
      window.removeEventListener('pageshow', reloadIfRestored);
    };
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

  // One edit at a time: nothing saves by itself now, so switching rows would lose the draft.
  const startEdit = (todo) => {
    if (!editing) setEditing({ id: todo.id, draft: todo.title, message: '' });
  };

  const saveEdit = async () => {
    if (editSaving.current) return;
    const next = editing.draft.trim();
    if (!next) return setEditing({ ...editing, message: '제목을 입력해 주세요.' });
    if (next.length > 500) return setEditing({ ...editing, message: '제목은 500자까지 쓸 수 있어요.' });
    if (next === todos.find((t) => t.id === editing.id)?.title) return setEditing(null);
    editSaving.current = true;
    try {
      const updated = await request(`/${editing.id}`, 'PATCH', { title: next });
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditing(null);
    } catch (err) {
      setEditing((prev) => prev && { ...prev, message: err.message });
    } finally {
      editSaving.current = false;
    }
  };

  const editKey = (e) => {
    // Enter that confirms Korean composition is not a save; Safari reports it only through keyCode.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // Enter on the 취소 button must stay a click on that button.
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') saveEdit();
    if (e.key === 'Escape') setEditing(null);
  };

  // The title sits in the checkbox's label, so each click of a double click would toggle it.
  const clickTitle = (e, todo) => {
    e.preventDefault();
    clearTimeout(titleClick.current);
    if (e.detail === 1) titleClick.current = setTimeout(() => toggle(todo.id, !todo.completed), DOUBLE_CLICK_MS);
  };

  const doubleClickTitle = (todo) => {
    clearTimeout(titleClick.current);
    startEdit(todo);
  };

  // Plays the row-out animation (0.2s in index.html) before the rows leave the list.
  const dropRows = async (ids) => {
    setLeaving((prev) => [...prev, ...ids]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setTodos((prev) => prev.filter((t) => !ids.includes(t.id)));
    setLeaving((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const commitDelete = (id) => {
    undoTimers.current.delete(id);
    setPending((prev) => prev.filter((p) => p !== id));
    setLeaving((prev) => [...prev, id]);
    run(async () => {
      try {
        await request(`/${id}`, 'DELETE');
        setTodos((prev) => prev.filter((t) => t.id !== id));
      } catch {
        throw new Error('삭제하지 못해 되살렸어요.');
      } finally {
        setLeaving((prev) => prev.filter((l) => l !== id));
      }
    });
  };

  const remove = (id) => {
    setPending((prev) => [...prev, id]);
    undoTimers.current.set(id, setTimeout(() => commitDelete(id), UNDO_MS));
  };

  const undo = (id) => {
    clearTimeout(undoTimers.current.get(id));
    undoTimers.current.delete(id);
    setPending((prev) => prev.filter((p) => p !== id));
  };

  const isGone = (id) => pending.includes(id) || leaving.includes(id);
  const live = todos.filter((t) => !isGone(t.id));

  const clearDone = async () => {
    const ids = live.filter((t) => t.completed).map((t) => t.id);
    if (!window.confirm(`완료한 ${ids.length}개를 삭제할까요?`)) return;
    setClearing(true);
    await run(async () => {
      // Some deletes can fail: keep those rows on screen and drop only the ones that went through.
      const results = await Promise.allSettled(ids.map((id) => request(`/${id}`, 'DELETE')));
      const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
      await dropRows(deleted);
      if (deleted.length < ids.length) throw new Error(`${ids.length - deleted.length}개를 삭제하지 못했어요.`);
    });
    setClearing(false);
  };

  const done = live.filter((t) => t.completed).length;
  const left = live.length - done;
  const counts = { all: live.length, active: left, done };
  const keyword = query.trim().toLowerCase();
  const matches = (t) =>
    (filter === 'all' || t.completed === (filter === 'done')) && t.title.toLowerCase().includes(keyword);
  const latestPending = pending.at(-1);
  const heading = !loaded && live.length === 0
    ? error
      ? '목록을 불러오지 못했어요.'
      : '불러오는 중.'
    : live.length === 0
      ? '할 일이 없어요.'
      : left === 0
        ? '모두 끝냈어요.'
        : `남은 일 ${left}개.`;

  return (
    <main>
      {DEMO && <p className="demo-notice">데모 버전이에요. 할 일은 이 브라우저에만 저장돼요.</p>}
      <p className="brand">Todo</p>
      <h1>{heading}</h1>
      {live.length > 0 && (
        <>
          <p className="summary">
            전체 {live.length}개 중 {done}개 완료
          </p>
          <progress aria-label="완료한 할 일" value={done} max={live.length} />
        </>
      )}
      <form onSubmit={add}>
        <input
          aria-label="새 할 일"
          placeholder="새로운 할 일을 적어 보세요"
          maxLength={500}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button disabled={!title.trim()}>추가</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loaded && live.length === 0 && <p className="empty">아직 할 일이 없어요. 첫 할 일을 적어 보세요.</p>}
      {live.length > 0 && (
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
          {!live.some(matches) && <p className="empty">찾는 할 일이 없어요</p>}
        </>
      )}
      <ul>
        {todos.filter(matches).map((todo) => (
          <li key={todo.id} className={isGone(todo.id) ? 'leaving' : undefined} inert={isGone(todo.id)}>
            {editing?.id === todo.id ? (
              <div className="edit" onKeyDown={editKey}>
                <div className="edit-row">
                  <input
                    autoFocus
                    aria-label={`${todo.title} 제목 수정`}
                    aria-invalid={Boolean(editing.message)}
                    value={editing.draft}
                    onChange={(e) => setEditing({ ...editing, draft: e.target.value, message: '' })}
                  />
                  <button className="edit-save" onClick={saveEdit}>
                    저장
                  </button>
                  <button className="edit-cancel" onClick={() => setEditing(null)}>
                    취소
                  </button>
                </div>
                {editing.message && <p role="alert">{editing.message}</p>}
              </div>
            ) : (
              <>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`${todo.title} 완료 표시`}
                    checked={todo.completed}
                    onChange={(e) => toggle(todo.id, e.target.checked)}
                  />
                  <svg className="tick" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 12.5 4 4 8-9" pathLength="1" />
                  </svg>
                  <span
                    title={todo.title}
                    onClick={(e) => clickTitle(e, todo)}
                    onDoubleClick={() => doubleClickTitle(todo)}
                  >
                    {todo.title}
                  </span>
                </label>
                <button
                  className="edit-button"
                  aria-label={`${todo.title} 제목 수정`}
                  disabled={Boolean(editing)}
                  onClick={() => startEdit(todo)}
                >
                  수정
                </button>
                <button aria-label={`${todo.title} 삭제`} onClick={() => remove(todo.id)}>
                  삭제
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="toast-region" role="status">
        {latestPending !== undefined && (
          <div className="toast">
            삭제했어요 ·
            <button key={latestPending} autoFocus onClick={() => undo(latestPending)}>
              실행 취소
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
