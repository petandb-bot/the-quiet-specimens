# THE QUIET SPECIMENS

**Living Aquarium と Specimen Lab v1.2.0**

架空の水生生物を生成し、泳ぎを観察し、個体固有の電子音を聴いて集める実験室です。3つの身体構造と21体の参照個体から始められます。UIは英語です。

## 起動

Node.js 22.12 以上と npm を使用します。テストとビルドは Node.js 24 で実行できます。

```sh
npm ci
npm run dev
npm test
npm run build
```

ターミナルに表示されたローカル URL を開きます。ビルドで生成された `dist/` は静的ホスティングに配置できます。ビルド済みの確認には `npm run preview` を使います。

## 遊び方

- **Aquarium** が最初に開きます。**Mixed waters** ではグッピー風と小赤風の群れ、アロワナ風の大魚、タツノオトシゴ風の個体、底の平たい魚を観察できます。**Guppy shoal** と **Goldfish shoal** では片方の群れと底の魚が見られます。
- **Pause motion** で泳ぎを止められます。水槽下の個体名を選ぶと **Laboratory** で拡大できます。

- 観察画面上の **Reference forms** で、自然な魚型 **Lagoon**、光輪を持つ **Halo**、装甲の **Machine**、骨格の中が空いた **Cosmic**、丸い **Round**、刃のように細長い **Blade**、大魚 **Arowana**、直立型の **Seahorse** を切り替えられます。
- **Observe** では生物が自律的に泳ぎます。生物をクリックまたはタップすると、個体の性格に応じて反応します。
- **Inspect** ではドラッグで回転し、スクロール、ピンチ、または拡大・縮小ボタンで観察できます。リセットボタンで視点を戻せます。キャンバスにフォーカスすると矢印キーで回転し、＋／－でズーム、0でリセットできます。**Action** は個別の行動を確認するモードです。**View** は全画面の鑑賞モードです。終了ボタンか Escape で戻ります。
- **Extract** は写真の色や明暗、輪郭から生成します。**Discover** は採集条件から生成します。同じ3条件、Seed、Generator version を指定すると同じ個体を再現できます。**New specimen** と **Retry** は新しい Seed で探索します。
- **Mutate** は現在の個体から子個体を生成します。**Cancel result** で直前の観察対象に戻れます。親個体は上書きされません。
- **Sound on/off** は自律音を切り替え、**Audition** は10秒の試聴を開始します。音の再生にはクリックやタップが必要です。
- 名前の横の鉛筆で改名できます。**Save specimen** で保存し、**Archive** の **My collection** で呼び出します。星印でお気に入りにできます。**Export current** と **Import JSON** で個体を移せます。

## 保存と動作環境

保存先は端末上の同じブラウザと同じ配信元の IndexedDB です。別端末への移動には JSON を使います。元画像と抽出画素は永続保存せず、画像解析、3D描画、音響生成をブラウザ内で行います。画像からの再生成では、同じ画像でもデコード差が生じうるため、保存済みの Genome を再現性の基準としています。

WebGL 2 が必要です。JPEG、PNG、WebP など、そのブラウザでデコードできる30 MB以下の画像を使えます。HEIC はブラウザ依存です。スマートフォンでは小さい描画解像度と低分割メッシュを選びます。iPhone Safari 実機と Windows / macOS 固有のブラウザ検証は今後の確認項目です。

交配、水槽の自由配置や保存、複数個体の音響、端末間の自動同期、ネイティブアプリ化は今後の段階です。詳しくは [ロードマップ](docs/ROADMAP.md) と [検証](docs/VERIFICATION.md) を参照してください。

## 設計資料

- [Architecture](docs/ARCHITECTURE.md)
- [Genome](docs/GENOME.md)
- [Art direction](docs/ART_DIRECTION.md)
- [Audio design](docs/AUDIO_DESIGN.md)
- [Roadmap](docs/ROADMAP.md)
- [Verification](docs/VERIFICATION.md)
