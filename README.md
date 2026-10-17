# ETF 모아

동전을 안은 3D 로봇 캐릭터 모아와 함께 ETF로 목표 자산을 모으는 개인용 웹 앱.

## 기능

- **온보딩**: 나이 → 목표 금액 → 월 투자금. 입력값은 브라우저에 저장돼 다음에 바로 이어집니다.
- 현재 자산은 보유 ETF 평가금 합계, 목표 수익률은 보유 ETF 기대 수익률의 비중 가중평균으로 자동 계산
- **홈**: 총 자산·목표 달성률, 목표까지 기간/나이, 기대 수익률, 월 예상 배당금, 자산 성장 예측 그래프
- **보유 ETF**
  - 해외 ETF는 티커를 크게, 이름은 작게 표시
  - 이름(한글)·종목코드·영문 티커로 검색 → 선택하면 현재가 자동 반영 (해외 ETF는 환율 적용)
  - 보유 주식수 + 투자금만 넣으면 평균매입가 자동 계산 (평균매입가를 넣으면 투자금이 계산됨)
  - 평가금은 현재가 × 주식수로 자동 계산, 직접 입력도 가능
  - 국내 상장 ETF 전체(네이버 금융 목록) + 해외 ETF 검색
  - 계좌별(일반·ISA·연금저축·IRP 등)로 묶어서 관리, 계좌별 자산 비중 그래프
  - ETF별 기대 수익률 = 30년 이상 된 ETF는 자체 30년 평균, 그보다 짧으면 기초지수(코스닥·S&P500 등) 장기 평균. 포트폴리오는 비중 가중평균
  - 보유 수량 기준 연·월 배당금(세전/세후), 월별 지급 일정
  - **배당 재투자 ON/OFF**: ON이면 배당 재투자 총수익률, OFF면 가격 상승분만 예측에 반영
- **리밸런싱**: ETF별 목표 비중 직접 입력 → 현재 자산 기준 매수·매도 금액과 주식 수 (추가 투자금 입력 시 합산, 추가 매수로만 맞추기 옵션)
- **비중 분석**: 자산군·나라별·섹터별 비중과 높음/적정/낮음 판정 (기초지수 대표 구성 기준 추정)
- **내 목표**: 목표 수정, 데이터 초기화

## 실행

```bash
npm install
npm run dev
```

## 배포 (Vercel 권장)

국내 시세·ETF 목록은 네이버 금융, 과거 성과·배당·해외 시세는 Yahoo Finance에서 가져오며, 브라우저 CORS 제한 때문에 서버 함수(`api/quote.ts`, `api/search.ts`, `api/etfs.ts`, `api/benchmarks.ts`)를 거칩니다.
Vercel에 그대로 올리면 `/api/*` 함수가 자동으로 배포됩니다. 개발 중에는 Vite 서버가 같은 API를 대신 처리합니다(`vite.config.ts`).

## 구조

- `src/components/Onboarding.tsx`: 첫 입력 흐름 (목표 수정 때도 재사용)
- `src/components/Home.tsx`, `Holdings.tsx`, `Goal.tsx`: 3개 탭 화면
- `src/components/HoldingSheet.tsx`: ETF 검색·입력 바텀시트
- `src/lib/finance.ts`: 복리 예측, 기대 수익률, 배당 계산
- `src/lib/presets.ts`: 한글 검색용 대표 ETF 목록
- `server/yahoo.ts`: 시세·수익률·배당 조회 (dev 서버와 Vercel 함수 공용)

3D 캐릭터 모아는 Three.js로 직접 모델링(`src/components/Mascot3D.tsx`). 아이콘: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT)
