#!/usr/bin/env python3
"""Loopback-only launcher with an allowlist of files needed by the game."""
import http.server
import os
import posixpath
import socketserver
import threading
import urllib.parse
import webbrowser

ROOT = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
ALLOWED_FILES = {"index.html", "style.css"}
ALLOWED_DIRS = {"src", "vendor", "assets", "public"}


def resolve_request(root, request_path):
    """Return a permitted absolute file path, or None for every other request."""
    try:
        path = urllib.parse.unquote(urllib.parse.urlsplit(str(request_path)).path, errors="strict")
    except (UnicodeDecodeError, ValueError):
        return None
    if "\x00" in path or "\\" in path:
        return None
    path = path.lstrip("/")
    if path == "":
        path = "index.html"
    if path.endswith("/"):
        return None  # Do not expose directory listings.
    normalized = posixpath.normpath(path)
    if normalized in (".", "..") or normalized.startswith("../") or normalized.startswith("/"):
        return None
    parts = normalized.split("/")
    if any(not part or part.startswith(".") for part in parts):
        return None
    if len(parts) == 1:
        if normalized not in ALLOWED_FILES:
            return None
    elif parts[0] not in ALLOWED_DIRS:
        return None

    base = os.path.realpath(root)
    candidate = os.path.realpath(os.path.join(base, *parts))
    if not candidate.startswith(base + os.sep) or not os.path.isfile(candidate):
        return None
    return candidate


V = os.path.join(ROOT, "vendor", "three.min.js")
if not os.path.isfile(V):
    print(
        "Three.js r128 is not bundled. The browser will try configured CDN mirrors; "
        "for offline play, install dependencies and run: npm run prepare:vendor"
    )

PORT = int(os.environ.get("PORT", 8080))


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, request_path):
        # SimpleHTTPRequestHandler normally exposes the entire project directory.
        # Resolve against an explicit allowlist so tests, docs and config stay private.
        return resolve_request(ROOT, request_path) or os.path.join(ROOT, "__not_found__")

    def list_directory(self, path):
        self.send_error(403, "Directory listing is disabled")
        return None

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), GameHandler) as server:
    url = "http://127.0.0.1:%d/" % PORT
    print("BLACK VEIL is running at", url, " (Ctrl+C to stop)")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
