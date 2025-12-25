# 우리말샘 MCP 서버

우리말샘 OPEN API를 활용한 사전 검색 MCP(Model Context Protocol) 서버입니다. TypeScript로 구현되었으며, 로컬 실행과 Cloudflare Workers 배포를 모두 지원합니다.

## 특징

- 🔍 우리말샘 사전 단어 검색
- 🏠 로컬 실행 지원 (stdio 기반 MCP 프로토콜)
- ☁️ Cloudflare Workers 배포 지원 (완전 무료)
- 📝 저작권 준수 (CC BY-SA 2.0 KR)
- 📊 상세한 로깅 시스템

## 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn
- 우리말샘 OPEN API 키 (국립국어원 개발자 포털에서 발급)

## 설치

```bash
# 저장소 클론
git clone <repository-url>
cd malsaem

# 의존성 설치
npm install
```

## 설정

### 로컬 실행

1. `.env` 파일을 생성하고 API 키를 설정합니다:

```bash
cp .env.example .env
```

`.env` 파일에 다음 내용을 추가:

```
MALSAEM_API_KEY=your_api_key_here
```

### Cloudflare Workers 배포

1. Cloudflare 계정에 로그인하고 Wrangler를 설정합니다:

```bash
npm install -g wrangler
wrangler login
```

2. API 키를 Workers secrets로 설정합니다:

```bash
wrangler secret put MALSAEM_API_KEY
```

## 사용법

### 로컬 실행

#### 개발 모드

```bash
npm run dev
```

#### 프로덕션 모드

```bash
# 빌드
npm run build

# 실행
npm start
```

### MCP 클라이언트 설정 (Cursor 예시)

`cursor.json` 또는 MCP 설정 파일에 다음을 추가:

```json
{
  "mcpServers": {
    "malsaem": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "MALSAEM_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Cloudflare Workers 배포

#### 로컬 개발 (Workers 시뮬레이션)

```bash
npm run dev:worker
```

#### 배포

```bash
npm run deploy
```

배포 후 제공되는 URL로 API를 호출할 수 있습니다:

```bash
# GET 요청
curl "https://your-worker.workers.dev/search?word=사과&num=5"

# POST 요청
curl -X POST "https://your-worker.workers.dev/search" \
  -H "Content-Type: application/json" \
  -d '{"word": "사과", "num": 5}'
```

## 로그 모니터링

### Cloudflare Workers 로그

#### 실시간 로그 확인 (Wrangler Tail)

```bash
# 개발 환경 로그
npx wrangler tail --env development

# 프로덕션 환경 로그
npx wrangler tail

# 특정 필터링
npx wrangler tail --format pretty
```

#### Cloudflare Dashboard

1. [Cloudflare Dashboard](https://dash.cloudflare.com) 접속
2. Workers & Pages → 해당 Worker 선택
3. Logs 탭에서 실시간 로그 확인

### 로컬 MCP 서버 로그

로컬 실행 시 콘솔에 자동으로 로그가 출력됩니다:

```bash
npm run dev
```

로그 형식:

- `[INFO]`: 일반 정보 로그
- `[WARN]`: 경고 로그
- `[ERROR]`: 에러 로그
- `[DEBUG]`: 디버그 로그

### 로그 내용

로그에는 다음 정보가 포함됩니다:

- **요청 정보**: HTTP 메서드, 경로, 파라미터
- **API 호출**: 검색 단어, 결과 개수, 성공/실패
- **응답 정보**: HTTP 상태 코드, 응답 시간
- **에러 정보**: 에러 메시지, 스택 트레이스
- **성능 메트릭**: API 호출 시간, 전체 요청 시간

### 로그 예시

```json
{
  "timestamp": "2024-12-25T12:00:00.000Z",
  "level": "info",
  "message": "Request received",
  "context": "MalsaemMCP",
  "data": {
    "method": "GET",
    "path": "/search",
    "params": {
      "word": "사과",
      "num": "10"
    }
  }
}
```

## API 문서

### 로컬 MCP Tool: `search_word`

- **설명**: 우리말샘 사전에서 단어를 검색합니다
- **입력 파라미터**:
  - `word` (string, required): 검색할 단어
  - `num` (number, optional): 검색 결과 개수 (기본값: 10, 최대: 100)
- **출력**: 단어의 뜻, 품사, 예문 등 사전 정보
- **저작권**: 응답에 "출처: 우리말샘(국립국어원), CC BY-SA 2.0 KR" 표시 포함

### Cloudflare Workers API: `/search`

#### GET 요청

```
GET /search?word={단어}&num={개수}
```

#### POST 요청

```json
POST /search
Content-Type: application/json

{
  "word": "단어",
  "num": 10
}
```

#### 응답 형식

```json
{
  "success": true,
  "total": 5,
  "items": [
    {
      "word": "사과",
      "pronunciation": "사과",
      "pos": "명사",
      "sense": [
        {
          "definition": "장미과의 과일나무",
          "example": ["사과를 따다"]
        }
      ]
    }
  ],
  "copyright": "우리말샘(국립국어원), CC BY-SA 2.0 KR"
}
```

## 프로젝트 구조

```
malsaem/
├── package.json          # 프로젝트 의존성 및 스크립트
├── tsconfig.json         # TypeScript 설정
├── wrangler.toml         # Cloudflare Workers 설정
├── .env.example          # 환경 변수 예시 파일
├── src/
│   ├── index.ts          # 로컬 MCP 서버 진입점 (stdio)
│   ├── worker.ts          # Cloudflare Workers 진입점 (HTTP)
│   ├── api/
│   │   └── malsaem.ts    # 우리말샘 API 클라이언트
│   ├── types/
│   │   └── malsaem.ts    # API 응답 타입 정의
│   └── utils/
│       └── logger.ts     # 로깅 유틸리티
└── README.md             # 프로젝트 문서
```

## 비용

- **Cloudflare Workers 무료 티어**:
  - 일일 100,000 요청 무료
  - 월 10만 요청 무료
  - 추가 비용 없이 운영 가능
- **로컬 실행**: 완전 무료

## 저작권

- **데이터 출처**: 우리말샘(국립국어원)
- **라이선스**: 크리에이티브 커먼즈 저작자표시-동일조건변경허락 2.0 대한민국 (CC BY-SA 2.0 KR)
- **저작권 준수**:
  - 모든 API 응답에 저작자 표시 포함
  - 데이터는 조회만 하며 변경하지 않음
  - 상업적 용도까지 자유롭게 이용 가능

## 개발

### 타입 체크

```bash
npm run typecheck
```

### 빌드

```bash
npm run build
```

## 문제 해결

### API 키 오류

- `.env` 파일에 `MALSAEM_API_KEY`가 올바르게 설정되었는지 확인하세요
- Workers 배포 시 `wrangler secret put MALSAEM_API_KEY`로 설정했는지 확인하세요
- API 키는 [국립국어원 개발자 포털](https://opendict.korean.go.kr/service/openApiInfo)에서 발급받을 수 있습니다

### 우리말샘 API 문서

- [우리말샘 OPEN API 사용 안내](https://opendict.korean.go.kr/service/openApiInfo)
- API 엔드포인트: `https://opendict.korean.go.kr/api/search`
- 현재 코드는 실제 API 문서에 맞게 구현되어 있습니다

### 요청 제한

- **우리말샘 API**: 일일 50,000건 제한
- **Cloudflare Workers**: 일일 100,000건 제한 (무료 티어)
- 제한 초과 시 명확한 에러 메시지와 함께 429 상태 코드 반환

## 라이선스

MIT
