# Wikipediaタガー (Wikipedia Tagger)

入力テキスト中のWikipedia記事タイトルを自動検出し、`[用語]` 形式で注釈を付与するWebアプリケーションです。  
外部Web APIに依存せず、**内部に組み込んだWikipedia記事ダンプデータ（約208万語）**を用いて超高速かつ完全にオフラインで動作します。

専門外の分野の文章を読む際や、学術論文・ニュース記事・技術文書の読解支援ツールとして活用できます。

---

## 主な機能

- **内部ダンプ組み込み型**:
  - 日本語版Wikipedia記事タイトルダンプ（名前空間0）から抽出した約208万語を内部エンジンに搭載。
  - 外部Web APIを呼び出さないため、ネットワーク遅延やレート制限がなく、瞬時に（ミリ秒単位で）注釈が完了します。
- **最長一致アルゴリズム（Greedy Longest Match）**:
  - 複合語や長い専門用語（例: `量子コンピュータ`、`人工知能`、`東京大学`）を優先してタグ付けし、部分語による不要な分断を防止します。
- **ポップアップ閲覧**:
  - `[用語]` をクリックすると、指定サイズのポップアップ小窓（880×720）または新しいタブでWikipedia記事を開きます。
- **ノイズ低減フィルター**:
  - **基本語彙除外**: Wiktionary日本語基本語彙・助詞・助動詞などの頻出一般語を適切にフィルタリング。
  - **ひらがな短小語除外**: 3文字以下の純ひらがな語を除外。
  - **文字数絞り込み**: 2文字以上 / 3文字以上 / 4文字以上の切り替えが可能。
- **セキュリティ & 入力制限**:
  - **最大2,000文字の入力制限**: 大量データ投入や負荷を防止するため、1回の入力上限を最大2,000文字に制限（HTML5 `maxlength` 属性、リアルタイム文字数カウンター、警告表示）。
  - **JavaScriptインジェクション対策**: スクリプト混入やDOM破壊を防止するため、危険文字・制御文字（`'`, `"`, `\`, `\n`, `\r`, `\t`, `&`, `<`, `>`）を入出力時に完全エスケープ。
- **読書・学習支援UI**:
  - 検出された用語一覧（出現頻度つき）の表示。用語クリックで本文中の該当箇所へハイライトスクロール。
  - 注釈結果テキストのワンクリックコピー（`[用語]` 形式）。
  - 注釈付きHTMLファイルのスタンドアロン保存機能。
  - ライトモード / ダークモード対応。
  - 各種分野（量子AI、古代日本史、ゲノム医療、宇宙物理学）のワンクリックサンプルテキスト。

---

## 使い方

### 1. サーバーの起動

任意の静的Webサーバーで本ディレクトリを配信します。

Python をお使いの場合：

```bash
python -m http.server 8080
```

または npm をお使いの場合：

```bash
npm start
# または npx -y serve . -l 8080
```

ブラウザで以下のURLを開きます：
👉 **http://localhost:8080/**

> **Note**: 本アプリは Web Worker とブラウザ標準のストリーミング解凍（`DecompressionStream`）により 100% クライアントサイド（ブラウザ内）で動作するため、GitHub Pages や Cloudflare Pages、Vercel などの静的ホスティングにもそのままデプロイ可能です。

### 2. 操作方法

1. 入力欄に文章を入力（または上部の「サンプル読込」ボタンをクリック）。
2. 「**実行する**」（または <kbd>Ctrl</kbd> + <kbd>Enter</kbd>）をクリック。
3. 右側のパネルに `[用語]` 形式で注釈されたテキストが表示されます。
4. 単語をクリックすると、別ウィンドウ（ポップアップ）でWikipedia記事が開きます。
5. 「テキストコピー」で `[用語]` 付きテキストをクリップボードにコピー、「HTML保存」でスタンドアロンHTMLファイルをダウンロードできます。

---

## プロジェクト構成

```text
wikipedia-tagger/
├── data/
│   └── wikipedia_titles.txt.gz  # 前処理済みWikipediaタイトル辞書 (約11.8MB, 208万語 / Web動作に必須)
├── scripts/
│   └── prepare_data.py          # Wikipediaダンプデータ前処理・辞書生成スクリプト
├── css/
│   └── style.css                # モダンデザインシステム (Vanilla CSS, ダークモード対応)
├── js/
│   ├── app.js                   # フロントエンドUI・ポップアップ制御・ナビゲーション
│   └── worker.js                # Web Workerタギングエンジン (ストリーミングGZIP解凍 & 最長一致検索)
├── index.html                   # メインUI画面
├── package.json                 # npmスクリプト定義 (静的サーバー起動など)
└── README.md                    # ドキュメント
```

---

## 参考・クレジット

本ツールは、東京大学の「[Wikipediaタガー（Akira Maeda氏 開発）](https://mbc.dl.itc.u-tokyo.ac.jp/wikipedia_tagger/)」のコンセプトをもとに、現代的なWeb UIと内部ダンプデータエンジンで再構成したものです。

- [Wikipedia: データベースダウンロード](https://ja.wikipedia.org/wiki/Wikipedia:%E3%83%87%E3%83%BC%E3%82%BF%E3%83%99%E3%83%BC%E3%82%B9%E3%83%80%E3%82%A6%E3%83%B3%E3%83%AD%E3%83%BC%E3%83%89)
- [Wiktionary: 日本語の基本語彙1000](https://ja.wiktionary.org/wiki/Wiktionary:%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E5%9F%BA%E6%9C%AC%E8%AA%9E%E5%BD%991000)

---

## ライセンス (Licenses)

### 1. ソフトウェアコード
本リポジトリのソースコード（HTML, CSS, JavaScript, Pythonスクリプト等）は **[MIT License](https://opensource.org/licenses/MIT)** の下で公開されています。

### 2. Wikipedia ダンプデータからの派生辞書データ
本ツールで辞書データ（`wikipedia_titles.txt.gz`）の生成・抽出に利用している Wikipedia ダンプデータは、ウィキメディア財団（Wikimedia Foundation）および各記事の寄稿者によって作成されたものです。

- **ライセンス**: **[Creative Commons Attribution-ShareAlike (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.ja)** および **[GNU Free Documentation License (GFDL)](https://www.gnu.org/licenses/fdl-1.3.html)**
- **データ出典**: [ウィキペディア日本語版 データベースダンプ](https://dumps.wikimedia.org/jawiki/) (`jawiki-latest-all-titles-in-ns0.gz`)
- 本ツールの辞書データ・派生データも上記ライセンス条件（CC BY-SA）を継承します。

---

## Copyright

This code was generated using Google Antigravity and subsequently 
modified by the author.

