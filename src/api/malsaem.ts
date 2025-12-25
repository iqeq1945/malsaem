/**
 * 우리말샘 OPEN API 클라이언트
 *
 * 저작권: 우리말샘(국립국어원)
 * 라이선스: 크리에이티브 커먼즈 저작자표시-동일조건변경허락 2.0 대한민국 (CC BY-SA 2.0 KR)
 */

import type {
  MalsaemSearchResult,
  MalsaemWordItem,
  MalsaemApiError,
} from "../types/malsaem.js";

const COPYRIGHT_NOTICE = "\n\n출처: 우리말샘(국립국어원), CC BY-SA 2.0 KR";

/**
 * 우리말샘 API 클라이언트
 */
export class MalsaemApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = "https://opendict.korean.go.kr/api";
  }

  /**
   * 단어 검색
   * @param word 검색할 단어
   * @param num 검색 결과 개수 (10~100, 기본값: 10)
   * @param start 검색 시작 번호 (1~1000, 기본값: 1)
   * @param advanced 자세히 찾기 여부 (기본값: true)
   * @param target 검색 대상 (1: 단어, 2: 뜻, 기본값: 1)
   * @returns 검색 결과
   */
  async searchWord(
    word: string,
    num: number = 10,
    start: number = 1,
    advanced: boolean = true,
    target: number = 1
  ): Promise<MalsaemSearchResult> {
    if (!word || word.trim().length === 0) {
      throw new Error("검색할 단어를 입력해주세요.");
    }

    // 파라미터 유효성 검사
    if (num < 10 || num > 100) {
      throw new Error("num 파라미터는 10~100 사이의 값이어야 합니다.");
    }
    if (start < 1 || start > 1000) {
      throw new Error("start 파라미터는 1~1000 사이의 값이어야 합니다.");
    }
    if (target < 1 || target > 10) {
      throw new Error("target 파라미터는 1~10 사이의 값이어야 합니다.");
    }

    if (!this.apiKey?.trim()) {
      throw new Error("API 키가 설정되지 않았습니다.");
    }

    try {
      const url = new URL(
        `${this.baseUrl}/search`,
        "https://opendict.korean.go.kr"
      );
      url.searchParams.set("key", this.apiKey.trim());
      url.searchParams.set("q", word.trim());
      url.searchParams.set("req_type", "json");
      url.searchParams.set("num", num.toString());
      url.searchParams.set("start", start.toString());
      url.searchParams.set("advanced", advanced ? "y" : "n");

      if (advanced) {
        url.searchParams.set("target", target.toString());
        url.searchParams.set("part", "word");
        url.searchParams.set("sort", "dict");
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("json");

      if (!response.ok) {
        const errorText = await response.text();

        // Rate Limit (429) 처리
        if (response.status === 429) {
          throw new Error(
            `우리말샘 API 요청 한도 초과: 일일 50,000건 제한에 도달했습니다. 내일 다시 시도해주세요.`
          );
        }

        // HTML 응답인 경우 더 명확한 에러 메시지
        if (!isJson && errorText.includes("<!DOCTYPE")) {
          throw new Error(
            `우리말샘 API 오류: API 키가 유효하지 않거나 승인되지 않았을 수 있습니다. (상태: ${response.status})`
          );
        }

        throw new Error(
          `API 요청 실패: ${response.status} ${
            response.statusText
          }\n${errorText.substring(0, 200)}`
        );
      }

      const responseText = await response.text();
      if (!responseText.trim().startsWith("{")) {
        throw new Error(`예상치 못한 응답 형식: ${contentType}`);
      }

      const data = JSON.parse(responseText) as
        | MalsaemSearchResult
        | MalsaemApiError;

      if ("error" in data) {
        const error = (data as MalsaemApiError).error;
        const errorCode = String(error.error_code);
        if (errorCode === "020" || errorCode === "021") {
          throw new Error(
            `우리말샘 API 인증 오류: ${error.message}. API 키를 확인해주세요.`
          );
        }
        throw new Error(`API 에러 (${error.error_code}): ${error.message}`);
      }

      return data as MalsaemSearchResult;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`단어 검색 중 오류가 발생했습니다: ${String(error)}`);
    }
  }

  /**
   * 검색 결과를 포맷팅하여 반환
   * @param result 검색 결과
   * @returns 포맷팅된 문자열
   */
  formatSearchResult(result: MalsaemSearchResult): string {
    if (!result.channel || !result.channel.item) {
      return `검색 결과가 없습니다.${COPYRIGHT_NOTICE}`;
    }

    // item이 배열인지 단일 객체인지 확인
    const items = Array.isArray(result.channel.item)
      ? result.channel.item
      : [result.channel.item];

    if (items.length === 0) {
      return `검색 결과가 없습니다.${COPYRIGHT_NOTICE}`;
    }

    let formatted = `검색 결과: ${result.channel.total}개\n\n`;

    items.forEach((item, index) => {
      const wordInfo = item.wordinfo;
      const senseInfo = item.senseinfo;

      // 단어 정보
      if (wordInfo?.word) {
        formatted += `[${index + 1}] ${wordInfo.word}`;

        if (wordInfo.word_unit) {
          formatted += ` (${wordInfo.word_unit})`;
        }

        if (wordInfo.word_type) {
          formatted += ` [${wordInfo.word_type}]`;
        }

        if (wordInfo.original_language_info?.original_language) {
          formatted += ` - ${wordInfo.original_language_info.original_language}`;
          if (wordInfo.original_language_info.language_type) {
            formatted += ` (${wordInfo.original_language_info.language_type})`;
          }
        }

        formatted += "\n";
      }

      // 의미 정보
      const senses = Array.isArray(senseInfo)
        ? senseInfo
        : senseInfo
        ? [senseInfo]
        : [];

      senses.forEach((sense, senseIndex) => {
        if (sense.definition) {
          formatted += `  ${senseIndex + 1}. ${sense.definition}`;
          if (sense.type) {
            formatted += ` [${sense.type}]`;
          }
          formatted += "\n";
        }

        // 분류 정보
        if (sense.cat_info?.cat) {
          formatted += `     분류: ${sense.cat_info.cat}\n`;
        }

        // 용례 정보
        const examples = Array.isArray(sense.example_info)
          ? sense.example_info
          : sense.example_info
          ? [sense.example_info]
          : [];

        examples.forEach((example) => {
          if (example.example) {
            formatted += `     예: ${example.example}`;
            if (example.source) {
              formatted += ` (출전: ${example.source})`;
            }
            formatted += "\n";
          }
        });

        // 수어 정보 링크
        if (sense.sl_info_link) {
          formatted += `     수어 정보: ${sense.sl_info_link}\n`;
        }
      });

      formatted += "\n";
    });

    formatted += COPYRIGHT_NOTICE;
    return formatted;
  }

  /**
   * 검색 결과를 JSON 형식으로 반환 (Workers용)
   * @param result 검색 결과
   * @returns JSON 형식의 응답
   */
  formatSearchResultJson(result: MalsaemSearchResult): {
    success: boolean;
    total: number;
    items: MalsaemWordItem[];
    copyright: string;
  } {
    // item이 배열인지 단일 객체인지 확인
    const items = result.channel?.item
      ? Array.isArray(result.channel.item)
        ? result.channel.item
        : [result.channel.item]
      : [];

    return {
      success: true,
      total: result.channel?.total || 0,
      items,
      copyright: "우리말샘(국립국어원), CC BY-SA 2.0 KR",
    };
  }
}

/**
 * 환경 변수에서 API 키를 가져옴
 * @param env 환경 변수 객체 (Workers의 env 또는 process.env)
 * @returns API 키
 */
export function getApiKey(env: Record<string, unknown>): string {
  const apiKey = env.MALSAEM_API_KEY as string | undefined;

  if (!apiKey) {
    throw new Error("MALSAEM_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  return apiKey;
}
