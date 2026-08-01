"""
Minimal FastAPI WebSocket runtime for the P99 voice protocol.

Stub mode (default): no ML models. On end_utterance, sends a short canned
reply as silence-padded PCM so the browser client can be developed end-to-end.

Replace `handle_turn` with real ASR → LLM → TTS when you wire models.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import struct
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

logger = logging.getLogger("p99_runtime")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

MIC_SAMPLE_RATE = 16_000
TTS_SAMPLE_RATE = 24_000
# ~100ms of int16 mono @ 24kHz
_TTS_CHUNK_BYTES = TTS_SAMPLE_RATE * 2 // 10


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("p99-runtime ready (stub pipeline — no models loaded)")
    yield


app = FastAPI(title="p99-runtime", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz():
    return {"ok": True, "runtime": "p99-runtime", "mode": "stub"}


@app.get("/config")
async def config():
    return {
        "mic_sample_rate": MIC_SAMPLE_RATE,
        "tts_sample_rate": TTS_SAMPLE_RATE,
        "frame_ms": 20,
    }


@app.get("/voices")
async def voices():
    return {"voices": ["default"], "default": "default"}


def _ws_open(ws: WebSocket) -> bool:
    return (
        ws.client_state == WebSocketState.CONNECTED
        and ws.application_state == WebSocketState.CONNECTED
    )


async def _send_json(ws: WebSocket, obj: dict) -> None:
    if _ws_open(ws):
        await ws.send_text(json.dumps(obj))


def _silence_pcm(duration_s: float, sample_rate: int = TTS_SAMPLE_RATE) -> bytes:
    n = int(duration_s * sample_rate)
    # near-silence with a tiny soft tone so meters register playback
    frames = []
    for i in range(n):
        # 440Hz sine at very low amplitude
        sample = int(800 * math.sin(2 * math.pi * 440 * i / sample_rate))
        frames.append(struct.pack("<h", max(-32767, min(32767, sample))))
    return b"".join(frames)


async def _send_pcm_chunked(ws: WebSocket, pcm: bytes) -> None:
    for i in range(0, len(pcm), _TTS_CHUNK_BYTES):
        if not _ws_open(ws):
            return
        await ws.send_bytes(pcm[i : i + _TTS_CHUNK_BYTES])
        await asyncio.sleep(0.02)


async def handle_turn(ws: WebSocket, audio_bytes: bytes) -> None:
    """Stub turn: pretend ASR, think, speak a tone + stats."""
    t0 = time.perf_counter()
    await _send_json(ws, {"type": "transcript_final", "text": "(stub) heard audio"})
    await _send_json(ws, {"type": "thinking"})
    await asyncio.sleep(0.05)

    await _send_json(ws, {"type": "speaking_start"})
    await _send_json(
        ws,
        {
            "type": "assistant_text_chunk",
            "text": "Hello from p99-runtime stub. Wire ASR, LLM, and TTS here.",
        },
    )
    await _send_json(ws, {"type": "first_audio"})
    pcm = _silence_pcm(0.6)
    await _send_pcm_chunked(ws, pcm)
    await _send_json(ws, {"type": "speaking_end"})

    total_ms = (time.perf_counter() - t0) * 1000
    await _send_json(
        ws,
        {
            "type": "stats",
            "asr_ms": 1,
            "llm_ttft_ms": 50,
            "llm_full_ms": 50,
            "tts_first_ms": 10,
            "real_first_audio_ms": 10,
            "total_turn_ms": round(total_ms),
            "history_turns": 1,
        },
    )
    _ = len(audio_bytes)  # mic payload available for real ASR


@app.websocket("/ws")
async def voice_ws(ws: WebSocket) -> None:
    await ws.accept()
    mic_buffer: list[bytes] = []
    turn_task: asyncio.Task | None = None

    await _send_json(ws, {"type": "ready"})

    # Short greeting tone
    await _send_json(ws, {"type": "speaking_start"})
    await _send_json(
        ws,
        {
            "type": "assistant_text_chunk",
            "text": "Hi — p99-runtime stub is up. Talk to exercise the client.",
        },
    )
    await _send_pcm_chunked(ws, _silence_pcm(0.45))
    await _send_json(ws, {"type": "speaking_end"})

    try:
        while True:
            message = await ws.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"] is not None:
                mic_buffer.append(message["bytes"])
                continue

            text = message.get("text")
            if not text:
                continue

            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                continue

            mtype = msg.get("type")
            if mtype == "end_utterance":
                audio = b"".join(mic_buffer)
                mic_buffer.clear()
                if turn_task and not turn_task.done():
                    turn_task.cancel()
                turn_task = asyncio.create_task(handle_turn(ws, audio))
            elif mtype == "interrupt":
                if turn_task and not turn_task.done():
                    turn_task.cancel()
                mic_buffer.clear()
            elif mtype == "reset":
                if turn_task and not turn_task.done():
                    turn_task.cancel()
                mic_buffer.clear()
                await _send_json(ws, {"type": "reset_ok"})
            elif mtype == "set_voice":
                logger.info("voice set to %s", msg.get("voice"))
            elif mtype == "proactive":
                await _send_json(ws, {"type": "proactive"})
                await _send_json(ws, {"type": "speaking_start"})
                await _send_json(
                    ws,
                    {
                        "type": "assistant_text_chunk",
                        "text": "Still there? (stub proactive)",
                    },
                )
                await _send_pcm_chunked(ws, _silence_pcm(0.35))
                await _send_json(ws, {"type": "speaking_end"})
            elif mtype == "ping":
                await _send_json(ws, {"type": "ready"})
    except WebSocketDisconnect:
        logger.info("client disconnected")
    finally:
        if turn_task and not turn_task.done():
            turn_task.cancel()
