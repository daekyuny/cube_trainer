# Cube Trainer

데스크톱과 모바일에서 3×3 큐브를 직접 돌려 보는 연습 앱입니다. 같은 큐브의 앞·오른쪽·위와 뒤·왼쪽·아래를 두 그림으로 동시에 표시합니다.

## 실행

Node.js 24.x와 npm을 사용합니다.

```sh
nvm use
npm ci
npm run dev
```

기본 주소: `http://localhost:5173`. 같은 네트워크의 모바일 기기에서 접속하려면 `npm run dev -- --host 0.0.0.0`을 실행하고 터미널의 Network 주소를 사용합니다.

## 현재 기능

- 큰 그림: 기본 F 빨강 / R 초록 / U 노랑. 작은 뒤집힌 그림: B 주황 / L 파랑 / D 흰색.
- 실제 조각 위치와 방향을 계산하는 여섯 면 회전 및 두 그림의 동기화된 애니메이션.
- `f r u d l b`: 해당 면을 밖에서 바라볼 때 시계 방향. `Shift` + 문자: 반시계 방향.
- `←` / `→`: 윗면에서 내려다본 전체 큐브의 반시계 / 시계 방향 90° 회전. `→` 후에는 기존 오른쪽 면이 앞면이 됩니다.
- 모바일 십자 버튼: 중앙 F, 왼쪽 L, 위 U, 오른쪽 R, 아래 D. 작은 B는 U와 R 사이에 있습니다.
- 화면 버튼용 시계/반시계 선택, 느린 회전, 이동 이력, 한 수 되돌리기.
- F2L 페어링: R/G/W 코너는 앞·오른쪽 위, R/G 엣지는 O면 뒤·위에 고정한 5가지 유형. W 방향·윗색에 따라 십자가와 다른 세 슬롯의 코너·엣지를 보존하는 최소 페어링 수순, 시연·직접 연습·상태 판정. Y층 페어까지만 연습하며 슬롯 삽입은 후속 단계입니다. 큐브 위에는 면 기호를 표시하지 않습니다.
- 수순 리셋은 큐브를 유지하고 기록·대기 입력만 비웁니다. 같은 배치 다시 / 현재 시작 상태로 되돌리기는 큐브도 정확한 시작 배치로 복원합니다.
- 프리셋 4개: 맞춘 큐브, 합법적인 25수 랜덤 섞기, 옆면 센터까지 맞춘 흰색 십자가, 흰색 아래 기준 1·2층 완성.
- 프리셋은 기본 방향으로 새로 시작하며 이력과 대기 입력을 비웁니다. 연습용 시작 상태는 매번 새로 생성됩니다.

