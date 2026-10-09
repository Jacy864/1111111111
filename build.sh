#!/usr/bin/env bash
# 構建：把 src 合成單檔 index.html
set -e
cd "$(dirname "$0")"
python3 - <<'EOF'
tpl = open("src/index.template.html").read()
parts = {
  "__CSS__": open("src/style.css").read(),
  "__DATA__": open("src/data.js").read(),
  "__PERS__": open("src/pers.js").read(),
  "__ENGINE__": open("src/engine.js").read(),
  "__UI__": open("src/ui.js").read(),
  "__UI2__": open("src/ui2.js").read(),
}
for k, v in parts.items():
    assert k in tpl, k
    tpl = tpl.replace(k, v)
assert "__" not in tpl.replace("__proto__",""), "殘留佔位符"
open("index.html", "w").write(tpl)
print("built index.html", len(tpl), "bytes")
EOF
