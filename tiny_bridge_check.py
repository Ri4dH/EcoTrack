from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Tiny Check")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    print(">>> Starting Tiny FastAPI on 0.0.0.0:8010")
    uvicorn.run(app, host="0.0.0.0", port=8010, log_level="info")
