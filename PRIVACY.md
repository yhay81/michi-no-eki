# Privacy

## Browser storage

最大6件の公開駅IDを`localStorage`へ保存します。検索語、都道府県、登録年代は保存しません。保存内容はブラウザのサイトデータ削除で消せます。

## Anonymous product events

D1には次だけを35日間保存します。

- ランダムなセッションIDのSHA-256
- 許可済み操作名
- 自動QA区分
- 発生時刻

検索語、駅ID、都道府県、所在地、案内URL、IPアドレス、User-Agentをイベント行へ保存しません。広告、外部解析、Cookie、フィンガープリントは使いません。Do Not TrackまたはGlobal Privacy Controlが有効な場合はイベントを送信しません。
