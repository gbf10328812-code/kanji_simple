# 漢字しらべ（PWA）

ひらがなで読みを入れると、その読みの「ことば」と「漢字」を大きな文字で表示する iPhone 向け Web アプリです。
一度ひらくと全データ（約9MB）を端末に保存し、以後はオフラインで動きます。

## ファイル
- `index.html` / `app.js` … 画面と検索
- `sw.js` … オフライン用（Service Worker）。中身を更新したら `CACHE` の版（v1→v2）を上げる
- `manifest.webmanifest`, `icon-*.png` … ホーム画面用
- `data/kanji.json` … 漢字 12,286字（読み・画数・学年・例語）
- `data/words.json` … 読み → ことば 約13.5万読み

## 公開（GitHub Pages）
1. GitHub で公開リポジトリを作り、このフォルダの中身をそのまま置く
2. Settings → Pages → Branch: `main` / `/(root)` を選んで保存
3. `https://<ユーザー名>.github.io/<リポジトリ名>/` を iPhone の Safari で開く
4. 共有ボタン →「ホーム画面に追加」

## データの出典
KANJIDIC2 / JMdict（© Electronic Dictionary Research and Development Group, CC BY-SA 4.0）。
npm パッケージ `kanji-data` 1.1.0（kanjiapi.dev 由来）から変換。
