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

test('stores SQL metacharacters literally', async () => {
  const title = "'); DROP TABLE todos; --";
  const todo = await (await send('POST', '', { title })).json();
  assert.equal(todo.title, title);
  await send('DELETE', `/${todo.id}`);
});
