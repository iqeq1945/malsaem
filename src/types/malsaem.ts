/**
 * 우리말샘 OPEN API 응답 타입 정의
 * API 문서: https://opendict.korean.go.kr/service/openApiInfo
 */

export interface MalsaemSearchResult {
  /** 검색 결과 채널 */
  channel: {
    /** 제목 */
    title?: string;
    /** 링크 */
    link?: string;
    /** 설명 */
    description?: string;
    /** 마지막 빌드 날짜 */
    lastbuilddate?: number;
    /** 총 검색 결과 수 */
    total: number;
    /** 검색 결과 항목 (단일 객체 또는 배열) */
    item: MalsaemWordItem | MalsaemWordItem[];
  };
}

export interface MalsaemWordItem {
  /** 대상 코드 */
  target_code?: number;
  /** 그룹 코드 */
  group_code?: number;
  /** 그룹 순서 */
  group_order?: number;
  /** 단어 정보 */
  wordinfo?: MalsaemWordInfo;
  /** 의미 정보 */
  senseinfo?: MalsaemSenseInfo | MalsaemSenseInfo[];
}

export interface MalsaemWordInfo {
  /** 단어 */
  word?: string;
  /** 단어 단위 */
  word_unit?: string;
  /** 단어 유형 */
  word_type?: string;
  /** 원어 정보 */
  original_language_info?: {
    original_language?: string;
    language_type?: string;
  };
}

export interface MalsaemSenseInfo {
  /** 의미 번호 */
  sense_no?: number;
  /** 유형 */
  type?: string;
  /** 뜻풀이 */
  definition?: string;
  /** 분류 정보 */
  cat_info?: {
    cat?: string;
  };
  /** 용례 정보 */
  example_info?: MalsaemExampleInfo | MalsaemExampleInfo[];
  /** 수어 정보 링크 */
  sl_info_link?: string;
}

export interface MalsaemExampleInfo {
  /** 용례 */
  example?: string;
  /** 출전 */
  source?: string;
}

export interface MalsaemApiError {
  /** 에러 정보 */
  error: {
    /** 에러 코드 */
    error_code: number | string;
    /** 에러 메시지 */
    message: string;
  };
}
