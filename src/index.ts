#!/usr/bin/env node

/**
 * 우리말샘 MCP 서버 (로컬 실행용)
 * stdio를 통해 MCP 프로토콜로 통신
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { MalsaemApiClient, getApiKey } from "./api/malsaem.js";
import { config } from "dotenv";
import { logger } from "./utils/logger.js";

// 환경 변수 로드
config();

// API 클라이언트 초기화
let apiClient: MalsaemApiClient;

try {
  const apiKey = getApiKey(process.env);
  apiClient = new MalsaemApiClient(apiKey);
  logger.info("MCP 서버 초기화 완료");
} catch (error) {
  logger.error(
    "API 클라이언트 초기화 실패",
    error instanceof Error ? error : new Error(String(error))
  );
  process.exit(1);
}

// MCP 서버 생성
const server = new Server(
  {
    name: "malsaem-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 제공
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_word",
        description:
          "우리말샘 사전에서 단어를 검색합니다. 단어의 뜻, 품사, 예문 등의 정보를 제공합니다.",
        inputSchema: {
          type: "object",
          properties: {
            word: {
              type: "string",
              description: "검색할 단어",
            },
            num: {
              type: "number",
              description: "검색 결과 개수 (기본값: 10, 최대: 100)",
              default: 10,
              minimum: 1,
              maximum: 100,
            },
          },
          required: ["word"],
        },
      } as Tool,
    ],
  };
});

// 도구 실행 처리
server.setRequestHandler(
  CallToolRequestSchema,
  async (request: {
    params: { name: string; arguments?: Record<string, unknown> };
  }) => {
    const startTime = Date.now();
    const { name, arguments: args } = request.params;

    logger.logRequest("MCP", `tool:${name}`, args);

    if (name === "search_word") {
      const word = args?.word as string | undefined;
      const num = (args?.num as number | undefined) || 10;

      try {
        if (!word) {
          logger.warn("Missing word parameter");
          return {
            content: [
              {
                type: "text",
                text: "오류: 검색할 단어를 입력해주세요.",
              },
            ],
            isError: true,
          };
        }

        const apiStartTime = Date.now();
        logger.logApiCall(word, num);
        const result = await apiClient.searchWord(word, num);
        const apiDuration = Date.now() - apiStartTime;
        logger.logApiCall(word, num, apiDuration, true);

        // 결과 포맷팅
        const formatted = apiClient.formatSearchResult(result);

        logger.logResponse(200, Date.now() - startTime, {
          total: result.channel?.total || 0,
          apiDuration: `${apiDuration}ms`,
        });

        return {
          content: [
            {
              type: "text",
              text: formatted,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorObj =
          error instanceof Error ? error : new Error(String(error));

        logger.error("Tool error", errorObj, { word, num });

        let errorText = `오류: ${errorMessage}`;
        if (errorMessage.includes("요청 한도 초과")) {
          errorText = `⚠️ 요청 한도 초과\n\n${errorMessage}\n\n우리말샘 OPEN API는 일일 50,000건의 요청 제한이 있습니다. 내일 다시 시도해주세요.`;
        } else if (
          errorMessage.includes("인증 오류") ||
          errorMessage.includes("API 키")
        ) {
          errorText = `🔑 인증 오류\n\n${errorMessage}\n\nAPI 키를 확인해주세요.`;
        }

        return {
          content: [
            {
              type: "text",
              text: errorText,
            },
          ],
          isError: true,
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `알 수 없는 도구: ${name}`,
        },
      ],
      isError: true,
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("우리말샘 MCP 서버가 시작되었습니다.");
}

main().catch((error) => {
  logger.error(
    "서버 시작 실패",
    error instanceof Error ? error : new Error(String(error))
  );
  process.exit(1);
});
