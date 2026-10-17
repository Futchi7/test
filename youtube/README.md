# YouTube動画制作ツール（Reggae Roots Green）

Claude Codeのクラウド環境で、合成音声のナレーション付き動画を無料で作るための道具。

## 中身
| ファイル | 役割 |
|---|---|
| `setup_voicevox.sh` | VOICEVOX（合成音声）を入れ直す。環境が消えたら最初にこれを実行する |
| `tts.py` | 文章をVOICEVOXの音声（WAV）にする |

## 使い方
```bash
bash youtube/setup_voicevox.sh
python3 youtube/tts.py "ポトスは、水に挿すだけで増やせます。" out.wav --voice kurono
```

## 必要な環境設定
- ネットワークで `github.com` と `objects.githubusercontent.com` を許可しておく。
- ffmpeg（動画の編集）と Pillow（テロップ画像）は環境に最初から入っている。

## 声と利用条件
| 指定 | 声 | 概要欄に書くクレジット |
|---|---|---|
| `kurono` | 玄野武宏（男性） | VOICEVOX:玄野武宏 |
| `himari` | 冥鳴ひまり（女性） | VOICEVOX:冥鳴ひまり |

どちらも、クレジットを書けば商用で使える（VOICEVOX 音声モデル利用規約と各声の規約による）。声のモデルファイルは規約と容量の都合でリポジトリには入れず、スクリプトで毎回ダウンロードする。
