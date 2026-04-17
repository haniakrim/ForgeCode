"""
FORGE — AI Full-Stack App Developer SaaS
Backend powered by FastAPI + MongoDB + Claude Sonnet 4.5 + Emergent Auth.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----------------------- MongoDB -----------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    stack: Optional[str] = "react-fastapi"


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
@api_router.get("/projects")
async def list_projects(user: User = Depends(get_current_user)):
    cursor = db.projects.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1)
    projects = await cursor.to_list(100)
    return projects


@api_router.post("/projects")
async def create_project(payload: ProjectCreate, user: User = Depends(get_current_user)):
    project = Project(user_id=user.user_id, name=payload.name,
                      description=payload.description or "", stack=payload.stack or "react-fastapi")
    doc = project.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.projects.insert_one(doc)
    doc.pop("_id", None)  # Remove MongoDB ObjectId before returning
    return doc


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user: User = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"project_id": project_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    msgs_cursor = db.messages.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1)
    messages = await msgs_cursor.to_list(1000)
    return {"project": project, "messages": messages}


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: User = Depends(get_current_user)):
    res = await db.projects.delete_one({"project_id": project_id, "user_id": user.user_id})
    await db.messages.delete_many({"project_id": project_id})
    return {"deleted": res.deleted_count}


@api_router.post("/projects/{project_id}/chat")
async def chat(project_id: str, payload: ChatRequest, user: User = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"project_id": project_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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

    return {"message": ai_doc}


# ----------------------- Chat Streaming (SSE) ----------------------
@api_router.post("/projects/{project_id}/chat/stream")
async def chat_stream(project_id: str, payload: ChatRequest, user: User = Depends(get_current_user)):
    """SSE endpoint that streams the assistant reply token-by-token.
    We call the LLM once (emergentintegrations returns a full response) then stream
    it word-by-word to give real-time UX. Both user + assistant messages are persisted."""
    project = await db.projects.find_one(
        {"project_id": project_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
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
        yield f"event: done\ndata: {json.dumps({'message': ai_doc})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })


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
    project = await db.projects.find_one(
        {"project_id": project_id, "user_id": user.user_id}, {"_id": 0}
    )
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

    # If already processed, return cached status
    if tx.get("credits_applied"):
        return {"payment_status": tx.get("payment_status"), "status": tx.get("status"),
                "credits_added": tx.get("credits", 0), "already_applied": True}

    stripe = _stripe_client(request)
    try:
        status = await stripe.get_checkout_status(session_id)
    except Exception as e:
        logging.exception("Stripe status error")
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:160]}")

    updates = {"payment_status": status.payment_status, "status": status.status}

    # Apply credits idempotently on success
    credits_added = 0
    if status.payment_status == "paid" and not tx.get("credits_applied"):
        credits_added = tx.get("credits", 0)
        new_tier = tx["package_id"] if tx["package_id"] in ("studio", "maison") else None
        user_updates = {"$inc": {"credits": credits_added}}
        if new_tier:
            user_updates["$set"] = {"tier": new_tier}
        await db.users.update_one({"user_id": tx["user_id"]}, user_updates)
        updates["credits_applied"] = True

    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": updates})
    return {"payment_status": status.payment_status, "status": status.status,
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
