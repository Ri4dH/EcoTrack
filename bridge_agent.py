"""
EcoTrack Bridge Agent - Local Mailbox to Agentverse Bridge
Connects Expo app (via FastAPI) to hosted Agentverse agent (via uAgents messaging)

ALL CO₂ calculations come from the hosted agent (which uses ASI:One)
NO local fallback math - if hosted agent fails, we return an error
"""
import os
import sys
import time
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uagents import Agent, Context, Model
import uvicorn

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# ========== Configuration ==========
AGENTVERSE_AGENT_ADDRESS = os.getenv("AGENTVERSE_AGENT_ADDRESS")
SEED_PHRASE = os.getenv("SEED_PHRASE")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8010"))  # uAgent mailbox port
HTTP_PORT = int(os.getenv("HTTP_PORT", "8000"))    # FastAPI HTTP port
TIMEOUT_SECONDS = int(os.getenv("TIMEOUT_SECONDS", "30"))

# Validate required config
print("=" * 60)
print("🌉 EcoTrack Bridge Agent - Starting")
print("=" * 60)

if not AGENTVERSE_AGENT_ADDRESS:
    print("❌ ERROR: AGENTVERSE_AGENT_ADDRESS not set")
    print("   Set with: export AGENTVERSE_AGENT_ADDRESS='agent1q...'")
    sys.exit(1)

if not SEED_PHRASE:
    print("❌ ERROR: SEED_PHRASE not set")
    print("   Set with: export SEED_PHRASE='your seed phrase...'")
    sys.exit(1)

print(f"[CONFIG] Agentverse Address: {AGENTVERSE_AGENT_ADDRESS}")
print(f"[CONFIG] Agent Port (mailbox): {AGENT_PORT}")
print(f"[CONFIG] HTTP Port (FastAPI): {HTTP_PORT}")
print(f"[CONFIG] Timeout: {TIMEOUT_SECONDS}s")
print("=" * 60)

# ========== uAgent Models ==========
class Co2Request(Model):
    """Request model for CO₂ calculation"""
    user_id: str
    action: str
    distance_km: Optional[float] = None

class Co2Response(Model):
    """Response model from hosted agent"""
    user_id: str
    action: str
    co2_saved_kg: float
    message: str
    engine: str = "asi_one"

# ========== FastAPI Models ==========
class HttpCo2Request(BaseModel):
    """HTTP request from Expo app"""
    user_id: str
    action: str
    distance_km: Optional[float] = None

class HttpCo2Response(BaseModel):
    """HTTP response to Expo app"""
    user_id: str
    action: str
    co2_saved_kg: float
    message: str
    agent_meta: dict

# ========== Initialize uAgent ==========
agent = Agent(
    name="ecotrack_bridge",
    seed=SEED_PHRASE,
    port=AGENT_PORT,
    mailbox=True
)

print(f"[AGENT] Bridge agent initialized")
print(f"[AGENT] Address: {agent.address}")
print(f"[AGENT] Mailbox: Enabled")

# ========== FastAPI App ==========
app = FastAPI(
    title="EcoTrack Bridge API",
    description="Local bridge between Expo app and Agentverse agent",
    version="1.0.0"
)

# CORS - allow all for Expo development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Global Context Storage ==========
# We need to store the agent context to use send_and_receive in FastAPI routes
agent_ctx: Optional[Context] = None

@agent.on_event("startup")
async def startup(ctx: Context):
    """Store agent context on startup"""
    global agent_ctx
    agent_ctx = ctx
    print(f"[AGENT] Startup complete - Context stored")
    print(f"[AGENT] Ready to bridge messages to {AGENTVERSE_AGENT_ADDRESS}")

# ========== Message Handlers ==========
@agent.on_message(model=Co2Response)
async def handle_co2_response(ctx: Context, sender: str, msg: Co2Response):
    """
    Handle CO₂ responses from Agentverse agent
    This is called automatically by send_and_receive
    """
    print(f"[AGENT] 📥 Received CO₂ response from {sender}")
    print(f"[AGENT]    co2_saved_kg: {msg.co2_saved_kg}")
    print(f"[AGENT]    message: {msg.message[:50]}...")
    print(f"[AGENT]    engine: {msg.engine}")

# ========== FastAPI Routes ==========
@app.get("/")
def root():
    """Root endpoint"""
    print("[HTTP] GET / - Root endpoint")
    return {
        "status": "EcoTrack Bridge active",
        "version": "1.0.0",
        "bridge_agent": agent.address,
        "target_agent": AGENTVERSE_AGENT_ADDRESS,
        "endpoints": ["/", "/health", "/co2/savings"]
    }

@app.get("/health")
def health():
    """Health check endpoint"""
    print("[HTTP] GET /health - Health check")
    return {
        "status": "ok",
        "bridge_agent": agent.address,
        "target_agent": AGENTVERSE_AGENT_ADDRESS,
        "mailbox": "enabled"
    }

