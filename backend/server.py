"""
FORGE — AI Full-Stack App Developer SaaS
Backend powered by FastAPI + MongoDB + Claude Sonnet 4.5 + Emergent Auth.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import re
import json
import asyncio
import zipfile
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest
)

try:
    import resend  # optional — transactional emails
except ImportError:
    resend = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----------------------- MongoDB -----------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
APP_URL = os.environ.get("APP_URL", "https://buildforge-ai.preview.emergentagent.com")

if resend and RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


async def _send_email(to_email: str, subject: str, html: str) -> dict:
    """Graceful email helper. Logs + no-ops when RESEND not configured."""
    if not (resend and RESEND_API_KEY):
        logging.info(f"[email mock] → {to_email} · {subject}")
        return {"status": "mocked", "to": to_email}
    try:
        params = {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html}
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "id": email.get("id")}
    except Exception as e:
        logging.exception("Resend send failed")
        return {"status": "failed", "error": str(e)[:160]}


async def _log_activity(project_id: str, actor: dict, event_type: str, detail: Optional[str] = None, meta: Optional[dict] = None):
    """Append a row to project_activity collection."""
    await db.project_activity.insert_one({
        "activity_id": f"act_{uuid.uuid4().hex[:10]}",
        "project_id": project_id,
        "actor_user_id": actor.get("user_id"),
        "actor_name": actor.get("name"),
        "actor_email": actor.get("email"),
        "event_type": event_type,  # e.g. project.shared, member.invited, member.role_changed, member.removed, file.edited, message.sent
        "detail": detail or "",
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ----------------------- Live (WebSocket) presence ----------------------
class ConnectionManager:
    """Tracks websocket connections per project and broadcasts events."""
    def __init__(self):
        self.rooms: dict[str, list] = {}  # project_id -> [{"ws":ws,"user":{...}}]

    async def connect(self, project_id: str, ws: WebSocket, user_info: dict):
        self.rooms.setdefault(project_id, []).append({"ws": ws, "user": user_info})

    def disconnect(self, project_id: str, ws: WebSocket):
        conns = self.rooms.get(project_id, [])
        self.rooms[project_id] = [c for c in conns if c["ws"] is not ws]
        if not self.rooms[project_id]:
            self.rooms.pop(project_id, None)

    def presence(self, project_id: str):
        seen = {}
        for c in self.rooms.get(project_id, []):
            u = c["user"]
            seen[u["user_id"]] = u
        return list(seen.values())

    async def broadcast(self, project_id: str, payload: dict, exclude_ws=None):
        dead = []
        for c in list(self.rooms.get(project_id, [])):
            if c["ws"] is exclude_ws:
                continue
            try:
                await c["ws"].send_json(payload)
            except Exception:
                dead.append(c["ws"])
        for ws in dead:
            self.disconnect(project_id, ws)


manager = ConnectionManager()

# Fixed subscription packages (defined server-side for security)
# Stripe Checkout in one-time mode — each purchase tops up credits. Subscriptions
# simulated via monthly-equivalent credit packs.
PACKAGES = {
    "studio":  {"name": "Studio",  "amount": 29.00, "credits": 2000,  "label": "Studio tier — 2,000 credits / month"},
    "maison":  {"name": "Maison",  "amount": 99.00, "credits": 10000, "label": "Maison tier — 10,000 credits / month"},
    "topup_small":  {"name": "Credit pack — small",  "amount": 10.00, "credits": 500,  "label": "500 credits"},
    "topup_large":  {"name": "Credit pack — large",  "amount": 29.00, "credits": 2000, "label": "2,000 credits"},
}


# ----------------------- App --------------------------
app = FastAPI(title="FORGE API")
api_router = APIRouter(prefix="/api")


# ----------------------- Models -----------------------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    credits: int = 100
    tier: str = "atelier"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Project(BaseModel):
    project_id: str = Field(default_factory=lambda: f"prj_{uuid.uuid4().hex[:10]}")
    user_id: str
    name: str
    description: str = ""
    stack: str = "react-fastapi"
    public: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    stack: Optional[str] = "react-fastapi"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    public: Optional[bool] = None


class InviteRequest(BaseModel):
    email: str
    role: Optional[str] = "editor"  # "editor" or "viewer"


class MemberUpdate(BaseModel):
    role: str  # "editor" or "viewer"


class Message(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:10]}")
    project_id: str
    role: str  # "user" | "assistant"
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    content: str


class Template(BaseModel):
    template_id: str
    name: str
    description: str
    icon: str
    prompt: str


# ----------------------- Auth -------------------------
SYSTEM_PROMPT = """You are FORGE, an elite AI full-stack app developer. You generate production-ready web applications using React + FastAPI + MongoDB.

