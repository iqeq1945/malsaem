# 우리말샘 MCP 서버

우리말샘 OPEN API를 활용한 사전 검색 MCP(Model Context Protocol) 서버입니다. TypeScript로 구현되었으며, PlayMCP 플랫폼에 등록하여 사용할 수 있습니다.

## 특징

- 🔍 우리말샘 사전 단어 검색
- ☁️ Cloudflare Workers 배포 지원 (완전 무료)
- 🌐 MCP over HTTP 프로토콜 지원 (PlayMCP 호환)
- 📝 저작권 준수 (CC BY-SA 2.0 KR)
- 📊 상세한 로깅 시스템

## 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Cloudflare 계정
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

### 로컬 개발 (Workers 시뮬레이션)

```bash
npm run dev:worker
```

### 배포

```bash
npm run deploy
```

배포 후 제공되는 URL로 MCP 엔드포인트에 접근할 수 있습니다:

```
https://your-worker.workers.dev/mcp
```

## PlayMCP 등록

1. [PlayMCP 플랫폼](https://playmcp.kakao.com)에 접속하여 로그인합니다.

2. "새로운 MCP 서버 등록"을 클릭합니다.

3. 다음 정보를 입력합니다:

   - **MCP Endpoint**: `https://your-worker.workers.dev/mcp`
   - **인증 방식**: "인증 사용하지 않음"
   - **대화 예시** (3개):
     - "사과의 뜻을 알려줘"
     - "한국어 단어 '사랑'의 의미를 검색해줘"
     - "단어 '컴퓨터'의 사전적 정의를 찾아줘"

4. "정보 불러오기" 버튼을 클릭하여 서버 정보를 확인합니다.

5. 정상 동작 확인 후 "등록 및 심사 요청" 또는 "임시 등록"을 클릭합니다.

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
    "method": "POST",
    "path": "/mcp",
    "params": {
      "method": "tools/call",
      "name": "search_word",
      "arguments": {
        "word": "사과",
        "num": 10
      }
    }
  }
}
```

## API 문서

### MCP Tool: `search_word`

- **설명**: 우리말샘 사전에서 단어를 검색합니다
- **입력 파라미터**:
  - `word` (string, required): 검색할 단어
  - `num` (number, optional): 검색 결과 개수 (기본값: 10, 최대: 100)
- **출력**: 단어의 뜻, 품사, 예문 등 사전 정보
- **저작권**: 응답에 "출처: 우리말샘(국립국어원), CC BY-SA 2.0 KR" 표시 포함

### MCP over HTTP 엔드포인트: `/mcp`

#### 요청 형식

```json
POST /mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_word",
    "arguments": {
      "word": "사과",
      "num": 10
    }
  },
  "id": 1
}
```

#### 응답 형식

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "검색 결과..."
      }
    ]
  }
}
```

#### 지원하는 메서드

- `tools/list`: 사용 가능한 도구 목록 조회
- `tools/call`: 도구 실행 (search_word)

## 프로젝트 구조

```
malsaem/
├── package.json          # 프로젝트 의존성 및 스크립트
├── tsconfig.json         # TypeScript 설정
├── wrangler.toml         # Cloudflare Workers 설정
├── src/
│   ├── worker.ts         # Cloudflare Workers 진입점 (MCP over HTTP)
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

### PlayMCP 등록 오류

- MCP Endpoint URL이 정확한지 확인하세요: `https://your-worker.workers.dev/mcp`
- "정보 불러오기" 버튼을 눌러 서버가 정상 동작하는지 확인하세요
- Cloudflare Workers가 정상 배포되었는지 확인하세요

## 라이선스

MIT
