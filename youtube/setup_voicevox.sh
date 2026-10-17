#!/usr/bin/env bash
# VOICEVOX（合成音声）をクラウド環境に入れ直すスクリプト。
# 使い方: bash youtube/setup_voicevox.sh [入れる場所。省略時は ~/.voicevox]
# VOICEVOX付属のダウンロードツールはGitHub APIを使うため、この環境では動かない。
# そのため配布元から直接ダウンロードし、チェックサムで中身を確認する。
set -euo pipefail

DEST="${1:-$HOME/.voicevox}"
CORE_VER=0.16.4
ORT_VER=1.17.3
VVM_VER=0.16.4
GH=https://github.com

mkdir -p "$DEST/vvms" "$DEST/onnxruntime" "$DEST/dict" "$DEST/dl"

fetch() { # url 保存先 sha256
  if [ -f "$2" ] && echo "$3  $2" | sha256sum -c --quiet - 2>/dev/null; then return; fi
  curl -sSLf --retry 3 -o "$2" "$1"
  echo "$3  $2" | sha256sum -c --quiet -
}

WHL="voicevox_core-$CORE_VER-cp310-abi3-manylinux_2_34_x86_64.whl"
fetch "$GH/VOICEVOX/voicevox_core/releases/download/$CORE_VER/$WHL" "$DEST/dl/$WHL" \
  a9fdcffa2de4e365c1e0eda20d723ac87f66770d41c21299ca0e15b8267bd09d
fetch "$GH/VOICEVOX/onnxruntime-builder/releases/download/voicevox_onnxruntime-$ORT_VER/voicevox_onnxruntime-linux-x64-$ORT_VER.tgz" \
  "$DEST/dl/ort.tgz" 72b5287fdd48dc833a9929f6e9e3826e793b54ce1202181be93f63823a222f58
fetch "$GH/r9y9/open_jtalk/releases/download/v1.11.1/open_jtalk_dic_utf_8-1.11.tar.gz" \
  "$DEST/dl/dic.tgz" fe6ba0e43542cef98339abdffd903e062008ea170b04e7e2a35da805902f382a
# 4.vvm = 玄野武宏（スタイルID 11）、1.vvm = 冥鳴ひまり（スタイルID 14）
fetch "$GH/VOICEVOX/voicevox_vvm/releases/download/$VVM_VER/4.vvm" "$DEST/vvms/4.vvm" \
  da5aaad87d5b7ea5b346def2e610cc63e64a90088bb0fc2d27fb63a622113953
fetch "$GH/VOICEVOX/voicevox_vvm/releases/download/$VVM_VER/1.vvm" "$DEST/vvms/1.vvm" \
  8df20815be9a84a4b4723b9e778d2ef6a4df277e4872fe9efe29676a60e02774

tar xzf "$DEST/dl/ort.tgz" -C "$DEST/onnxruntime"
tar xzf "$DEST/dl/dic.tgz" -C "$DEST/dict"
pip install -q "$DEST/dl/$WHL"
echo "VOICEVOX を $DEST に用意しました"
