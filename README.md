# The Quiet Specimens — Reborn

**Elsewhere · B4.1.1 Still & Alive**

生きているはずのない物体が、自分の意思で動いているように見える地平線まで続く風景です。関節で踏ん張る **HINGE**、殻の中に別の運動を持つ **VESSEL**、動きが節へ順番に伝わる **RELAY** に、3体ずつの参照個体を用意しました。

以前の Phase A の画面は [こちら](public/downloads/reborn-artificial-garden.jpg)。Elsewhere の実ブラウザでの検証状況は [Verification](docs/VERIFICATION.md) に記録しています。

## 起動

Node.js 22.12 以上と npm を使用します。

```sh
npm ci
npm run dev
npm test
npm run build
```

開発時は Vite が表示する URL を開きます。静的ホスティングには `dist/` を配信します。ビルド済みの確認には `npm run preview` を使います。

## 鑑賞と音響

起動時は **Fixed** の静止した視点です。**Residents** から個体の姿と行動を見て、**Locate** で位置を探したり、**Soft Follow** でゆっくり追ったりできます。**Camera → Observatory** は4つの定点を手動で切り替え、必要なときだけ自動巡回できます。

**Sound off** を押して音を始めます。**Audio** で世界の複数個体を聴く **World**、選択個体だけの **Solo**、音量と密度を切り替えられます。**Audition** は選択個体の試聴です。**View** で操作欄を隠しても音楽は続きます。

[鑑賞ガイド](docs/OBSERVATION.md) · [カメラ](docs/CAMERA_COMFORT.md) · [音響](docs/AUDIO_ECOLOGY.md)

## Personal Places

**Compose** で彫刻を選び、地面に置いてドラッグで動かします。**Plan** は真上から配置を見渡す視点です。**Perspective** の **Navigate** では鑑賞カメラを動かせます。**Places** では、休息場所や興味を引く場所を地面に作ったり、物体に結びつけたりできます。**Life** から住民の出発地点や Home を指定できます。

編集を閉じると住民の活動が再開します。編集は現在のブラウザセッション内で保持されます。

[Place Composer](docs/WORLD_COMPOSER.md) · [場所の役割](docs/PLACE_SYSTEM.md) · [世界データ](docs/WORLD_DOCUMENT.md)

## 操作

- **Life** を開くと、個体の操作と行動を確認できます。**Observe** では自分の生活圏を巡る個体を眺めます。個体をクリックまたはタップすると、その個体が反応します。
- **Reference specimens** から9体を選べます。**New specimen** で新規生成し、**Seed** を開いて同じシードを入力すると個体を再生成できます。
- **Inspect** は回転・拡大、**Action** は身構えや回復を含むアクションの確認です。**Add to world** と **Remove from world** で最大9体を入れ替えられます。
- **Sound** は World / Solo の再生を切り替え、**Audition** は選択した1体を短時間試聴します。**View** は鑑賞用に操作欄を隠します。**Pause** は動きを止めます。
- **Legacy** は同じ配信元の `/legacy/` にある従来版です。写真からの生成、コレクション、JSON 入出力、既存の IndexedDB 保存にアクセスできます。

## 構成

| パス | 内容 |
| --- | --- |
| `src/reborn` | 庭園、体型レジストリ、材質、固定刻みの運動、鑑賞 UI |
| `src/legacy` | アクアリウムと旧研究室 |
| `src/audio` | 両エントリーが使う Web Audio ボイスと発音スケジューラー |
| `src/core`, `src/genesis`, `src/archive` | シード、従来の生成・画像解析、保存スキーマ |

Elsewhere は WebGL 2 を使います。庭園の配置、写真、個体の場所の記憶はセッション内で扱います。新しい個体の画像解析・収集やワールド保存は [ロードマップ](docs/ROADMAP.md) に記載しています。

- [Reborn art direction](docs/ART_DIRECTION_REBORN.md)
- [Body plans](docs/BODY_PLANS.md)
- [Motion design](docs/MOTION_DESIGN.md)
- [Verification](docs/VERIFICATION.md)

## Elsewhere

- **World** で Rolling Field、Terraces、Hollow Land を選びます。**Composition** から余白とランドマークの密度を調整できます。**Apply land** / **New terrain** では住民を新しい地形に配置し直します。
- **Camera** で **Fixed**、手動の **Landscape**、**Soft Follow**、**Observatory**、**Atlas** を選べます。
- **Image** から写真を選べます。**Backdrop** は遠景に写真を使い、**Atmosphere** は抽出色を地形・霧・照明に反映します。写真はブラウザ内だけで処理します。

[Elsewhere の地形・カメラ・写真](docs/ELSEWHERE.md) · [Living Territories の行動設計](docs/LIVING_TERRITORIES.md)

## GitHub Pages

公開時はリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。`Publish Vite application` は main の更新時にテスト・ビルド・配信ファイル検査を行い、生成された `dist/` のみを公開します。手動起動は Actions の同名ワークフローから可能です。ソースを直接公開する Jekyll / Deploy from a branch では TypeScript エントリーが動作しません。

公開先: https://petandb-bot.github.io/the-quiet-specimens/ （初回デプロイ成功後）