Your personality: direct, technical, confident. You write clean, modern code. You never apologize unnecessarily. You speak like a senior engineer.

When the user describes an app idea:
1. Acknowledge the idea in 1 short sentence.
2. Output a plan (3-5 bullets) of what you'll build.
3. Generate runnable code using fenced markdown blocks (```jsx, ```python, ```css) with clear file path comments like `// frontend/src/App.js`.
4. Keep responses focused — do NOT regenerate unchanged files.

Use Tailwind CSS, shadcn/ui components, and lucide-react icons on frontend. Use FastAPI + motor + pydantic on backend. Always prefix backend routes with /api."""


async def get_current_user(request: Request) -> User:
    """Resolve current user from session_token cookie or Authorization header."""
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange Emergent session_id (from frontend) for a persistent session_token cookie."""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")

    # Call Emergent's session-data endpoint
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing.get("name")),
                      "picture": data.get("picture", existing.get("picture"))}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "credits": 100,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user}


@api_router.get("/auth/me")
async def auth_me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ----------------------- Projects ----------------------
async def _user_can_access_project(project_id: str, user: User) -> Optional[dict]:
    """Returns the project doc if user is owner or collaborator, else None.
    Attaches `member_role` attribute: 'owner' | 'editor' | 'viewer'."""
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        return None
    if project["user_id"] == user.user_id:
        project["member_role"] = "owner"
        return project
    membership = await db.project_members.find_one(
        {"project_id": project_id, "email": user.email}, {"_id": 0}
    )
    if membership:
        project["member_role"] = membership.get("role", "editor")
        return project
    return None


@api_router.get("/projects")
async def list_projects(user: User = Depends(get_current_user)):
    # Projects user owns + projects user is a collaborator on
    memberships = await db.project_members.find({"email": user.email}, {"_id": 0}).to_list(200)
    shared_ids = [m["project_id"] for m in memberships]
    cursor = db.projects.find(
        {"$or": [{"user_id": user.user_id}, {"project_id": {"$in": shared_ids}}]},
        {"_id": 0}
    ).sort("updated_at", -1)
    projects = await cursor.to_list(100)
    # Attach role
    for p in projects:
        p["role"] = "owner" if p["user_id"] == user.user_id else "collaborator"
    return projects


@api_router.post("/projects")
async def create_project(payload: ProjectCreate, user: User = Depends(get_current_user)):
    project = Project(user_id=user.user_id, name=payload.name,
                      description=payload.description or "", stack=payload.stack or "react-fastapi")
    doc = project.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user: User = Depends(get_current_user)):
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    msgs_cursor = db.messages.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1)
    messages = await msgs_cursor.to_list(1000)
    members = await db.project_members.find({"project_id": project_id}, {"_id": 0}).to_list(50)
    project["role"] = "owner" if project["user_id"] == user.user_id else "collaborator"
    return {"project": project, "messages": messages, "members": members}


@api_router.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectUpdate, user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or not owner")
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


