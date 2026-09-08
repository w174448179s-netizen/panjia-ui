#!/bin/bash
# 检查上游目录是否被盘家业务代码污染

DIRS="src/views/system/ src/layout/ src/api/system/"

for dir in $DIRS; do
  if grep -r "panjia" "$dir" 2>/dev/null; then
    echo "❌ 上游目录被污染：$dir 发现了 panjia 相关引用"
    exit 1
  fi
done

echo "✅ 上游目录干净"
