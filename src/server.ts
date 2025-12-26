/**
 * 로컬 테스트용 HTTP 서버
 * MCP over HTTP 프로토콜로 단어 검색 기능 제공
 */

import http from "http";
import { MalsaemApiClient, getApiKey } from "./api/malsaem.js";
import { handleMcpRequest } from "./handlers.js";
import { logger } from "./utils/logger.js";
import dotenv from "dotenv";

// 환경변수 로드
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function handleCors(res: http.ServerResponse): void {
  res.writeHead(204, corsHeaders);
  res.end();
}

function errorResponse(
  res: http.ServerResponse,
  message: string,
  status: number = 400
): void {
  res.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json",
  });
  res.end(
    JSON.stringify({
      success: false,
      error: message,
    })
  );
}

function successResponse(
  res: http.ServerResponse,
  data: unknown,
  status: number = 200
): void {
  res.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(data));
}

// MCP JSON-RPC 2.0 형식으로 응답

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const startTime = Date.now();

  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return handleCors(res);
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    logger.logRequest(req.method || "UNKNOWN", url.pathname, {
      query: Object.fromEntries(url.searchParams),
    });

    // API 클라이언트 초기화
    let apiClient: MalsaemApiClient;
    try {
      const apiKey = getApiKey(process.env as Record<string, unknown>);
      apiClient = new MalsaemApiClient(apiKey);
    } catch (error) {
      return errorResponse(
        res,
        error instanceof Error ? error.message : "API 키 설정 오류",
        500
      );
    }

    // 루트 경로
    if (url.pathname === "/" || url.pathname === "") {
      const response = {
        name: "우리말샘 MCP 서버",
        version: "1.0.0",
        protocol: "MCP over HTTP",
        endpoint: "/mcp",
        copyright: "우리말샘(국립국어원), CC BY-SA 2.0 KR",
      };
      logger.logResponse(200, Date.now() - startTime);
      return successResponse(res, response);
    }

    // MCP 엔드포인트
    if (url.pathname === "/mcp" || url.pathname === "/mcp/v1") {
      if (req.method !== "POST") {
        return errorResponse(
          res,
          "MCP 엔드포인트는 POST 메서드만 지원합니다.",
          405
        );
      }

      try {
        // 요청 본문 읽기
        let bodyText = "";
        for await (const chunk of req) {
          bodyText += chunk.toString();
        }

        let mcpRequest: {
          jsonrpc?: string;
          method?: string;
          params?: {
            name?: string;
            arguments?: Record<string, unknown>;
          };
          id?: string | number;
        };

        if (bodyText.trim()) {
          mcpRequest = JSON.parse(bodyText);
        } else {
          // 빈 요청: 초기 연결 - tools/list 반환
          mcpRequest = {
            jsonrpc: "2.0",
            method: "tools/list",
            id: 1,
          };
        }

        logger.logRequest(
          "MCP",
          mcpRequest.method || "unknown",
          mcpRequest.params
        );

        // MCP 요청 처리
        const response = await handleMcpRequest(apiClient, mcpRequest);

        logger.logResponse(200, Date.now() - startTime);

        // MCP JSON-RPC 2.0 응답
        return successResponse(res, response);
      } catch (error) {
        logger.error(
          "MCP request error",
          error instanceof Error ? error : new Error(String(error))
        );

        const errorResponse = {
          jsonrpc: "2.0",
          id: undefined,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : String(error),
          },
        };

        return successResponse(res, errorResponse);
      }
    }

    logger.warn("Unknown endpoint", { path: url.pathname });
    return errorResponse(res, "알 수 없는 엔드포인트입니다.", 404);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObj = error instanceof Error ? error : new Error(String(error));

    logger.error("Server error", errorObj, {
      duration: Date.now() - startTime,
    });

    return errorResponse(res, `서버 오류가 발생했습니다: ${errorMessage}`, 500);
  }
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(
    `🚀 로컬 MCP 서버가 http://localhost:${PORT} 에서 실행 중입니다.`
  );
  console.log(`📡 MCP 엔드포인트: http://localhost:${PORT}/mcp`);
  console.log(`\nMCP Inspector로 테스트하려면:`);
  console.log(
    `  npx @modelcontextprotocol/inspector http://localhost:${PORT}/mcp`
  );
});
