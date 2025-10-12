import os
import time
import inspect
import logging
from typing import Optional, Dict, Any
from queue import Queue, Empty
from concurrent.futures import Future, TimeoutError as FuturesTimeoutError

from uagents import Agent, Context, Model

# ---------------- Logging ----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bridge")

# ---------------- Env / Config ----------------
SEED_PHRASE = os.getenv("SEED_PHRASE")
AGENT_NAME = os.getenv("AGENT_NAME", "EcoBridge")
MAILBOX_PORT = int(os.getenv("AGENT_PORT", "8020"))   # uAgents mailbox port
HTTP_PORT = int(os.getenv("HTTP_PORT", "8010"))       # FastAPI port for the app
AGENT_ENDPOINT = os.getenv("AGENT_ENDPOINT")          # optional; avoid unless endpoint mode desired
REMOTE_AGENT_ADDRESS = os.getenv("AGENTVERSE_AGENT_ADDRESS")

if not SEED_PHRASE:
    raise RuntimeError("SEED_PHRASE not set. export SEED_PHRASE='your seed phrase'")
if not REMOTE_AGENT_ADDRESS:
    raise RuntimeError("AGENTVERSE_AGENT_ADDRESS not set. export AGENTVERSE_AGENT_ADDRESS='agent1q…'")

# ---------------- Build mailbox agent ----------------
sig = inspect.signature(Agent.__init__)
params = sig.parameters
agent_kwargs = {"name": AGENT_NAME, "seed": SEED_PHRASE}

# Force mailbox mode when supported
if "mailbox" in params:
    agent_kwargs["mailbox"] = True
# Port arg name differs across versions
if "port" in params:
    agent_kwargs["port"] = MAILBOX_PORT
elif "http_port" in params:
    agent_kwargs["http_port"] = MAILBOX_PORT
# Do NOT set endpoint unless explicitly intended (it can override mailbox behavior)
if AGENT_ENDPOINT and "endpoint" in params:
    agent_kwargs["endpoint"] = AGENT_ENDPOINT
    log.warning("[WARN] AGENT_ENDPOINT is set; endpoint mode may override mailbox behavior.")

agent = Agent(**agent_kwargs)

log.info(f"[BOOT] Name={AGENT_NAME} Address={agent.address} MailboxPort={MAILBOX_PORT}")
if AGENT_ENDPOINT:
    log.info(f"[BOOT] Public endpoint: {AGENT_ENDPOINT}")
else:
    log.info("[BOOT] No AGENT_ENDPOINT provided; relying on mailbox connectivity.")

# ---------------- Message models ----------------
class Co2Request(Model):
    user_id: str
    action: str
    distance_km: Optional[float] = None

class Co2Response(Model):
    co2_saved_kg: float
    message: str
    engine: str = "asi_one"

# ---------------- Bridge queue ----------------
_requests_q: "Queue[Dict[str, Any]]" = Queue(maxsize=1024)

# Periodic pump to forward queued HTTP requests to hosted agent
@agent.on_interval(period=0.2)
async def pump_bridge(ctx: Context):
    processed = 0
    while True:
        try:
            item = _requests_q.get_nowait()
        except Empty:
            break
        processed += 1

        future: Future = item["future"]
        payload: Dict[str, Any] = item["payload"]
        req = Co2Request(**payload)
        log.info(f"[BRIDGE] → Sending to hosted agent {REMOTE_AGENT_ADDRESS}: {payload}")
        try:
            resp_obj = await ctx.send_and_receive(
                REMOTE_AGENT_ADDRESS,
                req,
                response_type=Co2Response,
                timeout=25,
            )
            # Normalize response across uAgents variants:
            # It can be:
            #   - Co2Response
            #   - (sender, Co2Response)
            #   - (MsgStatus, Co2Response)
            #   - (Co2Response, MsgStatus)
            #   - MsgStatus (error)
            resp = None
            if isinstance(resp_obj, Co2Response):
                resp = resp_obj
            elif isinstance(resp_obj, tuple) and len(resp_obj) == 2:
                a, b = resp_obj
                if isinstance(a, Co2Response):
                    resp = a
                elif isinstance(b, Co2Response):
                    resp = b
            # Final guard
            if resp is None or not hasattr(resp, "co2_saved_lb"):
                raise RuntimeError(f"Unexpected response from agent: {type(resp_obj).__name__} -> {repr(resp_obj)}")
            result = {
                "user_id": req.user_id,
                "action": req.action,
                "co2_saved_lb": float(resp.co2_saved_kg),
                "message": resp.message,
                "agent_meta": {"engine": resp.engine, "timestamp": int(time.time())},
            }
            future.set_result(result)
            log.info(f"[BRIDGE] ← Received response from hosted agent: {result}")
        except Exception as e:
            future.set_exception(e)
            log.error(f"[BRIDGE] ✗ Failed to get response from hosted agent: {e}")

class Echo(Model):
    message: str

@agent.on_message(model=Echo)
async def echo_handler(ctx: Context, msg: Echo):
    ctx.logger.info(f"[ECHO] {msg.message}")
    await ctx.send(msg.sender, Echo(message=f"Echo: {msg.message}"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

api = FastAPI(title="EcoTrack Bridge API", version="1.0.0")
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@api.get("/health")
def health():
    return {"status": "ok", "ts": int(time.time()), "bridge_address": agent.address}

@api.get("/debug/bridge")
def debug_bridge():
    return {
        "remote_agent": REMOTE_AGENT_ADDRESS,
        "mailbox_port": MAILBOX_PORT,
        "http_port": HTTP_PORT,
    }

@api.post("/co2/savings")
async def co2_savings(payload: Dict[str, Any]):
    required = {"user_id", "action"}
    missing = [k for k in required if k not in payload]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required field(s): {', '.join(missing)}")

    future: Future = Future()
    item = {"payload": payload, "future": future}

    try:
        _requests_q.put(item, timeout=2)
    except Exception:
        raise HTTPException(status_code=503, detail="Bridge is busy; try again.")

    try:
        result = future.result(timeout=30)
        return result
    except FuturesTimeoutError:
        raise HTTPException(status_code=504, detail="Timed out waiting for agent response")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent error: {e}")

def run_api():
    log.info(f"[API] Starting FastAPI on 0.0.0.0:{HTTP_PORT}")
    uvicorn.run(api, host="0.0.0.0", port=HTTP_PORT, log_level="info")

if __name__ == "__main__":
    import threading

    # Start FastAPI in a background thread so the mailbox agent can run in the main thread
    t = threading.Thread(target=run_api, daemon=True)
    t.start()

    try:
        log.info("[BOOT] Starting mailbox agent…")
        agent.run()  
    except Exception as e:
        log.error(f"[FATAL] Agent crashed: {e}")
        raise