@api_router.post("/projects/{project_id}/invite")
async def invite_collaborator(project_id: str, payload: InviteRequest, user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or not owner")
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if email == user.email.lower():
        raise HTTPException(status_code=400, detail="You are the owner")
    existing = await db.project_members.find_one(
        {"project_id": project_id, "email": email}, {"_id": 0}
    )
    if existing:
        return {"already_invited": True, "email": email}
    member = {
        "member_id": f"mem_{uuid.uuid4().hex[:10]}",
        "project_id": project_id,
        "email": email,
        "role": payload.role if payload.role in ("editor", "viewer") else "editor",
        "invited_by": user.user_id,
        "invited_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.project_members.insert_one(member)
    member.pop("_id", None)
    await _log_activity(project_id, actor={"user_id": user.user_id, "name": user.name, "email": user.email},
                        event_type="member.invited",
                        detail=f"Invited {email} as {member['role']}")
    # Fire-and-forget invite email
    invite_link = f"{APP_URL}/project/{project_id}"
    html = f"""
    <div style="font-family:ui-sans-serif,system-ui;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="font-family:Georgia,serif;color:#0E0D0A;font-weight:500">You've been invited to Forge.</h2>
      <p style="color:#484542;line-height:1.6">
        <b>{user.name or user.email}</b> invited you to collaborate on
        <b>{project['name']}</b> as a <b>{member['role']}</b>.
      </p>
      <p style="margin-top:24px">
        <a href="{invite_link}" style="background:#F25C05;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:500">
          Open project →
        </a>
      </p>
      <p style="color:#7D7A72;font-size:12px;margin-top:32px">Sent by Forge · you're receiving this because your email was invited to a project.</p>
    </div>"""
    asyncio.create_task(_send_email(email, f"{user.name or user.email} invited you to {project['name']}", html))
    return member


@api_router.patch("/projects/{project_id}/members/{member_id}")
async def update_member(project_id: str, member_id: str, payload: MemberUpdate,
                       user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or not owner")
    if payload.role not in ("editor", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    res = await db.project_members.update_one(
        {"member_id": member_id, "project_id": project_id},
        {"$set": {"role": payload.role}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    updated = await db.project_members.find_one({"member_id": member_id}, {"_id": 0})
    await _log_activity(project_id, actor={"user_id": user.user_id, "name": user.name, "email": user.email},
                        event_type="member.role_changed",
                        detail=f"Changed {updated['email']} to {payload.role}")
    return updated


@api_router.delete("/projects/{project_id}/members/{member_id}")
async def remove_member(project_id: str, member_id: str, user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id, "user_id": user.user_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or not owner")
    res = await db.project_members.delete_one({"member_id": member_id, "project_id": project_id})
    return {"removed": res.deleted_count}


@api_router.get("/share/{project_id}")
async def get_shared_project(project_id: str):
    """Public read-only view of a project if public=true. No auth required."""
    project = await db.projects.find_one({"project_id": project_id, "public": True}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found or private")
    msgs_cursor = db.messages.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1)
    messages = await msgs_cursor.to_list(1000)
    owner = await db.users.find_one({"user_id": project["user_id"]}, {"_id": 0, "name": 1, "picture": 1})
    return {"project": project, "messages": messages, "owner": owner or {}}


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: User = Depends(get_current_user)):
    res = await db.projects.delete_one({"project_id": project_id, "user_id": user.user_id})
    await db.messages.delete_many({"project_id": project_id})
    await db.project_members.delete_many({"project_id": project_id})
    return {"deleted": res.deleted_count}


@api_router.post("/projects/{project_id}/chat")
async def chat(project_id: str, payload: ChatRequest, user: User = Depends(get_current_user)):
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("member_role") == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot send messages")
    if user.credits <= 0:
        raise HTTPException(status_code=402, detail="Out of credits")

    # Persist user message
    user_msg = Message(project_id=project_id, role="user", content=payload.content)
    user_doc = user_msg.model_dump()
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.messages.insert_one(user_doc)

    # Load history for context
    history_cursor = db.messages.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1)
    history = await history_cursor.to_list(200)

    try:
        chat_client = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=project_id,
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        # Re-inject all prior messages so the session sees full context
        # LlmChat uses session_id internally but we send current turn fresh.
        prompt = payload.content
        # Add lightweight project context to first user message
        preamble = f"[Project: {project['name']}]\n[Stack: {project.get('stack','react-fastapi')}]\n\n"
        if len([m for m in history if m["role"] == "user"]) <= 1:
            prompt = preamble + payload.content

        reply = await chat_client.send_message(UserMessage(text=prompt))
    except Exception as e:
        logging.exception("LLM error")
        reply = f"[FORGE Error] Unable to reach model: {str(e)[:200]}"

    # Persist AI reply
    ai_msg = Message(project_id=project_id, role="assistant", content=reply)
    ai_doc = ai_msg.model_dump()
    ai_doc["created_at"] = ai_doc["created_at"].isoformat()
    await db.messages.insert_one(ai_doc)
    ai_doc.pop("_id", None)  # Remove MongoDB ObjectId before returning

    # Deduct credits & update project updated_at
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {"credits": -1}})
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Broadcast to other connected collaborators
    sender = {"user_id": user.user_id, "name": user.name, "email": user.email, "picture": user.picture}
    user_doc.pop("_id", None)
    await manager.broadcast(project_id, {"type": "message", "message": user_doc, "sender": sender})
    await manager.broadcast(project_id, {"type": "message", "message": ai_doc, "sender": {"user_id": "forge", "name": "Forge"}})
    await _log_activity(project_id, actor=sender, event_type="message.sent",
                        detail=(payload.content[:120] + ("…" if len(payload.content) > 120 else "")))

    return {"message": ai_doc}


# ----------------------- Chat Streaming (SSE) ----------------------
@api_router.post("/projects/{project_id}/chat/stream")
async def chat_stream(project_id: str, payload: ChatRequest, user: User = Depends(get_current_user)):
    """SSE endpoint that streams the assistant reply token-by-token.
    We call the LLM once (emergentintegrations returns a full response) then stream
    it word-by-word to give real-time UX. Both user + assistant messages are persisted."""
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("member_role") == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot send messages")
    if user.credits <= 0:
        raise HTTPException(status_code=402, detail="Out of credits")

    # Persist user message up-front
    user_msg = Message(project_id=project_id, role="user", content=payload.content)
    user_doc = user_msg.model_dump()
    user_doc["created_at"] = user_doc["created_at"].isoformat()
    await db.messages.insert_one(user_doc)
    user_doc.pop("_id", None)

    async def event_gen():
        # Send initial user ack
        yield f"event: user\ndata: {json.dumps(user_doc)}\n\n"

        # Call LLM (full response, then chunk for streaming UX)
        try:
            history_cursor = db.messages.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1)
            history = await history_cursor.to_list(200)

            chat_client = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=project_id,
                system_message=SYSTEM_PROMPT,
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")

            prompt = payload.content
            if len([m for m in history if m["role"] == "user"]) <= 1:
                preamble = f"[Project: {project['name']}]\n[Stack: {project.get('stack','react-fastapi')}]\n\n"
                prompt = preamble + payload.content

            reply = await chat_client.send_message(UserMessage(text=prompt))
        except Exception as e:
            logging.exception("LLM stream error")
            reply = f"[FORGE Error] Unable to reach model: {str(e)[:200]}"

        # Chunk by ~ whitespace groups for smooth streaming
        tokens = re.findall(r"\s+|\S+", reply)
        accumulated = ""
        for tok in tokens:
            accumulated += tok
            yield f"event: token\ndata: {json.dumps({'t': tok})}\n\n"
            await asyncio.sleep(0.012)

        # Persist final assistant message
        ai_msg = Message(project_id=project_id, role="assistant", content=reply)
        ai_doc = ai_msg.model_dump()
        ai_doc["created_at"] = ai_doc["created_at"].isoformat()
        await db.messages.insert_one(ai_doc)
        ai_doc.pop("_id", None)

        await db.users.update_one({"user_id": user.user_id}, {"$inc": {"credits": -1}})
        await db.projects.update_one(
            {"project_id": project_id},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        )

        # Broadcast to other collaborators (they won't see streaming — they see final message)
        sender = {"user_id": user.user_id, "name": user.name, "email": user.email, "picture": user.picture}
        await manager.broadcast(project_id, {"type": "message", "message": user_doc, "sender": sender})
        await manager.broadcast(project_id, {"type": "message", "message": ai_doc, "sender": {"user_id": "forge", "name": "Forge"}})

        yield f"event: done\ndata: {json.dumps({'message': ai_doc})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })


# ----------------------- WebSocket (live presence + typing) ----------------------
async def _resolve_user_from_token(token: str) -> Optional[User]:
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)


@app.websocket("/api/ws/projects/{project_id}")
async def ws_project(websocket: WebSocket, project_id: str, token: Optional[str] = None):
    """Live presence + typing broadcasts. Auth via session_token cookie or ?token="""
    await websocket.accept()
    # Prefer cookie over query param
    cookie_token = websocket.cookies.get("session_token")
    user = await _resolve_user_from_token(cookie_token or token or "")
    if not user:
        await websocket.send_json({"type": "error", "detail": "unauthorized"})
        await websocket.close()
        return

    project = await _user_can_access_project(project_id, user)
    if not project:
        await websocket.send_json({"type": "error", "detail": "no access"})
        await websocket.close()
        return

    user_info = {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "picture": user.picture,
        "role": project.get("member_role", "editor"),
    }
    await manager.connect(project_id, websocket, user_info)

    # Send current presence to new joiner, announce joined to others
    await websocket.send_json({"type": "presence", "users": manager.presence(project_id)})
    await manager.broadcast(project_id, {"type": "presence", "users": manager.presence(project_id)})

    try:
        while True:
            data = await websocket.receive_json()
            t = data.get("type")
            if t == "typing":
                await manager.broadcast(project_id, {
                    "type": "typing",
                    "user_id": user.user_id,
                    "name": user.name,
                    "is_typing": bool(data.get("is_typing", True)),
                }, exclude_ws=websocket)
            elif t == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.warning(f"WebSocket error: {e}")
    finally:
        manager.disconnect(project_id, websocket)
        await manager.broadcast(project_id, {"type": "presence", "users": manager.presence(project_id)})


# ----------------------- Project Activity ----------------------
@api_router.get("/projects/{project_id}/activity")
async def list_activity(project_id: str, user: User = Depends(get_current_user)):
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    rows = await db.project_activity.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


# ----------------------- Project Files (editable via Monaco/Yjs) ----------------------
class FileSave(BaseModel):
    path: str
    content: str


@api_router.get("/projects/{project_id}/files")
async def list_files(project_id: str, user: User = Depends(get_current_user)):
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    files = await db.project_files.find({"project_id": project_id}, {"_id": 0}).to_list(500)
    return files


@api_router.put("/projects/{project_id}/files")
async def save_file(project_id: str, payload: FileSave, user: User = Depends(get_current_user)):
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("member_role") == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot edit")
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.project_files.find_one(
        {"project_id": project_id, "path": payload.path}, {"_id": 0}
    )
    if existing:
        await db.project_files.update_one(
            {"project_id": project_id, "path": payload.path},
            {"$set": {"content": payload.content, "updated_at": now,
                      "updated_by": user.user_id, "updated_by_name": user.name}}
        )
    else:
        await db.project_files.insert_one({
            "file_id": f"file_{uuid.uuid4().hex[:10]}",
            "project_id": project_id,
            "path": payload.path,
            "content": payload.content,
            "updated_at": now,
            "updated_by": user.user_id,
            "updated_by_name": user.name,
        })
    await _log_activity(project_id,
                        actor={"user_id": user.user_id, "name": user.name, "email": user.email},
                        event_type="file.edited",
                        detail=payload.path)
    doc = await db.project_files.find_one({"project_id": project_id, "path": payload.path}, {"_id": 0})
    return doc


# ----------------------- Yjs Relay WebSocket ----------------------
_yjs_rooms: dict[str, list] = {}  # room_key -> [WebSocket, ...]


@app.websocket("/api/ws/yjs/{project_id}/{file_path:path}")
async def yjs_relay(websocket: WebSocket, project_id: str, file_path: str, token: Optional[str] = None):
    """Minimal Yjs relay. Broadcasts binary updates between clients on same room.
    No persistence — initial doc state is seeded client-side from PUT /files."""
    await websocket.accept()
    cookie_token = websocket.cookies.get("session_token")
    user = await _resolve_user_from_token(cookie_token or token or "")
    if not user:
        await websocket.close(code=4401)
        return
    project = await _user_can_access_project(project_id, user)
    if not project:
        await websocket.close(code=4403)
        return

    room_key = f"{project_id}:{file_path}"
    _yjs_rooms.setdefault(room_key, []).append(websocket)
    try:
        while True:
            data = await websocket.receive_bytes()
            for peer in list(_yjs_rooms.get(room_key, [])):
                if peer is websocket:
                    continue
                try:
                    await peer.send_bytes(data)
                except Exception:
                    try:
                        _yjs_rooms[room_key].remove(peer)
                    except ValueError:
                        pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.warning(f"yjs relay error: {e}")
    finally:
        try:
            _yjs_rooms[room_key].remove(websocket)
            if not _yjs_rooms[room_key]:
                _yjs_rooms.pop(room_key, None)
        except (ValueError, KeyError):
            pass


# ----------------------- Project Export (ZIP) ----------------------
_FENCE_RE = re.compile(r"```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```")


def _safe_filename(name: str, idx: int, lang: str) -> str:
    if name:
        name = name.strip().lstrip("/").replace("..", "_")
        return name or f"snippet_{idx}.{lang or 'txt'}"
    ext_map = {"jsx": "jsx", "tsx": "tsx", "js": "js", "ts": "ts",
               "python": "py", "py": "py", "html": "html", "css": "css",
               "json": "json", "md": "md", "bash": "sh", "sh": "sh"}
    ext = ext_map.get((lang or "").lower(), "txt")
    return f"snippet_{idx}.{ext}"


@api_router.get("/projects/{project_id}/export")
async def export_project(project_id: str, user: User = Depends(get_current_user)):
    project = await _user_can_access_project(project_id, user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    msgs = await db.messages.find(
        {"project_id": project_id, "role": "assistant"}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)

    # Latest file wins (deduplicate by path)
    files: dict[str, str] = {}
    idx = 0
    for m in msgs:
        for match in _FENCE_RE.finditer(m.get("content", "")):
            lang = match.group(1) or "txt"
            path = match.group(2)
            body = match.group(3)
            idx += 1
            files[_safe_filename(path, idx, lang)] = body

    # Project_files (edited via Monaco) override AI-generated blocks
    edited = await db.project_files.find({"project_id": project_id}, {"_id": 0}).to_list(500)
    for f in edited:
        files[f["path"].lstrip("/")] = f["content"]

    # Build README
    readme = f"# {project['name']}\n\n{project.get('description','')}\n\n"
    readme += f"Generated by FORGE on {datetime.now(timezone.utc).isoformat()}\n\n"
    readme += f"Files: {len(files)}\n\n"
    readme += "## File list\n\n"
    readme += "\n".join(f"- `{p}`" for p in sorted(files.keys())) or "- (no generated files yet)"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.md", readme)
        for path, body in files.items():
            zf.writestr(path, body)
    buf.seek(0)

    filename = re.sub(r"[^a-z0-9]+", "-", project["name"].lower()).strip("-") or "forge-project"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}.zip"'},
    )


