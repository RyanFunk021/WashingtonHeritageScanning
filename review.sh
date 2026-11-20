#!/bin/sh
# Open the page with comment fields on it. Click anything, comment or rewrite
# its text, then "Copy JSON" and paste it into Claude.
# Same as adding ?feedback on the live site, but shows unpublished edits.
# The port stays fixed because the browser keeps your notes per address.
cd "$(dirname "$0")"
PORT=8820
URL="http://127.0.0.1:$PORT/index.html?feedback"

if curl -s -o /dev/null "$URL"; then
  open "$URL"
  echo "Already running: $URL"
  exit 0
fi

python3 - "$PORT" <<'PY' &
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    # Always serve the current files, so edits show up on a plain reload.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), NoCache).serve_forever()
PY
PID=$!
trap 'kill $PID 2>/dev/null' EXIT INT TERM
sleep 0.5
open "$URL"
echo "Reviewing at $URL  (Ctrl-C stops the server; your notes stay in the browser)"
wait $PID
