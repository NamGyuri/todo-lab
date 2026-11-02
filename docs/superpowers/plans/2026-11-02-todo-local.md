# Todo 앱 1단계 마무리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 작성된 앱을 WSL의 실제 PostgreSQL에 연결해 완료 기준을 확인하고 커밋한다.

**Architecture:** 웹(Vite, 5173)과 API(Express, 3000)는 Windows에서 실행하고, DB는 WSL Ubuntu 24.04의 PostgreSQL(5432)을 Windows의 `localhost`로 접속한다.

**Tech Stack:** React, Vite, Express 5, pg, PostgreSQL(apt), Node.js 24

**Spec:** `docs/superpowers/specs/2026-11-02-todo-local-design.md`

## Global Constraints

- DB 접속 정보는 `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 환경 변수로만 받고, 코드에 쓰지 않는다.
- `.env`는 Git에 올리지 않는다. 비밀번호를 저장소 파일, 커밋, 명령 기록에 남기지 않는다.
- 앱 코드는 바꾸지 않는다. 확인 중 버그가 나오면 멈추고 사용자에게 보고한다.
- 2~4단계 배포 파일을 만들지 않는다.

## Review Focus

- 한글 제목: 저장 후 새로고침해도 깨지지 않아야 한다 (Task 2 Step 4).
- DB가 꺼진 상태에서 시작한 API: 환경 변수 문제가 아니라 연결 오류를 내고 종료해야 한다 (Task 2 Step 6).
- 실행 중 DB 중단: 화면에 오류가 보이고, DB 복구 후 API 재시작 없이 다시 동작해야 한다 (Task 2 Step 6).
- 테스트 실행: 사용자가 만든 기존 행을 지우지 않아야 한다 (Task 2 Step 5).
- `.env` 누락 위험: 커밋 대상에 `.env`가 들어가지 않아야 한다 (Task 3 Step 1).

---

### Task 1: WSL에 PostgreSQL 준비

**Files:**
- Create: `api/.env` (Git 제외)

**Interfaces:**
- Produces: `api/.env`의 `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USER=todo`, `DB_PASSWORD=<사용자가 정한 값>`, `DB_NAME=todo`

- [ ] **Step 1: 설치** (`sudo` 비밀번호 입력이 필요하면 사용자가 직접 실행)

Run: `wsl -d Ubuntu-24.04 -- sudo apt-get update` 후 `wsl -d Ubuntu-24.04 -- sudo apt-get install -y postgresql`
Expected: `wsl -d Ubuntu-24.04 -- pg_lsclusters`에 `online` 표시

- [ ] **Step 2: 계정과 DB 생성** (비밀번호는 사용자가 프롬프트에 직접 입력)

Run: `wsl -d Ubuntu-24.04 -- sudo -u postgres createuser --pwprompt todo` 후 `wsl -d Ubuntu-24.04 -- sudo -u postgres createdb -O todo -E UTF8 -l C.UTF-8 -T template0 todo`
Expected: `wsl -d Ubuntu-24.04 -- sudo -u postgres psql -d todo -Atc "SHOW server_encoding"` 결과가 `UTF8`

- [ ] **Step 3: `api/.env` 작성** (사용자가 직접 비밀번호 입력)

`git check-ignore api/.env` 출력이 `api/.env`인지 확인한다.

- [ ] **Step 4: Windows에서 접속 확인**

Run (`api/`): `node --env-file=.env server.js`
Expected: `API listening on 3000`. 다른 터미널의 `curl.exe http://localhost:3000/api/todos` 결과가 JSON 배열

### Task 2: 완료 기준 확인

**Interfaces:**
- Consumes: Task 1의 `api/.env`

웹은 `web/`에서 `npm run dev`로 실행한다. WSL은 터미널 하나를 열어 둔 채로 진행한다.

- [ ] **Step 1: 브라우저 동작** (브라우저 도구가 localhost를 차단하므로 사용자가 직접 확인)

`http://localhost:5173`에서 할 일 추가, 완료, 삭제가 된다.

- [ ] **Step 2: 새로고침 유지**

할 일을 추가하고 새로고침해도 남아 있다.

- [ ] **Step 3: API 재시작 유지**

API를 껐다 켠 뒤 `curl.exe http://localhost:3000/api/todos`에 그 할 일이 있다.

- [ ] **Step 4: 한글 확인**

`우유 사기`를 추가하고 새로고침해도 그대로 표시된다.

- [ ] **Step 5: 실제 DB 테스트**

Run (`api/`): `node --env-file=.env --test`
Expected: 3개 통과, Step 2에서 남긴 할 일이 그대로 있음

- [ ] **Step 6: DB 중단 동작**

`wsl -d Ubuntu-24.04 -- sudo service postgresql stop` 후 화면에서 할 일을 추가한다. Expected: 빨간 오류 문구가 보이고 API 프로세스는 살아 있다. 이 상태에서 API를 하나 더 시작하면(`$env:PORT=3001`) 연결 오류로 종료된다. `sudo service postgresql start` 후 처음 API에서 추가가 다시 된다.

### Task 3: 커밋

**Files:**
- 커밋 대상: `.gitignore`, `CLAUDE.md`, `README.md`, `api/`, `web/`, `docs/`

- [ ] **Step 1: 커밋 대상 점검**

Run: `git add .gitignore CLAUDE.md README.md api web docs` 후 `git diff --cached --name-only`
Expected: `.env`, `node_modules/`, `dist/`가 없음. `git grep --cached -n "<실제 비밀번호>"` 결과가 없음(사용자 확인)

- [ ] **Step 2: 작성자 확인**

`git config user.name`과 `git config user.email`을 확인한다. 이름이 비정상이면(이전 상태 정보에 `[GitHub`로 표시됨) 커밋하지 말고 사용자에게 값을 묻는다.

- [ ] **Step 3: 커밋**

저장소의 첫 커밋이므로 `master`에 만든다. 메시지 끝에 지정된 Co-Authored-By 줄을 넣는다.

```bash
git commit -m "feat: add 3-tier todo app"
```

Expected: `git status --short`가 비어 있음. 원격 저장소 push는 하지 않는다.
