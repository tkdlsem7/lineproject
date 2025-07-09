from fastapi import FastAPI
from routers import progress
from fastapi.middleware.cors import CORSMiddleware
from routers import auth

app = FastAPI()

app.include_router(auth.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 또는 5173, 혹은 ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "✅ FastAPI is running"}

app.include_router(progress.router, prefix="/progress", tags=["Progress"])
