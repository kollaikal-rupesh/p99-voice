"""Smoke tests for the stub runtime: HTTP endpoints + a full WS voice turn."""

import json

from fastapi.testclient import TestClient

from p99_runtime.server import MIC_SAMPLE_RATE, TTS_SAMPLE_RATE, app


def test_healthz():
    with TestClient(app) as client:
        r = client.get("/healthz")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["runtime"] == "p99-runtime"


def test_config_reports_protocol_sample_rates():
    with TestClient(app) as client:
        r = client.get("/config")
        assert r.status_code == 200
        body = r.json()
        assert body["mic_sample_rate"] == MIC_SAMPLE_RATE
        assert body["tts_sample_rate"] == TTS_SAMPLE_RATE


def test_voices_lists_default():
    with TestClient(app) as client:
        r = client.get("/voices")
        assert r.status_code == 200
        assert "default" in r.json()["voices"]


def _drain_until(ws, wanted_type, limit=200):
    """Read frames (text or binary) until a JSON message of wanted_type."""
    seen = []
    for _ in range(limit):
        frame = ws.receive()
        if frame.get("text") is not None:
            msg = json.loads(frame["text"])
            seen.append(msg)
            if msg.get("type") == wanted_type:
                return msg, seen
        # binary PCM frames are counted but not parsed
    raise AssertionError(f"never saw {wanted_type!r}; got {seen}")


def test_ws_full_stub_turn():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ready = json.loads(ws.receive_text())
            assert ready["type"] == "ready"

            # greeting plays first
            _drain_until(ws, "speaking_end")

            # send one utterance: 100ms of silence @ 16kHz int16 mono
            ws.send_bytes(b"\x00\x00" * (MIC_SAMPLE_RATE // 10))
            ws.send_text(json.dumps({"type": "end_utterance"}))

            transcript, _ = _drain_until(ws, "transcript_final")
            assert transcript["text"]

            stats, seen = _drain_until(ws, "stats")
            assert stats["total_turn_ms"] >= 0
            types = [m["type"] for m in seen]
            assert "speaking_start" in types
            assert "speaking_end" in types


def test_ws_reset_acknowledged():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            assert json.loads(ws.receive_text())["type"] == "ready"
            _drain_until(ws, "speaking_end")

            ws.send_text(json.dumps({"type": "reset"}))
            _drain_until(ws, "reset_ok")
