import express from 'express';
import pg from 'pg';

for (const name of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
  if (process.env[name] === undefined) throw new Error(`환경 변수 ${name}가 필요합니다`);
}

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
// Without a listener, an idle connection dropping would crash the process.
pool.on('error', (err) => console.error(err));

export const init = () =>
  pool.query(`CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

export const app = express();
app.use(express.json());

app.get('/api/todos', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM todos ORDER BY id');
  res.json(rows);
});

app.post('/api/todos', async (req, res) => {
  const title = req.body?.title;
  if (typeof title !== 'string' || !title.trim() || title.length > 500) {
    return res.status(400).json({ error: 'title은 1~500자 문자열이어야 합니다' });
  }
  const { rows } = await pool.query('INSERT INTO todos (title) VALUES ($1) RETURNING *', [title.trim()]);
  res.status(201).json(rows[0]);
});

// Anything outside the SERIAL range cannot exist, so it is a 404 rather than a Postgres error.
const validId = (id) => /^\d+$/.test(id) && Number(id) <= 2147483647;

app.patch('/api/todos/:id', async (req, res) => {
  const completed = req.body?.completed;
  if (typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed는 true 또는 false여야 합니다' });
  }
  if (!validId(req.params.id)) return res.status(404).json({ error: '할 일을 찾을 수 없습니다' });
  const { rows } = await pool.query('UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *', [
    completed,
    req.params.id,
  ]);
  if (!rows.length) return res.status(404).json({ error: '할 일을 찾을 수 없습니다' });
  res.json(rows[0]);
});

app.delete('/api/todos/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: '할 일을 찾을 수 없습니다' });
  const { rowCount } = await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: '할 일을 찾을 수 없습니다' });
  res.status(204).end();
});

// Keeps stack traces and DB details out of responses.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? '서버 오류가 발생했습니다' : '잘못된 요청입니다' });
});
