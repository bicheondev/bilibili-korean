/**
 * content/index.js
 * 진입점 — selectors.json 로드 후 patcher 실행
 */

import { patch, buildTextMap } from './patcher.js';
import { observe } from './observer.js';

(async () => {
  const url = chrome.runtime.getURL('locales/selectors.json');
  const res  = await fetch(url);
  const selectors = await res.json();

  // 텍스트 → 번역 빠른 조회 맵
  const textMap = buildTextMap(selectors);

  // 초기 패치
  patch(selectors, textMap);

  // MutationObserver로 동적 삽입 대응
  observe(selectors, textMap);
})();
