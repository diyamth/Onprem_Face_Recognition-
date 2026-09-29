from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.services.zmq_listener import start_all_listeners
import threading

app = FastAPI(title="SMG Face Gateway")

# Add CORS middleware BEFORE including routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include router after middleware setup
app.include_router(router)

@app.on_event("startup")
def startup():
    thread = threading.Thread(target=start_all_listeners, daemon=True)
    thread.start()

@app.get("/health")
def health():
    return {"status": "ok"}
