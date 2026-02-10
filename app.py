#!/usr/bin/env python3
"""Serve Textree web app locally."""

from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class UTF8StaticHandler(SimpleHTTPRequestHandler):
    """Static handler with UTF-8 defaults for text assets."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }



def run_server(port: int) -> None:
    handler = functools.partial(UTF8StaticHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"Textree web app running at http://localhost:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")



def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run local web server for Textree treemap experience."
    )
    parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    args = parser.parse_args()
    run_server(args.port)


if __name__ == "__main__":
    main()
