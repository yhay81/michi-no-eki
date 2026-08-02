# Product metrics

35日保持の匿名イベントから、次を確認します。

- `users`: QAを除く利用者
- `searchers`: 検索または絞り込みで結果を確認した利用者
- `successful_searches` / `no_result_searches`: 結果あり・0件の操作回数
- `prefecture_changers` / `period_changers`: 絞り込みを使った利用者
- `savers`: 停車札へ追加した利用者
- `copiers`: 停車札をコピーした利用者
- `official_openers`: 一覧掲載の案内を開いた利用者

検索語、駅、都道府県はイベントに含めません。自動QAは`is_qa=1`として実利用から除外します。

```powershell
npm run metrics
```
