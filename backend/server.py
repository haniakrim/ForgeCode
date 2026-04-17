"""
FORGE — AI Full-Stack App Developer SaaS
Backend powered by FastAPI + MongoDB + Claude Sonnet 4.5 + Emergent Auth.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ----------------------- MongoDB -----------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

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
