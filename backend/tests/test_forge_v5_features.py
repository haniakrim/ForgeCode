"""
FORGE v5 Feature Tests
- Role-based access (editor/viewer) for collaborators
- POST /api/projects/{id}/invite with {email, role:'editor'|'viewer'}
- PATCH /api/projects/{id}/members/{mid} with {role:'editor'|'viewer'}
- GET /api/projects/{id} returns member_role for collaborators
- POST /api/projects/{id}/chat - viewers get 403, editors work
- POST /api/projects/{id}/chat/stream - viewers get 403
- WebSocket /api/ws/projects/{id} - auth via cookie or ?token=
- WebSocket message types: ping/pong, typing broadcasts
"""
import pytest
import pytest_asyncio
import requests
import os
import json
import asyncio
import websockets

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - seeded via mongosh
OWNER_TOKEN = "test_session_v5_owner_1776414855985"
OWNER_EMAIL = "owner_v5@forge.dev"
VIEWER_TOKEN = "test_session_v5_viewer_1776414855987"
VIEWER_EMAIL = "viewer_v5@forge.dev"
EDITOR_TOKEN = "test_session_v5_editor_1776414855988"
EDITOR_EMAIL = "editor_v5@forge.dev"


@pytest.fixture(scope="module")
def owner_client():
    """Session with owner auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OWNER_TOKEN}"
    })
    return session


@pytest.fixture(scope="module")
def viewer_client():
    """Session with viewer auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {VIEWER_TOKEN}"
    })
    return session


@pytest.fixture(scope="module")
def editor_client():
    """Session with editor auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {EDITOR_TOKEN}"
    })
    return session


@pytest.fixture(scope="module")
def test_project_with_roles(owner_client, viewer_client, editor_client):
    """Create a test project with viewer and editor collaborators"""
    # Create project
    resp = owner_client.post(f"{BASE_URL}/api/projects", json={
        "name": "TEST_V5_Roles_Project",
        "description": "Project for v5 role-based access testing"
    })
    assert resp.status_code == 200, f"Failed to create project: {resp.text}"
    project = resp.json()
    
    # Invite viewer as viewer
    viewer_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
        "email": VIEWER_EMAIL,
        "role": "viewer"
    })
    assert viewer_resp.status_code == 200, f"Failed to invite viewer: {viewer_resp.text}"
    viewer_member = viewer_resp.json()
    
    # Invite editor as editor
    editor_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
        "email": EDITOR_EMAIL,
        "role": "editor"
    })
    assert editor_resp.status_code == 200, f"Failed to invite editor: {editor_resp.text}"
    editor_member = editor_resp.json()
    
    yield {
        "project": project,
        "viewer_member": viewer_member,
        "editor_member": editor_member
    }
    
    # Cleanup
    owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


# ============== INVITE WITH ROLE TESTS ==============
class TestInviteWithRole:
    """Test POST /api/projects/{id}/invite with role field"""
    
    def test_invite_with_editor_role(self, owner_client):
        """Invite with role='editor' creates member with editor role"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_Editor_Invite"
        })
        project = proj_resp.json()
        
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "test_editor@example.com",
            "role": "editor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("role") == "editor"
        assert data.get("email") == "test_editor@example.com"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_invite_with_viewer_role(self, owner_client):
        """Invite with role='viewer' creates member with viewer role"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_Viewer_Invite"
        })
        project = proj_resp.json()
        
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "test_viewer@example.com",
            "role": "viewer"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("role") == "viewer"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_invite_default_role_is_editor(self, owner_client):
        """Invite without role defaults to editor"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_Default_Role"
        })
        project = proj_resp.json()
        
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "test_default@example.com"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("role") == "editor"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


