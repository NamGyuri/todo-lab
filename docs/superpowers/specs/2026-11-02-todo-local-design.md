# Todo 앱 1단계(로컬 3티어) 스펙

## 목표

같은 앱을 VM 직접 설치, Docker Compose, Kubernetes(kind) 순서로 배포하며 방식별 차이를 겪어 보는 개인 프로젝트의 1단계다. 이번 범위는 내 PC에서 화면 → API → DB가 동작하는 것까지다.

## 요구사항

### 구성

| 티어 | 폴더/위치 | 기술 |
| --- | --- | --- |
| 웹 | `web/` | React + Vite |
| API | `api/` | Express |
| DB | WSL Ubuntu 24.04 | apt로 설치한 PostgreSQL |

웹과 API는 Windows에서 실행하고, Windows의 `localhost`로 WSL의 PostgreSQL에 접속한다. 개발 중에는 Vite가 `/api` 요청을 `localhost:3000`의 API로 전달한다.

### 기능

모든 사용자가 하나의 목록을 함께 쓴다.

| 기능 | 메서드와 경로 | 본문 |
| --- | --- | --- |
| 조회 | `GET /api/todos` | 없음 |
| 추가 | `POST /api/todos` | `{ "title": "..." }` (앞뒤 공백 제거 후 저장, 입력 기준 1~500자) |
| 완료, 완료 취소 | `PATCH /api/todos/:id` | `{ "completed": true 또는 false }` |
| 제목 수정 | `PATCH /api/todos/:id` | `{ "title": "..." }` (앞뒤 공백 제거 후 1~500자, 아니면 400) |
| 삭제 | `DELETE /api/todos/:id` | 없음 |

### 설정과 저장소

- DB 접속 정보는 코드에 쓰지 않고 `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 환경 변수로만 받는다. 기본값은 두지 않는다.
- `.env`는 `.gitignore`에 넣어 Git에 올리지 않는다.
- 프로젝트는 Git 저장소로 관리한다.

## 범위 제외

- 로그인과 사용자별 목록 (검토 후 제외: 과제의 최소 기능에 없고, `curl localhost/api/todos` 확인 절차와 맞지 않음)
- 인터넷 공개와 Render, Railway, AWS 같은 외부 서비스
- 2~4단계 배포 파일 (Dockerfile, `compose.yaml`, systemd 유닛, Nginx 설정, Kubernetes 매니페스트)

## 현재 상태

앱 코드는 작성되어 있고 앱 코드 변경은 필요 없다. API 테스트 3개는 임시 PostgreSQL에서 통과했고, UI 흐름은 jsdom으로만 확인했다. 아직 커밋이 없다.

## 남은 작업

1. WSL Ubuntu에 PostgreSQL을 설치하고, `todo` DB와 전용 계정을 만든다. 비밀번호는 저장소 파일에 남기지 않는다.
2. Windows에서 그 DB로 API와 웹을 실행한다.
3. 완료 기준을 확인한다.
4. 앱 코드와 문서를 커밋한다.

## 완료 기준

- 실제 브라우저에서 할 일을 추가, 완료, 삭제할 수 있다.
- 할 일을 추가한 뒤 새로고침해도 남아 있다.
- API를 재시작해도 데이터가 남아 있다.
- WSL의 PostgreSQL을 대상으로 `npm test`가 통과한다.
- `git status`와 커밋 내용에 `.env`, `node_modules/`, 비밀번호가 없다.

## 알려진 제약과 다음 단계 참고

- 인증이 없으므로 인터넷에 공개하지 않고, 포트 전달로 본인만 접속한다.
- WSL이 꺼져 있으면 DB에 접속할 수 없다.
- API는 시작할 때 DB에 연결하지 못하면 종료한다. 2~4단계에서는 재시작 설정이 필요하다.
- 운영 환경에서는 Vite 프록시를 쓰지 않으므로, 2단계는 Nginx, 3단계는 웹 컨테이너, 4단계는 Ingress가 `/api`를 API로 전달해야 한다.
