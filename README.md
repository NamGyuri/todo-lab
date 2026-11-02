# Todo

`web/`(React) → `api/`(Express) → PostgreSQL

## Docker로 실행

```bash
cp .env.example .env   # DB_PASSWORD를 바꾸세요
docker compose up -d --build
curl localhost:8088/api/todos
```

웹은 http://localhost:8088 에서 열리고, nginx가 `/api`를 `api` 컨테이너로 전달합니다. 데이터는 `db-data` 볼륨에 저장되므로 `docker compose down`으로는 지워지지 않습니다. DB 비밀번호는 볼륨을 처음 만들 때 적용되므로, 나중에 `.env`만 바꾸면 접속이 실패합니다.

## 로컬에서 실행

PostgreSQL에 데이터베이스를 하나 만들어 두세요. `todos` 테이블은 API가 시작할 때 자동으로 만듭니다.

`api/.env`에 접속 정보를 적습니다. 이 파일은 Git에 올라가지 않습니다.

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=todo
DB_PASSWORD=비밀번호
DB_NAME=todo
```

```powershell
# API (http://localhost:3000)
cd api
npm install
node --env-file=.env server.js

# 웹 (http://localhost:5173), 다른 터미널에서
cd web
npm install
npm run dev
```

웹은 `/api` 요청을 `localhost:3000`으로 프록시합니다. API 포트를 `PORT`로 바꾸면 `web/vite.config.js`도 같이 바꾸세요.

## API

| 메서드 | 경로 | 본문 | 동작 |
| --- | --- | --- | --- |
| GET | `/api/todos` | | 조회 |
| POST | `/api/todos` | `{ "title": "..." }` | 추가 |
| PATCH | `/api/todos/:id` | `{ "completed": true }` | 완료 / 완료 취소 |
| DELETE | `/api/todos/:id` | | 삭제 |

## 테스트

`api/`에서 `node --env-file=.env --test`를 실행합니다. 실제 PostgreSQL이 필요합니다.