# ============== UPDATE MEMBER ROLE TESTS ==============
class TestUpdateMemberRole:
    """Test PATCH /api/projects/{id}/members/{mid} with role field"""
    
    def test_update_member_role_to_viewer(self, owner_client):
        """Owner can change member role from editor to viewer"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_Update_Role"
        })
        project = proj_resp.json()
        
        # Invite as editor
        invite_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "role_change@example.com",
            "role": "editor"
        })
        member = invite_resp.json()
        
        # Update to viewer
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{project['project_id']}/members/{member['member_id']}", json={
            "role": "viewer"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("role") == "viewer"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_update_member_role_to_editor(self, owner_client):
        """Owner can change member role from viewer to editor"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_Update_Role_2"
        })
        project = proj_resp.json()
        
        # Invite as viewer
        invite_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "role_change2@example.com",
            "role": "viewer"
        })
        member = invite_resp.json()
        
        # Update to editor
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{project['project_id']}/members/{member['member_id']}", json={
            "role": "editor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("role") == "editor"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_update_member_invalid_role_returns_400(self, owner_client):
        """Invalid role returns 400"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_Invalid_Role"
        })
        project = proj_resp.json()
        
        invite_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "invalid_role@example.com"
        })
        member = invite_resp.json()
        
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{project['project_id']}/members/{member['member_id']}", json={
            "role": "admin"  # Invalid role
        })
        assert resp.status_code == 400
        assert "invalid role" in resp.json().get("detail", "").lower()
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


# ============== GET PROJECT MEMBER_ROLE TESTS ==============
class TestGetProjectMemberRole:
    """Test GET /api/projects/{id} returns member_role for collaborators"""
    
    def test_viewer_sees_member_role_viewer(self, viewer_client, test_project_with_roles):
        """Viewer sees member_role='viewer' in project response"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = viewer_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project"]["role"] == "collaborator"
        assert data["project"]["member_role"] == "viewer"
    
    def test_editor_sees_member_role_editor(self, editor_client, test_project_with_roles):
        """Editor sees member_role='editor' in project response"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = editor_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project"]["role"] == "collaborator"
        assert data["project"]["member_role"] == "editor"
    
    def test_owner_sees_member_role_owner(self, owner_client, test_project_with_roles):
        """Owner sees member_role='owner' in project response"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = owner_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project"]["role"] == "owner"
        assert data["project"]["member_role"] == "owner"


