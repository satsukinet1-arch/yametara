# 辞めたら何ヶ月暮らせる？診断

失業手当・住民税・国民健康保険・国民年金まで差し引いて、無職で暮らせる月数を出す診断ページ。運営：AI制作所さつき

- 公開URL：https://satsukinet1-arch.github.io/yametara/
- 公開ファイル：`index.html` / `privacy.html` / `ogp.png`（ルート）
- 元ファイル：`src/`（`engine.js`＝計算、`ui.html`＝画面、`privacy.html`）
- 作り直し：`src` で `SITE_URL=... OPERATOR=... CONTACT=... node build.js` → `site/` の中身をルートへ
- 毎年8月：失業手当の上限額、毎年4月：国民年金の額を `engine.js` の CONFIG で更新する
