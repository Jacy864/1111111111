#!/usr/bin/env bash
# 構建：把 src 合成單檔 index.html
set -e
cd "$(dirname "$0")"
for f in src/data.js src/engine.js src/ui.js; do node --check "$f"; done
python3 - <<'EOF'
tpl = open("src/index.template.html").read()
parts = {
  "__CSS__": open("src/style.css").read(),
  "__DATA__": open("src/data.js").read(),
  "__ENGINE__": open("src/engine.js").read(),
  "__UI__": open("src/ui.js").read(),
}
for k, v in parts.items():
    assert k in tpl, k
    tpl = tpl.replace(k, v)
assert "__" not in tpl.replace("__proto__", "").replace("__CSS__",""), "殘留佔位符"
open("index.html", "w").write(tpl)
print("built index.html", len(tpl), "bytes")
EOF