상단 **F2L 페어링**을 선택하고 1번부터 연습해 보세요. 초보 층별 풀이와 십자가 만들기·조각 꺼내기·분리는 건너뜁니다. 번호를 누르면 바로 아래에 풀이가 펼쳐집니다. 옆의 ⇄ 버튼으로 RG/RB 대칭을 전환하고, 수순 문자를 누르거나 이전/다음으로 회전을 앞뒤로 확인하세요. 풀이 숨김으로 직접 연습할 수 있습니다. 전체 큐브를 돌려 뒷면에서 보더라도 빨강 앞 기준의 수순을 같은 시점에서 시연합니다. 수동 면 버튼과 키보드는 현재 화면 방향 기준입니다. 시작 조건과 학습 범위는 [SPEC](SPEC.md#f2l-페어링-훈련--확정)을 따릅니다.

참고 사진은 형태 확인에만 사용했습니다. 앱은 이미지 파일을 읽지 않으므로 사진을 삭제해도 동작합니다. 중간층 회전, 자유 시점 드래그, 임의 큐브 자동 풀이, 저장은 아직 없습니다.

## 개발과 검증

| 명령어             | 용도                                             |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | 개발 서버                                        |
| `npm run check`    | 타입·린트·포맷 검사                              |
| `npm test`         | Node 내장 테스트로 회전 규칙·프리셋·입력 큐 검증 |
| `npm run test:e2e` | Playwright로 키보드·화면 버튼·반응형 화면 검증   |
| `npm run format`   | 코드와 문서 포맷 정리                            |
| `npm run build`    | 타입 검사 및 프로덕션 빌드                       |
| `npm run preview`  | 빌드 결과 로컬 확인                              |

브라우저 테스트를 처음 실행할 때 `npx playwright install --with-deps chromium`으로 필요한 브라우저와 시스템 라이브러리를 준비합니다. GitHub CI에서도 동일하게 설치한 뒤 검사·단위 테스트·빌드·브라우저 테스트를 수행합니다. 실제 모바일 기기의 터치 및 성능 검증은 별도로 필요합니다.

## GitHub Pages 배포

배포 주소: **https://daekyuny.github.io/cube_trainer/**

`.github/workflows/ci.yml`의 **CI and Pages** 워크플로가 배포를 관리합니다.

- `main` push: 타입·린트·포맷, 단위 테스트, 일반 빌드와 브라우저 테스트, Pages 빌드와 브라우저 테스트가 모두 성공하면 자동 배포합니다.
- PR: 동일한 검증을 실행하며 배포하지 않습니다.
- 수동 실행: GitHub Actions에서 **CI and Pages → Run workflow → main**을 선택합니다. 다른 브랜치에서 수동 실행하면 검증만 수행합니다.
- 배포는 검증한 `dist/` 아티팩트를 그대로 사용합니다. 배포 job에만 Pages 쓰기 권한이 있으며 별도 배포 토큰을 저장할 필요가 없습니다.
- `main` 실행은 동시에 배포하지 않도록 직렬화하고, PR은 새 커밋이 들어오면 이전 검증을 취소합니다.

저장소 **Settings → Pages → Build and deployment → Source**는 **GitHub Actions**로 설정해야 합니다. 다른 저장소로 복제하여 배포하면 그 저장소에서도 Pages를 활성화하고 `vite.config.ts`의 Pages 경로와 `playwright.pages.config.ts`의 테스트 주소를 저장소 이름에 맞춰 변경합니다.

로컬에서 실제 배포 빌드를 확인하려면:

```sh
npm run build:pages
npm run test:pages
npm run preview -- --mode pages
```

미리보기 기본 주소는 `http://localhost:4173/cube_trainer/`입니다. Pages 빌드와 미리보기는 `/cube_trainer/`, 일반 `npm run dev`와 `npm run build`는 `/`를 사용합니다. `test:pages`는 기존 `dist/`를 검사하므로 먼저 `build:pages`를 실행해야 합니다. 브라우저 설치 방법은 위 개발·검증 절을 따릅니다.

배포 실패 시 Actions의 `check` 또는 `deploy` 로그를 확인합니다. 검사 실패 시 배포 job은 실행하지 않습니다. 이전 버전으로 돌아갈 때는 해당 변경을 되돌린 커밋을 `main`에 푸시하여 동일한 검증 후 다시 배포합니다. `dist/`나 별도 `gh-pages` 브랜치를 직접 커밋하지 않습니다.

설정 참고: [GitHub Pages 사용자 지정 워크플로](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite의 Pages 배포 가이드](https://vite.dev/guide/static-deploy.html#github-pages).

## 구조와 문서

Codex로 작업할 때는 저장소 루트의 [AGENTS.md](AGENTS.md)를 공통 작업 지침으로 사용합니다.

```text
src/app/                 화면 구성·반응형 스타일
src/domain/cube/         순수 상태 엔진·회전·프리셋
src/domain/f2l/          훈련 배치·수순·페어링 판정
src/features/simulator/  SVG 투영·애니메이션 세션
src/features/f2l/        F2L 설명·훈련 패널
tests/                  상태 엔진 및 브라우저 테스트
```

- [제품 명세 SPEC](SPEC.md): 제품 목표·요구사항·지침·제약·테스트 수용 기준
- [기술 구조](docs/ARCHITECTURE.md): 상태, 투영, 애니메이션 책임
- [작업 순서](docs/ROADMAP.md): 완료 항목과 다음 논의

현재 필요한 환경 변수나 외부 서비스는 없습니다. 개발 구성 참고: [Vite](https://vite.dev/guide/), [Playwright](https://playwright.dev/docs/test-configuration), [Node TypeScript 실행](https://nodejs.org/api/typescript.html).

## 다른 PC에서 이어서 개발

Git과 Node.js 24.x, Codex를 준비한 뒤 저장소를 clone합니다. GitHub와 Codex 인증은 각 PC에서 설정합니다.

```sh
git clone https://github.com/daekyuny/cube_trainer.git
cd cube_trainer
npm ci
npm run dev
```

이미 clone한 PC에서는 작업 트리와 현재 브랜치를 확인하고, 미커밋 변경이 없으며 원격 변경을 바로 반영할 수 있을 때 `git pull --ff-only`로 최신 내용을 받습니다. 의존성이 변경되면 `npm ci`를 다시 실행합니다. 다른 PC의 미푸시 작업은 전달되지 않습니다.

Codex에서 이 저장소 폴더를 프로젝트로 열고 새 세션을 시작하면 루트 `AGENTS.md`가 프로젝트 지침으로 로드됩니다. 기존 세션에서 파일을 갱신했다면 새 세션을 시작해 반영합니다. 개인 `AGENTS.override.md`나 하위 폴더 지침이 있으면 적용 지침이 달라질 수 있습니다. 자세한 동작은 [OpenAI 공식 AGENTS.md 문서](https://learn.chatgpt.com/docs/agent-configuration/agents-md)를 참고하세요.

공유하는 것은 코드와 작업 지침이며, PC별 Codex 대화 기록·권한·인증 설정은 이 저장소로 복제되지 않습니다. 진행 상황은 SPEC·기술 구조·ROADMAP과 Git 이력에 남깁니다.