@app.post("/co2/savings")
async def calculate_savings(req: HttpCo2Request):
    """
    Calculate CO₂ savings by forwarding to Agentverse agent
    NO local calculation - all values come from hosted agent
    """
    print("=" * 80)
    print(f"[HTTP] 📥 POST /co2/savings")
    print(f"[HTTP]    user_id: {req.user_id}")
    print(f"[HTTP]    action: {req.action}")
    print(f"[HTTP]    distance_km: {req.distance_km}")
    print("=" * 80)

    # Check if agent context is available
    if agent_ctx is None:
        print("[HTTP] ❌ ERROR: Agent context not initialized")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "BRIDGE_NOT_READY",
                "details": "Bridge agent is still initializing",
                "hint": "Wait a few seconds and try again"
            }
        )

    # Validate action
    valid_actions = ["bike_trip", "walk_trip", "recycled", "ate_vegetarian"]
    if req.action not in valid_actions:
        print(f"[HTTP] ❌ Invalid action: {req.action}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_ACTION",
                "details": f"Action must be one of: {', '.join(valid_actions)}",
                "hint": f"You provided: {req.action}"
            }
        )

    # Validate distance for trip actions
    if req.action in ["bike_trip", "walk_trip"]:
        if req.distance_km is None or req.distance_km <= 0:
            print(f"[HTTP] ❌ Invalid distance: {req.distance_km}")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "INVALID_DISTANCE",
                    "details": f"Distance must be > 0 for {req.action}",
                    "hint": f"You provided: {req.distance_km}"
                }
            )

    # Create request for Agentverse agent
    agent_request = Co2Request(
        user_id=req.user_id,
        action=req.action,
        distance_km=req.distance_km
    )

    print(f"[BRIDGE] 🚀 Sending request to Agentverse agent...")
    print(f"[BRIDGE]    Target: {AGENTVERSE_AGENT_ADDRESS}")
    print(f"[BRIDGE]    Timeout: {TIMEOUT_SECONDS}s")

    try:
        # Send message and wait for response
        response = await agent_ctx.send_and_receive(
            AGENTVERSE_AGENT_ADDRESS,
            agent_request,
            timeout=TIMEOUT_SECONDS
        )

        print(f"[BRIDGE] ✅ Received response from Agentverse agent")

        # Validate response type
        if not isinstance(response, Co2Response):
            print(f"[BRIDGE] ❌ ERROR: Unexpected response type: {type(response)}")
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "INVALID_RESPONSE_TYPE",
                    "details": f"Expected Co2Response, got {type(response).__name__}",
                    "hint": "Check that the Agentverse agent is sending Co2Response messages"
                }
            )

        # Validate CO₂ value
        if not isinstance(response.co2_saved_kg, (int, float)):
            print(f"[BRIDGE] ❌ ERROR: Invalid co2_saved_kg: {response.co2_saved_kg}")
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "INVALID_CO2_VALUE",
                    "details": f"co2_saved_kg must be a number, got {type(response.co2_saved_kg).__name__}",
                    "hint": "Check the Agentverse agent's CO₂ calculation logic"
                }
            )

        # Build HTTP response
        http_response = {
            "user_id": response.user_id,
            "action": response.action,
            "co2_saved_kg": float(response.co2_saved_kg),
            "message": response.message,
            "agent_meta": {
                "engine": response.engine,
                "bridge_agent": agent.address,
                "target_agent": AGENTVERSE_AGENT_ADDRESS,
                "timestamp": int(time.time())
            }
        }

        print(f"[BRIDGE] ✅ Success!")
        print(f"[BRIDGE]    co2_saved_kg: {http_response['co2_saved_kg']}")
        print(f"[BRIDGE]    engine: {response.engine}")
        print("=" * 80)

        return http_response

    except asyncio.TimeoutError:
        print(f"[BRIDGE] ❌ TIMEOUT: No response after {TIMEOUT_SECONDS}s")
        raise HTTPException(
            status_code=504,
            detail={
                "error": "AGENT_TIMEOUT",
                "details": f"Agentverse agent did not respond within {TIMEOUT_SECONDS} seconds",
                "hint": "Check that the Agentverse agent is running and accessible"
            }
        )

    except Exception as e:
        print(f"[BRIDGE] ❌ ERROR: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": "AGENT_COMPUTE_FAILED",
                "details": f"Failed to get CO₂ calculation from Agentverse agent: {e}",
                "hint": "Check Agentverse agent logs and connectivity"
            }
        )

# ========== Run Both Servers ==========
async def run_agent():
    """Run the uAgent in the background"""
    print("[AGENT] Starting uAgent mailbox...")
    agent.run()

def run_fastapi():
    """Run FastAPI server"""
    print(f"[HTTP] Starting FastAPI on port {HTTP_PORT}...")
    print()
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=HTTP_PORT,
        log_level="info"
    )

if __name__ == "__main__":
    # Start FastAPI (which will also run the agent via startup event)
    # Note: The agent.run() needs to be in the background
    # For simplicity, we'll use the agent's built-in async loop

    print("🚀 Starting EcoTrack Bridge Agent")
    print(f"   uAgent mailbox on port {AGENT_PORT}")
    print(f"   FastAPI HTTP on port {HTTP_PORT}")
    print()

    # Run FastAPI with agent integration
    # The agent will start automatically via the @agent.on_event("startup") handler
    run_fastapi()
