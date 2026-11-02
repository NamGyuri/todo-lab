// Needs a real PostgreSQL via the DB_* variables. Only touches rows it creates.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { app, init, pool } from './app.js';

let server, url;

const send = (method, path, body) =>
  fetch(url + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

before(async () => {
  await init();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://localhost:${server.address().port}/api/todos`;
});

after(async () => {
  server.close();
  await pool.end();
});

test('add, list, complete, delete', async () => {
  const added = await send('POST', '', { title: '  우유 사기  ' });
  assert.equal(added.status, 201);
  const todo = await added.json();
  assert.equal(todo.title, '우유 사기');
  assert.equal(todo.completed, false);

  const list = await (await send('GET', '')).json();
  assert.ok(list.some((t) => t.id === todo.id));

  const done = await send('PATCH', `/${todo.id}`, { completed: true });
  assert.equal(done.status, 200);
  assert.equal((await done.json()).completed, true);

  assert.equal((await send('DELETE', `/${todo.id}`)).status, 204);
  assert.equal((await send('DELETE', `/${todo.id}`)).status, 404);
  assert.equal((await send('PATCH', `/${todo.id}`, { completed: true })).status, 404);
});

test('rejects bad input', async () => {
  for (const body of [{}, { title: '   ' }, { title: 1 }, { title: 'x'.repeat(501) }]) {
    assert.equal((await send('POST', '', body)).status, 400);
  }
  assert.equal((await send('PATCH', '/1', { completed: 'yes' })).status, 400);
  for (const id of ['abc', '1;DROP TABLE todos', '99999999999']) {
    assert.equal((await send('DELETE', `/${encodeURIComponent(id)}`)).status, 404);
  }
  const malformed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
});

test('edit title', async () => {
  const todo = await (await send('POST', '', { title: '원래 제목' })).json();
  try {
    await send('PATCH', `/${todo.id}`, { completed: true });

    const edited = await send('PATCH', `/${todo.id}`, { title: '  새 제목  ' });
    assert.equal(edited.status, 200);
    const body = await edited.json();
    assert.equal(body.title, '새 제목');
    assert.equal(body.completed, true);

    const max = await send('PATCH', `/${todo.id}`, { title: 'x'.repeat(500) });
    assert.equal(max.status, 200);

    for (const title of ['', '   ', 'x'.repeat(501), 1, null]) {
      assert.equal((await send('PATCH', `/${todo.id}`, { title })).status, 400);
    }
    const unchanged = (await (await send('GET', '')).json()).find((t) => t.id === todo.id);
    assert.equal(unchanged.title, 'x'.repeat(500));

    const toggled = await (await send('PATCH', `/${todo.id}`, { completed: false })).json();
    assert.equal(toggled.completed, false);
    assert.equal(toggled.title, 'x'.repeat(500));
    assert.equal((await send('PATCH', `/${todo.id}`, {})).status, 400);
  } finally {
    await send('DELETE', `/${todo.id}`);
  }
  assert.equal((await send('PATCH', `/${todo.id}`, { title: '없는 할 일' })).status, 404);
});

test('patch changes only the fields it was sent', async () => {
  const todo = await (await send('POST', '', { title: '처음' })).json();
  const patch = async (body) => {
    const res = await send('PATCH', `/${todo.id}`, body);
    return [res.status, await res.json()];
  };
  const current = async () => (await (await send('GET', '')).json()).find((t) => t.id === todo.id);
  try {
    let [status, row] = await patch({ completed: true });
    assert.equal(status, 200);
    assert.deepEqual([row.title, row.completed], ['처음', true]);

    // A finished todo can still be renamed, and stays finished.
    [status, row] = await patch({ title: '  완료 후 수정  ' });
    assert.equal(status, 200);
    assert.deepEqual([row.title, row.completed], ['완료 후 수정', true]);

    [status, row] = await patch({ title: '  둘 다  ', completed: false });
    assert.equal(status, 200);
    assert.deepEqual([row.title, row.completed], ['둘 다', false]);

    // One bad field rejects the whole request: the good one must not be applied.
    for (const body of [
      { title: '   ', completed: true },
      { title: 'x'.repeat(501), completed: true },
      { title: '바뀌면 안 됨', completed: 'yes' },
      { title: '바뀌면 안 됨', completed: null },
    ]) {
      assert.equal((await patch(body))[0], 400);
    }
    row = await current();
    assert.deepEqual([row.title, row.completed], ['둘 다', false]);
  } finally {
    await send('DELETE', `/${todo.id}`);
  }
});

test('stores SQL metacharacters literally', async () => {
  const title = "'); DROP TABLE todos; --";
  const todo = await (await send('POST', '', { title })).json();
  assert.equal(todo.title, title);
  await send('DELETE', `/${todo.id}`);
});
