import { app, init } from './app.js';

await init();
const port = process.env.PORT ?? 3000;
// Express 5 passes listen errors such as EADDRINUSE to this callback.
app.listen(port, (err) => {
  if (err) throw err;
  console.log(`API listening on ${port}`);
});
