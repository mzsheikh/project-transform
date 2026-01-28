import json
import os
import urllib.error
import urllib.request

from fastapi import HTTPException

NEST_API_BASE = os.getenv("NEST_API_BASE_URL", "http://localhost:3000")
AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN")


def nest_headers() -> dict:
    if not AI_SERVICE_TOKEN:
        raise HTTPException(status_code=500, detail="AI_SERVICE_TOKEN not configured")
    return {
        "X-AI-Service-Token": AI_SERVICE_TOKEN,
        "Content-Type": "application/json",
    }


def nest_put(path: str, payload: dict):
    req = urllib.request.Request(
        f"{NEST_API_BASE}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers=nest_headers(),
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode()}


def nest_post(path: str, payload: dict):
    req = urllib.request.Request(
        f"{NEST_API_BASE}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers=nest_headers(),
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"_error": e.code, "_body": e.read().decode()}
