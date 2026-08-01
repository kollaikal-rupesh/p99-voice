"""CLI entry: p99-runtime serve --port 8787"""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="p99-runtime",
        description="Local P99 voice runtime (open protocol)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    serve = sub.add_parser("serve", help="Start the WebSocket voice server")
    serve.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address. Use 0.0.0.0 to expose on your network "
        "(put TLS + auth in front first). Default: 127.0.0.1",
    )
    serve.add_argument("--port", type=int, default=8787)

    args = parser.parse_args()
    if args.cmd == "serve":
        import uvicorn

        from p99_runtime.server import app

        print(f"p99-runtime listening on ws://{args.host}:{args.port}/ws")
        print("Protocol: docs/protocol.md")
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
