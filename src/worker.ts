/**
 * 우리말샘 MCP 서버 (Cloudflare Workers용)
 * HTTP API로 단어 검색 기능 제공
 */

import { MalsaemApiClient, getApiKey } from "./api/malsaem.js";
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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

      // 루트 경로: API 정보 제공
      if (url.pathname === "/" || url.pathname === "") {
        const response = successResponse({
          name: "우리말샘 MCP 서버",
          version: "1.0.0",
          endpoints: {
            "/search": "단어 검색 (GET 또는 POST)",
          },
          copyright: "우리말샘(국립국어원), CC BY-SA 2.0 KR",
        });
        logger.logResponse(200, Date.now() - startTime);
        return response;
      }

      // 검색 엔드포인트
      if (url.pathname === "/search") {
        let word: string | undefined;
        let num: number = 10;
        try {
          if (request.method === "GET") {
            // GET 요청: 쿼리 파라미터에서 추출
            word = url.searchParams.get("word") || undefined;
            const numParam = url.searchParams.get("num");
            if (numParam) {
              num = parseInt(numParam, 10);
              if (isNaN(num) || num < 1 || num > 100) {
                return errorResponse(
                  "num 파라미터는 1-100 사이의 숫자여야 합니다."
                );
              }
            }
          } else if (request.method === "POST") {
            // POST 요청: JSON body에서 추출
            const body = (await request.json()) as {
              word?: string;
              num?: number;
            };
            word = body.word;
            if (body.num !== undefined) {
              num = body.num;
              if (num < 1 || num > 100) {
                return errorResponse(
                  "num 파라미터는 1-100 사이의 숫자여야 합니다."
                );
              }
            }
          } else {
            return errorResponse(
              "지원하지 않는 HTTP 메서드입니다. GET 또는 POST를 사용해주세요.",
              405
            );
          }

          if (!word || word.trim().length === 0) {
            logger.warn("Missing word parameter");
            return errorResponse("word 파라미터가 필요합니다.");
          }

          const apiStartTime = Date.now();
          logger.logApiCall(word.trim(), num);
          const result = await apiClient.searchWord(word.trim(), num);
          const apiDuration = Date.now() - apiStartTime;
          logger.logApiCall(word.trim(), num, apiDuration, true);

          // JSON 형식으로 반환
          const response = apiClient.formatSearchResultJson(result);
          logger.logResponse(200, Date.now() - startTime, {
            total: result.channel?.total || 0,
            apiDuration: `${apiDuration}ms`,
          });

          return successResponse(response);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorObj =
            error instanceof Error ? error : new Error(String(error));

          logger.error("Search error", errorObj, {
            word,
            num,
            duration: Date.now() - startTime,
          });

          let status = 500;
          if (
            errorMessage.includes("요청 한도 초과") ||
            errorMessage.includes("Rate Limit") ||
            errorMessage.includes("429")
          ) {
            status = 429;
            logger.warn("Rate limit exceeded", { word, num });
          } else if (
            errorMessage.includes("인증 오류") ||
            errorMessage.includes("API 키") ||
            errorMessage.includes("Unregistered key")
          ) {
            status = 401;
            logger.error("Authentication error", errorObj);
          }

          logger.logResponse(status, Date.now() - startTime);
          return errorResponse(
            `검색 중 오류가 발생했습니다: ${errorMessage}`,
            status
          );
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
