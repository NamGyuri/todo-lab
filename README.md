# Todo

`web/`(React) → `api/`(Express) → PostgreSQL

## 실행

PostgreSQL에 데이터베이스를 하나 만들어 두세요. `todos` 테이블은 API가 시작할 때 자동으로 만듭니다.

```powershell
# API (http://localhost:3000)
cd api
npm install
$env:DB_HOST="localhost"; $env:DB_PORT="5432"; $env:DB_USER="postgres"; $env:DB_PASSWORD="비밀번호"; $env:DB_NAME="todo"
npm start

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

`DB_*` 환경 변수를 설정한 터미널의 `api/`에서 `npm test`를 실행합니다. 실제 PostgreSQL이 필요합니다.
