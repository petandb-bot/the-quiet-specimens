# Elsewhere — B2.1 World Refinement

*A world continuing beyond the frame.*

## Land

- 住民が活動する範囲は60×60単位、地形の描画範囲は240×240単位。地平線へ向かう薄い霧と、活動範囲の外に置く構造物が、手前の個体とは異なるスケールをつくる。
- **Rolling Field** は緩やかな起伏、**Terraces** は段差を緩い斜面でつなぐ地形、**Hollow Land** は二つの窪地をもつ。Seed が標高とランドマークの配置に作用する。Elevation 0 は平地。
- Openness は中央付近の起伏と構造物の間隔を、Landmark density は居住範囲内の構造物数を変える。近くに小石のまとまりと大きなアーチを配置し、遠方に二つのシルエットを残す。緩く動くリングやモノリスの頂部は行動シミュレーションとは独立している。
- 居住範囲の高低差、ランドマークからの距離、開始点同士の距離を使い、最大9体の初期位置を決定する。地形を変更すると同じ住民が新しい地形で生活圏をつくる。

## Contact

地形メッシュ、移動、カメラは1単位格子の共通の高さを読む。格子内は Three.js の PlaneGeometry と同じ2枚の三角形を使って補間する。HINGE は斜面に合わせて傾き、足先の下の高さを調べて体を調整する。RELAY は各節で高さを読む。VESSEL は浮遊に地形の高さを緩やかに反映する。

HINGE と RELAY は急な勾配を避け、進行方向の近くから迂回方向を選ぶ。VESSEL は急斜面を越える。構造物の平面上の占有範囲は3体型が共通で見る。足全体の物理接地やアーチ内の精密な当たり判定は今後の課題。

## Cameras

- **Landscape** は手動カメラ。ドラッグで回転し、右ドラッグまたは二本指で移動する。ホイールやピンチ、または Camera 内のボタンで拡大できる。
- **Wander** はランドマークの近くや開けた地点をゆっくり移動する。中間地点を補間し、地面や高い構造物と距離を取る。
- **Follow** は選択した個体の進行方向に応じて、個体とその周囲を斜め後ろから映す。Resident から選択できる。対象が庭園からいなくなると Landscape に戻る。
- **Inspect / Action** は個体の近接観察。**Reset camera** は最初の Landscape に戻る。**Reduce camera motion** は Wander を静止させ、Follow の追従と手動操作の慣性を抑える。OS の動き軽減設定を初期値に使う。
- **View** は操作欄を隠す。Exit view または Escape で戻る。

## Photo Environment

**Backdrop** は縦横比を保って画像を切り出し、遠方の地面を写真へ徐々に溶かす。Image Scale、Horizontal / Vertical Offset、Horizon Position で見える範囲を、Blur、Color Influence、Ground Blend で合成を調整する。クロップが少ないときは拡大すると移動幅が広がる。

**Atmosphere** は読み込んだ写真の下寄りから代表色を採取し、空・霧・地形・照明に反映する。表示を切り替えても、写真と調整値はセッション内に残る。復号にはブラウザのローカル Blob URL を使い、処理後に解放する。選べる写真は20 MBかつ60メガピクセル以下で、描画用の長辺は最大2048 px。差し替えと解除で古いテクスチャを解放する。

[Living Territories](LIVING_TERRITORIES.md) · [検証記録](VERIFICATION.md)
