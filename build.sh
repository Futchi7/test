#!/bin/sh
# src/app.html（本体）から、そのままブラウザで開ける index.html を生成する
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="theme-color" content="#EAF2EF">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  printf '</head>\n<body>\n'
  cat src/app.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "built index.html"
