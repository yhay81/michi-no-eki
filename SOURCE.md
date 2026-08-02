# Source and transformation

## Official source

- Title: 国土交通省「道の駅」登録一覧
- Source page: <https://www.mlit.go.jp/road/Michi-no-Eki/list.html>
- Release: <https://www.mlit.go.jp/report/press/road01_hh_002029.html>
- Workbook: <https://www.mlit.go.jp/road/Michi-no-Eki/file/list.xls>
- As of: 2025-12-19
- Retrieved: 2026-08-02
- Workbook bytes: 2,532,352
- SHA-256: `7a34f2691634639caa201fdaf8a6f0bec9058e0c38cc68cfd9f9e67284171599`
- Terms: 公共データ利用規約（第1.0版）に準拠
- Terms page: <https://www.mlit.go.jp/link.html>

出典：国土交通省「道の駅」登録一覧を加工して作成。

## Verified dimensions

- 47都道府県、1,231駅
- 登録回は第1回から第64回
- 登録年月は1993年4月から2025年12月
- 駅名、所在地、登録情報の欠損0
- 都道府県と駅名の組み合わせの重複0
- 一覧掲載の案内URLなし16駅、複数URL1駅
- 第64回は福島県「石川」と静岡県「ゆとりえせとや」の2駅

## Transformation / 加工

1. 公式XLSの全角英数字と空白を検索用に正規化する。
2. 平成・令和表記の登録年月から西暦年と月を派生する。
3. 都道府県別件数と登録年代を派生する。
4. 案内URL欄からHTTP/HTTPS URLだけを取り出す。宇津ノ谷峠の二つの案内先は別リンクとして保持する。
5. 都道府県、駅名、所在地から安定した12桁IDを作る。

名称、所在地、登録回、登録年月、案内URLを推測・補完しません。公式ブックのサイズとハッシュが変わった場合、生成処理は停止し、更新内容を人が確認します。

## Interpretation boundary

登録年月は国土交通省への登録年月で、開業日、改装日、営業開始日ではありません。「道の駅」は登録制度上の施設で、鉄道駅、サービスエリア、一般の直売所を網羅しません。公式XLSには緯度経度、住所番地、営業時間、設備、駐車台数、休業・廃止状況の詳細がないため、本サービスはそれらを推測しません。現地利用前に各駅の案内を確認してください。