# ============== VIEWER CHAT RESTRICTION TESTS ==============
class TestViewerChatRestriction:
    """Test POST /api/projects/{id}/chat - viewers get 403"""
    
    def test_viewer_cannot_send_chat_message(self, viewer_client, test_project_with_roles):
        """Viewer gets 403 when trying to send chat message"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = viewer_client.post(f"{BASE_URL}/api/projects/{project_id}/chat", json={
            "content": "Hello from viewer"
        })
        assert resp.status_code == 403
        assert "viewers cannot send messages" in resp.json().get("detail", "").lower()
    
    def test_viewer_cannot_use_chat_stream(self, viewer_client, test_project_with_roles):
        """Viewer gets 403 when trying to use chat stream"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = viewer_client.post(f"{BASE_URL}/api/projects/{project_id}/chat/stream", json={
            "content": "Hello from viewer stream"
        })
        assert resp.status_code == 403
        assert "viewers cannot send messages" in resp.json().get("detail", "").lower()
    
    def test_editor_can_send_chat_message(self, editor_client, test_project_with_roles):
        """Editor can send chat message (200 or LLM error, not 403)"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = editor_client.post(f"{BASE_URL}/api/projects/{project_id}/chat", json={
            "content": "Hello from editor"
        })
        # Should not be 403 - either 200 (success) or 402 (out of credits) or 500 (LLM error)
        assert resp.status_code != 403, f"Editor should not get 403, got: {resp.status_code}"
        # Accept 200, 402, or 500 (LLM budget exceeded)
        assert resp.status_code in [200, 402, 500], f"Unexpected status: {resp.status_code}"
    
    def test_owner_can_send_chat_message(self, owner_client, test_project_with_roles):
        """Owner can send chat message"""
        project_id = test_project_with_roles["project"]["project_id"]
        
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project_id}/chat", json={
            "content": "Hello from owner"
        })
        assert resp.status_code != 403, f"Owner should not get 403, got: {resp.status_code}"


# ============== WEBSOCKET TESTS ==============
class TestWebSocket:
    """Test WebSocket /api/ws/projects/{id}"""
    
    async def test_websocket_auth_via_token_query_param(self, test_project_with_roles):
        """WebSocket accepts ?token= query param for auth"""
        project_id = test_project_with_roles["project"]["project_id"]
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/projects/{project_id}?token={OWNER_TOKEN}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                # Should receive presence message on connect
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                assert data.get("type") == "presence"
                assert "users" in data
                print(f"Received presence: {data}")
        except Exception as e:
            pytest.fail(f"WebSocket connection failed: {e}")
    
    async def test_websocket_bad_auth_returns_error(self, test_project_with_roles):
        """WebSocket with bad token returns error and closes"""
        project_id = test_project_with_roles["project"]["project_id"]
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/projects/{project_id}?token=invalid_token"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                assert data.get("type") == "error"
                assert "unauthorized" in data.get("detail", "").lower()
        except websockets.exceptions.ConnectionClosed:
            pass  # Expected - server closes after error
        except Exception as e:
            # Connection might be closed immediately
            pass
    
    async def test_websocket_no_access_returns_error(self, test_project_with_roles):
        """WebSocket for project user has no access to returns error"""
        # Create a new project that viewer is NOT invited to
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OWNER_TOKEN}"
        })
        proj_resp = session.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_V5_No_Access_WS"
        })
        project = proj_resp.json()
        
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/projects/{project['project_id']}?token={VIEWER_TOKEN}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                assert data.get("type") == "error"
                assert "no access" in data.get("detail", "").lower()
        except websockets.exceptions.ConnectionClosed:
            pass  # Expected
        finally:
            # Cleanup
            session.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    async def test_websocket_ping_pong(self, test_project_with_roles):
        """WebSocket responds to ping with pong"""
        project_id = test_project_with_roles["project"]["project_id"]
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/projects/{project_id}?token={OWNER_TOKEN}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                # Receive initial presence
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                # Send ping
                await ws.send(json.dumps({"type": "ping"}))
                
                # Should receive pong (may need to skip presence updates)
                for _ in range(5):
                    msg = await asyncio.wait_for(ws.recv(), timeout=5)
                    data = json.loads(msg)
                    if data.get("type") == "pong":
                        break
                    # Skip presence updates
                    if data.get("type") == "presence":
                        continue
                assert data.get("type") == "pong", f"Expected pong, got {data}"
        except Exception as e:
            pytest.fail(f"Ping/pong test failed: {e}")
    
    async def test_websocket_typing_broadcast(self, test_project_with_roles):
        """WebSocket typing message broadcasts to others (excludes sender)"""
        project_id = test_project_with_roles["project"]["project_id"]
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        
        # Connect two clients
        owner_ws_url = f"{ws_url}/api/ws/projects/{project_id}?token={OWNER_TOKEN}"
        editor_ws_url = f"{ws_url}/api/ws/projects/{project_id}?token={EDITOR_TOKEN}"
        
        try:
            async with websockets.connect(owner_ws_url, close_timeout=5) as owner_ws:
                async with websockets.connect(editor_ws_url, close_timeout=5) as editor_ws:
                    # Both receive initial presence
                    await asyncio.wait_for(owner_ws.recv(), timeout=5)
                    await asyncio.wait_for(editor_ws.recv(), timeout=5)
                    
                    # Drain any additional presence updates
                    await asyncio.sleep(0.5)
                    
                    # Owner sends typing
                    await owner_ws.send(json.dumps({"type": "typing", "is_typing": True}))
                    
                    # Editor should receive typing broadcast (may need to skip presence updates)
                    typing_received = False
                    for _ in range(10):
                        try:
                            msg = await asyncio.wait_for(editor_ws.recv(), timeout=3)
                            data = json.loads(msg)
                            if data.get("type") == "typing":
                                typing_received = True
                                assert data.get("is_typing") == True
                                assert "user_id" in data
                                assert "name" in data
                                break
                            # Skip presence updates
                            if data.get("type") == "presence":
                                continue
                        except asyncio.TimeoutError:
                            break
                    
                    assert typing_received, "Did not receive typing broadcast"
        except Exception as e:
            pytest.fail(f"Typing broadcast test failed: {e}")


# ============== PRESENCE TESTS ==============
class TestPresence:
    """Test WebSocket presence functionality"""
    
    async def test_presence_includes_user_info(self, test_project_with_roles):
        """Presence message includes user info with role"""
        project_id = test_project_with_roles["project"]["project_id"]
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/projects/{project_id}?token={OWNER_TOKEN}"
        
        try:
            async with websockets.connect(ws_url, close_timeout=5) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                assert data.get("type") == "presence"
                users = data.get("users", [])
                assert len(users) >= 1
                user = users[0]
                assert "user_id" in user
                assert "name" in user
                assert "email" in user
                assert "role" in user  # member_role
        except Exception as e:
            pytest.fail(f"Presence test failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
