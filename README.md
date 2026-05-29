# bilibili-korean

Bilibili UI 한국어 번역 확장 프로그램

## 구조

```
collector/        # UI 수집기 (Playwright)
extension/        # Chrome 확장 프로그램
output/           # 수집 결과
```

## 워크플로

```bash
# 1. 수집
cd collector
node collect.cjs

# 2. output/translation-map-draft.json 에서 ko 값 채우기

# 3. selectors.json 생성
node analyze.cjs

# 4. GitHub push
node push.cjs
```

## 번역 맵 구조

```json
[
  {
    "selector": ".nav-item.home span",
    "type": "textContent",
    "zh": "首页",
    "ko": "홈"
  },
  {
    "selector": ".search-input",
    "type": "placeholder",
    "zh": "搜索",
    "ko": "검색"
  },
  {
    "selector": ".coin-btn::before",
    "type": "css_content",
    "zh": "投币",
    "ko": "코인"
  }
]
```

## 치환 type 종류

| type | 대상 |
|------|------|
| `textContent` | 텍스트 노드 |
| `placeholder` | input placeholder |
| `aria-label` | aria-label 속성 |
| `title` | title 속성 |
| `css_content` | ::before / ::after content |
| `data-title` | data-title 속성 |

## 확장 프로그램 설치

1. Chrome → `chrome://extensions` → 개발자 모드 ON
2. `extension/` 폴더 로드