# ----------------------- Stripe Payments ----------------------
def _stripe_client(request: Request) -> StripeCheckout:
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str


@api_router.get("/payments/packages")
async def list_packages():
    return [{"package_id": k, **v} for k, v in PACKAGES.items()]


@api_router.post("/payments/checkout")
async def create_checkout(
    payload: CheckoutRequest, request: Request, user: User = Depends(get_current_user)
):
    pkg = PACKAGES.get(payload.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/settings?billing=cancelled"

    stripe = _stripe_client(request)
    checkout_req = CheckoutSessionRequest(
        amount=float(pkg["amount"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user.user_id,
            "email": user.email,
            "package_id": payload.package_id,
            "credits": str(pkg["credits"]),
        },
    )
    session = await stripe.create_checkout_session(checkout_req)

    # Record pending transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user.user_id,
        "email": user.email,
        "package_id": payload.package_id,
        "amount": float(pkg["amount"]),
        "currency": "usd",
        "credits": pkg["credits"],
        "payment_status": "pending",
        "status": "initiated",
        "credits_applied": False,
        "metadata": checkout_req.metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/payments/status/{session_id}")
async def checkout_status(session_id: str, request: Request, user: User = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not your transaction")

    # If already processed (via webhook or previous poll), return cached status
    if tx.get("credits_applied"):
        return {"payment_status": tx.get("payment_status", "paid"),
                "status": tx.get("status", "completed"),
                "credits_added": tx.get("credits", 0),
                "already_applied": True}

    stripe = _stripe_client(request)
    try:
        status = await stripe.get_checkout_status(session_id)
        payment_status = status.payment_status
        sess_status = status.status
    except Exception as e:
        # emergentintegrations library has a known Pydantic validation issue with
        # the metadata field. Fall back gracefully — webhook may confirm payment,
        # frontend will keep polling or time out.
        logging.warning(f"Stripe status lib error (session {session_id}): {str(e)[:200]}")
        return {"payment_status": "pending", "status": "processing",
                "credits_added": 0, "already_applied": False, "lib_error": True}

    updates = {"payment_status": payment_status, "status": sess_status}

    # Apply credits idempotently on success
    credits_added = 0
    if payment_status == "paid" and not tx.get("credits_applied"):
        credits_added = tx.get("credits", 0)
        new_tier = tx["package_id"] if tx["package_id"] in ("studio", "maison") else None
        user_updates = {"$inc": {"credits": credits_added}}
        if new_tier:
            user_updates["$set"] = {"tier": new_tier}
        await db.users.update_one({"user_id": tx["user_id"]}, user_updates)
        updates["credits_applied"] = True

    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": updates})
    return {"payment_status": payment_status, "status": sess_status,
            "credits_added": credits_added, "already_applied": False}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    stripe = _stripe_client(request)
    try:
        event = await stripe.handle_webhook(body, signature)
    except Exception as e:
        logging.exception("Stripe webhook error")
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)[:160]}")

    if event.event_type == "checkout.session.completed" and event.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if tx and not tx.get("credits_applied"):
            credits_added = tx.get("credits", 0)
            new_tier = tx["package_id"] if tx["package_id"] in ("studio", "maison") else None
            user_updates = {"$inc": {"credits": credits_added}}
            if new_tier:
                user_updates["$set"] = {"tier": new_tier}
            await db.users.update_one({"user_id": tx["user_id"]}, user_updates)
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"credits_applied": True, "payment_status": event.payment_status,
                          "status": "completed"}},
            )
    return {"received": True}


