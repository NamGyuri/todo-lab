import { setTimeout as sleep } from 'node:timers/promises';
import { app, init } from './app.js';

const RETRY_MS = 2000;

// The DB may not be accepting connections yet when the API starts, so keep trying.
while (true) {
  try {
    await init();
    break;
  } catch (err) {
    console.error(`DB 연결 실패, ${RETRY_MS / 1000}초 후 다시 시도합니다: ${err.message}`);
    await sleep(RETRY_MS);
  }
}

const port = process.env.PORT ?? 3000;
// Express 5 passes listen errors such as EADDRINUSE to this callback.
app.listen(port, (err) => {
  if (err) throw err;
  console.log(`API listening on ${port}`);
});
