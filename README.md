# 道の駅さがし

全国1,231の道の駅を駅名・所在地・都道府県から探し、登録時期を確認し、最大6駅の停車札を端末内にまとめる日本語Webサービスです。

- Production: <https://michi-no-eki.yhay81.com>
- Source: 国土交通省「道の駅」登録一覧（2025年12月19日現在）
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:build
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

公式XLSから駅名、登録回、登録年月、所在地、一覧掲載の案内URLだけを抽出します。住所番地、緯度経度、営業時間、休館日、設備、駐車台数、商品、道路状況、開業・休業状況は収録しません。派生値は西暦年月、都道府県別件数、登録年代だけです。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