# ----------------------- Templates ----------------------
TEMPLATES = [
    {"template_id": "saas-dashboard", "name": "SaaS Dashboard", "icon": "LayoutDashboard",
     "description": "Analytics dashboard with charts, auth, and billing.",
     "prompt": "Build a modern SaaS analytics dashboard with sidebar navigation, revenue charts, user metrics cards, and a settings page. Use Tailwind + shadcn."},
    {"template_id": "ai-chatbot", "name": "AI Chatbot", "icon": "MessagesSquare",
     "description": "Streaming chatbot with conversation history.",
     "prompt": "Build an AI chatbot web app with streaming responses, conversation history stored in MongoDB, and a minimal chat UI."},
    {"template_id": "crm", "name": "Mini CRM", "icon": "Users",
     "description": "Contact & deal tracker with kanban.",
     "prompt": "Build a small CRM with contacts list, deal kanban board (drag/drop), and activity timeline."},
    {"template_id": "blog-cms", "name": "Blog CMS", "icon": "PencilLine",
     "description": "Markdown-powered blog with admin.",
     "prompt": "Build a markdown blog CMS with admin editor, tags, and a public-facing article reader."},
    {"template_id": "ecommerce", "name": "E-commerce Store", "icon": "ShoppingBag",
     "description": "Product catalog, cart, checkout scaffold.",
     "prompt": "Build an e-commerce storefront with product grid, cart drawer, and checkout form (Stripe placeholder)."},
    {"template_id": "kanban", "name": "Project Kanban", "icon": "Trello",
     "description": "Trello-style task board.",
     "prompt": "Build a kanban task board with draggable cards across columns and due-date filters."},
]


@api_router.get("/templates")
async def list_templates():
    return TEMPLATES


# ----------------------- Health -------------------------
@api_router.get("/")
async def root():
    return {"app": "FORGE", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown():
    client.close()
