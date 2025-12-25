/**
 * 우리말샘 MCP 서버 (Cloudflare Workers용)
 * MCP over HTTP 프로토콜로 단어 검색 기능 제공
 */

import { MalsaemApiClient, getApiKey } from "./api/malsaem.js";
import { handleMcpRequest } from "./handlers.js";
import { logger } from "./utils/logger.js";

/**
 * Cloudflare Workers 환경 타입
 */
interface Env {
  MALSAEM_API_KEY: string;
}

/**
 * CORS 헤더
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * CORS 응답 생성
 */
function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * 에러 응답 생성
 */
function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * 성공 응답 생성
 */
function successResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// MCP 핸들러는 src/handlers.ts에서 공통으로 관리

/**
 * Workers 진입점
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startTime = Date.now();
    try {
      // CORS preflight 요청 처리
      if (request.method === "OPTIONS") {
        return handleCors();
      }

      const url = new URL(request.url);
      logger.logRequest(request.method, url.pathname, {
        query: Object.fromEntries(url.searchParams),
      });

      // API 클라이언트 초기화
      let apiClient: MalsaemApiClient;
      try {
        const apiKey = getApiKey(env as unknown as Record<string, unknown>);
        apiClient = new MalsaemApiClient(apiKey);
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "API 키 설정 오류",
          500
        );
      }

      // 루트 경로: MCP 서버 정보 제공
      if (url.pathname === "/" || url.pathname === "") {
        const response = successResponse({
          name: "우리말샘 MCP 서버",
          version: "1.0.0",
          protocol: "MCP over HTTP",
          endpoint: "/mcp",
          copyright: "우리말샘(국립국어원), CC BY-SA 2.0 KR",
        });
        logger.logResponse(200, Date.now() - startTime);
        return response;
      }

      // MCP over HTTP 엔드포인트 (PlayMCP용)
      if (url.pathname === "/mcp") {
        // POST 요청만 지원
        if (request.method !== "POST") {
          return errorResponse(
            "MCP 엔드포인트는 POST 메서드만 지원합니다.",
            405
          );
        }

        try {
          // 요청 본문이 비어있을 수 있음 (PlayMCP 초기 연결)
          let mcpRequest: {
            jsonrpc?: string;
            method?: string;
            params?: {
              name?: string;
              arguments?: Record<string, unknown>;
            };
            id?: string | number;
          };

          try {
            const bodyText = await request.text();
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
          } catch (parseError) {
            // JSON 파싱 실패 시 기본값
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

          // 공통 핸들러로 MCP 요청 처리
          let response: {
            jsonrpc: string;
            id?: string | number;
            result?: unknown;
            error?: { code: number; message: string };
          };

          try {
            // API 호출 로깅 (tools/call인 경우)
            if (mcpRequest.method === "tools/call") {
              const toolName = mcpRequest.params?.name as string;
              const args = mcpRequest.params?.arguments as
                | Record<string, unknown>
                | undefined;
              if (toolName === "search_word" && args?.word) {
                const word = args?.word as string;
                const num = (args?.num as number) || 10;
                logger.logApiCall(word.trim(), num);
              }
            }

            // 공통 핸들러 호출
            response = await handleMcpRequest(apiClient, mcpRequest);

            // API 호출 완료 로깅
            if (mcpRequest.method === "tools/call") {
              const toolName = mcpRequest.params?.name as string;
              const args = mcpRequest.params?.arguments as
                | Record<string, unknown>
                | undefined;
              if (toolName === "search_word" && args?.word) {
                const apiDuration = Date.now() - startTime;
                logger.logApiCall(
                  args.word as string,
                  (args.num as number) || 10,
                  apiDuration,
                  true
                );
              }
            }

            logger.logResponse(200, Date.now() - startTime);

            // MCP JSON-RPC 2.0 응답
            return new Response(JSON.stringify(response), {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            });
          } catch (error) {
            logger.error(
              "MCP request error",
              error instanceof Error ? error : new Error(String(error))
            );
            const errorResponse = {
              jsonrpc: "2.0",
              id: mcpRequest.id,
              error: {
                code: -32000,
                message: error instanceof Error ? error.message : String(error),
              },
            };

            // MCP JSON-RPC 2.0 에러 응답
            return new Response(JSON.stringify(errorResponse), {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            });
          }
        } catch (error) {
          logger.error(
            "MCP request parse error",
            error instanceof Error ? error : new Error(String(error))
          );
          return errorResponse("Invalid MCP request format", 400);
        }
      }

      logger.warn("Unknown endpoint", { path: url.pathname });
      return errorResponse("알 수 없는 엔드포인트입니다.", 404);
    } catch (error) {
      // Cloudflare Workers 자체 오류 처리 (요청 제한 등)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      logger.error("Workers error", errorObj, {
        duration: Date.now() - startTime,
      });

      // Workers 요청 제한 오류 감지
      if (
        errorMessage.includes("limit") ||
        errorMessage.includes("quota") ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("429")
      ) {
        logger.error("Workers rate limit exceeded", errorObj);
        return errorResponse(
          "Cloudflare Workers 요청 한도 초과: 일일 100,000건 제한에 도달했습니다. 내일 다시 시도해주세요.",
          429
        );
      }

      // 기타 Workers 오류
      return errorResponse(`서버 오류가 발생했습니다: ${errorMessage}`, 500);
    }
  },
};
