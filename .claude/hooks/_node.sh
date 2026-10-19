# Sourced by the hook scripts. Hooks run in a plain `sh -c` that does not load nvm, and the
# system node on this host is too old for Astro 7 (.nvmrc wants 22). Load nvm when needed;
# if Node 22+ is still missing, fail visibly (exit 2 + stderr) instead of passing.
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 22 ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1
fi
if [ "$(node_major)" -lt 22 ]; then
  echo "Hook $(basename "$0") needs Node 22+ (.nvmrc); found $(node -v 2>/dev/null || echo none). Install it with nvm." >&2
  exit 2
fi
