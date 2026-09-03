from fastapi import FastAPI
from app.router import router


app = FastAPI()


@app.get("/")
def read_root():
    return {"Test": "Success"}

app.include_router(router)