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

export default function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const run = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    run(async () => setTodos(await request()));
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

  return (
    <main>
      <h1>Todo</h1>
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
      <ul>
        {todos.map((todo) => (
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
