/**
 * MCP 핸들러 공통 로직
 * Worker와 로컬 서버에서 공유
 */

import { type Tool } from "@modelcontextprotocol/sdk/types.js";
import { MalsaemApiClient } from "./api/malsaem.js";

export function handleToolsList() {
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
}

export async function handleToolsCall(
  apiClient: MalsaemApiClient,
  name: string,
  args?: Record<string, unknown>
) {
  if (name === "search_word") {
    const word = args?.word as string | undefined;
    const num = (args?.num as number | undefined) || 10;

    if (!word || word.trim().length === 0) {
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

    try {
      const result = await apiClient.searchWord(word.trim(), num);
      const formatted = apiClient.formatSearchResult(result);

      return {
        content: [
          {
            type: "text",
            text: formatted,
          },
        ],
        isError: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `오류: ${errorMessage}`,
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

export async function handleMcpRequest(
  apiClient: MalsaemApiClient,
  mcpRequest: {
    jsonrpc?: string;
    method?: string;
    params?: {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    id?: string | number;
  }
): Promise<{
  jsonrpc: string;
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}> {
  let result;
  let response: {
    jsonrpc: string;
    id?: string | number;
    result?: unknown;
    error?: { code: number; message: string };
  };

  // MCP Initialization Phase
  if (mcpRequest.method === "initialize") {
    response = {
      jsonrpc: "2.0",
      id: mcpRequest.id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "malsaem-mcp-server",
          version: "1.0.0",
        },
      },
    };
  } else if (mcpRequest.method === "notifications/initialized") {
    // 알림은 응답이 필요 없지만, 빈 응답 반환 (PlayMCP 호환성)
    response = {
      jsonrpc: "2.0",
      id: mcpRequest.id,
      result: null,
    };
  } else if (mcpRequest.method === "tools/list") {
    result = handleToolsList();
    response = {
      jsonrpc: "2.0",
      id: mcpRequest.id,
      result: result,
    };
  } else if (mcpRequest.method === "tools/call") {
    const toolName = mcpRequest.params?.name as string;
    const args = mcpRequest.params?.arguments as
      | Record<string, unknown>
      | undefined;

    if (!toolName) {
      response = {
        jsonrpc: "2.0",
        id: mcpRequest.id,
        error: {
          code: -32602,
          message: "tool name이 필요합니다.",
        },
      };
    } else {
      try {
        result = await handleToolsCall(apiClient, toolName, args);
        response = {
          jsonrpc: "2.0",
          id: mcpRequest.id,
          result: result,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        let errorCode = -32000;
        if (
          errorMessage.includes("요청 한도 초과") ||
          errorMessage.includes("Rate Limit")
        ) {
          errorCode = -32001;
        } else if (
          errorMessage.includes("인증 오류") ||
          errorMessage.includes("API 키")
        ) {
          errorCode = -32002;
        }

        response = {
          jsonrpc: "2.0",
          id: mcpRequest.id,
          error: {
            code: errorCode,
            message: errorMessage,
          },
        };
      }
    }
  } else {
    // 알 수 없는 메서드
    response = {
      jsonrpc: "2.0",
      id: mcpRequest.id,
      error: {
        code: -32601,
        message: "Method not found",
      },
    };
  }

  return response;
}
