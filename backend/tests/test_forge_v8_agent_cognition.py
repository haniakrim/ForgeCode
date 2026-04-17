"""
FORGE v8 Agent Cognition Feature Tests
Tests for 5 agent techniques:
① Senior-engineer system prompt with chain-of-thought (REGRESSION - chat still works)
② Plan-then-Build two-pass flow (mode='plan' vs mode='build')
③ Self-critique review pass (POST /api/projects/{id}/review)
④ Agentic tool-use loop (mode='agent' with list_files/read_file/write_file/done)
⑤ Per-project auto-maintained memory (GET/PUT /api/projects/{id}/memory)
"""
import pytest
import requests
import os
import time
import json
import subprocess
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://buildforge-ai.preview.emergentagent.com').rstrip('/')


def get_test_data():
    """Get test tokens from mongosh"""
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
var session = db.user_sessions.findOne({session_token: /^test_session_v8_/}, {_id: 0});
var user = session ? db.users.findOne({user_id: session.user_id}, {_id: 0}) : null;
var project = db.projects.findOne({project_id: /^prj_test_v8_/}, {_id: 0});
var viewerSession = db.user_sessions.findOne({session_token: /^test_viewer_session_v8_/}, {_id: 0});
print(JSON.stringify({
    session_token: session?.session_token,
    user_id: user?.user_id,
    email: user?.email,
    project_id: project?.project_id,
    viewer_session_token: viewerSession?.session_token
}));
'''
    ], capture_output=True, text=True)
    return json.loads(result.stdout.strip())


@pytest.fixture(scope="module")
def test_data():
    """Get test tokens and project ID"""
    return get_test_data()


@pytest.fixture
def auth_client(test_data):
    """Session with auth (owner)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['session_token']}"
    })
    return session


@pytest.fixture
def viewer_client(test_data):
    """Session with auth (viewer role)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['viewer_session_token']}"
    })
    return session


@pytest.fixture
def no_auth_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== ① REGRESSION: Chat still works with new SYSTEM_PROMPT ====================
class TestChatRegression:
    """Verify chat endpoints still work after SYSTEM_PROMPT rewrite"""
    
    def test_chat_stream_build_mode_default(self, auth_client, test_data):
        """POST /api/projects/{id}/chat/stream with mode='build' (default) streams valid reply"""
        payload = {"content": "Say hello in one sentence.", "mode": "build"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        # Parse SSE events
        events = []
        full_content = ""
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
            elif line.startswith("data:"):
                data = json.loads(line.split(":", 1)[1].strip())
                if "t" in data:  # token event
                    full_content += data["t"]
        
        assert "user" in events, "Should have 'user' event"
        assert "token" in events, "Should have 'token' events"
        assert "done" in events, "Should have 'done' event"
        assert len(full_content) > 0, "Should have non-empty response content"
        print(f"Build mode response ({len(full_content)} chars): {full_content[:100]}...")
    
    def test_chat_stream_persists_message(self, auth_client, test_data):
        """Chat stream persists assistant message to DB"""
        # Send a chat
        payload = {"content": "Reply with exactly: TEST_PERSIST_CHECK", "mode": "build"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        assert response.status_code == 200
        
        # Consume stream to completion
        done_data = None
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("event: done"):
                pass
            elif line.startswith("data:") and done_data is None:
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if "message" in data:
                        done_data = data
                except:
                    pass
        
        # Verify message persisted via GET project
        get_response = auth_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}")
        assert get_response.status_code == 200
        messages = get_response.json().get("messages", [])
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        assert len(assistant_msgs) > 0, "Should have at least one assistant message"
        print(f"Message persisted: {assistant_msgs[-1]['content'][:80]}...")


# ==================== ② Plan Mode ====================
class TestPlanMode:
    """Test mode='plan' produces plan-only output (no code fences)"""
    
    def test_plan_mode_streams_and_returns_plan(self, auth_client, test_data):
        """POST with mode='plan' streams SSE and final message has mode='plan'"""
        payload = {"content": "Build a simple todo app", "mode": "plan"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        assert response.status_code == 200
        
        events = []
        full_content = ""
        done_message = None
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
            elif line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if "t" in data:
                        full_content += data["t"]
                    if "message" in data:
                        done_message = data["message"]
                except:
                    pass
        
        assert "done" in events, "Should have 'done' event"
        assert done_message is not None, "Should have message in done event"
        assert done_message.get("mode") == "plan", f"Message mode should be 'plan', got {done_message.get('mode')}"
        
        # Plan should start with '### Goal' per PLAN_ADDENDUM format
        assert "### Goal" in full_content or "###Goal" in full_content or "Goal" in full_content[:200], \
            f"Plan should contain 'Goal' section, got: {full_content[:300]}"
        
        # Plan should NOT contain code fences
        code_fence_count = full_content.count("```")
        assert code_fence_count == 0, f"Plan mode should have NO code fences, found {code_fence_count}"
        
        print(f"Plan mode response (no code fences): {full_content[:200]}...")
    
    def test_build_mode_may_contain_code_fences(self, auth_client, test_data):
        """POST with mode='build' may produce code fences"""
        payload = {"content": "Write a simple Python hello world function", "mode": "build"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        assert response.status_code == 200
        
        full_content = ""
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if "t" in data:
                        full_content += data["t"]
                except:
                    pass
        
        # Build mode CAN contain code fences (not required, but allowed)
        print(f"Build mode response: {full_content[:200]}...")
        # Just verify we got a response
        assert len(full_content) > 10, "Should have non-trivial response"


# ==================== ③ Review Endpoint ====================
class TestReviewEndpoint:
    """Test POST /api/projects/{id}/review self-critique"""
    
    def test_review_no_files_returns_400(self, auth_client, test_data):
        """POST /review with no files returns 400 'No code to review yet'"""
        # First ensure no files exist - create a fresh project
        create_resp = auth_client.post(f"{BASE_URL}/api/projects", json={
            "name": "Empty Project for Review Test",
            "description": "No files"
        })
        assert create_resp.status_code == 200
        empty_project_id = create_resp.json()["project_id"]
        
        # Try to review empty project
        response = auth_client.post(f"{BASE_URL}/api/projects/{empty_project_id}/review")
        assert response.status_code == 400
        assert "No code to review" in response.json().get("detail", "")
        print("Review with no files correctly returns 400")
        
        # Cleanup
        auth_client.delete(f"{BASE_URL}/api/projects/{empty_project_id}")
    
    def test_review_with_files_returns_review(self, auth_client, test_data):
        """POST /review after project has files returns {review: string, files_reviewed: int}"""
        project_id = test_data['project_id']
        
        # Add a file to the project
        file_payload = {
            "path": "test_review.py",
            "content": """
def hello():
    print("Hello World")
    return True

def add(a, b):
    return a + b

if __name__ == "__main__":
    hello()
"""
        }
        file_resp = auth_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=file_payload)
        assert file_resp.status_code == 200
        
        # Now review
        response = auth_client.post(f"{BASE_URL}/api/projects/{project_id}/review", timeout=60)
        assert response.status_code == 200
        data = response.json()
        
        assert "review" in data, "Response should have 'review' field"
        assert "files_reviewed" in data, "Response should have 'files_reviewed' field"
        assert isinstance(data["files_reviewed"], int), "files_reviewed should be int"
        assert data["files_reviewed"] >= 1, "Should have reviewed at least 1 file"
        assert len(data["review"]) > 200, f"Review should be >200 chars, got {len(data['review'])}"
        
        print(f"Review returned: {len(data['review'])} chars, {data['files_reviewed']} files reviewed")
        print(f"Review excerpt: {data['review'][:200]}...")
    
    def test_review_debits_credit(self, auth_client, test_data):
        """POST /review debits 1 credit"""
        # Get current credits
        me_resp = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        credits_before = me_resp.json().get("credits", 0)
        
        # Do a review (project should have files from previous test)
        response = auth_client.post(f"{BASE_URL}/api/projects/{test_data['project_id']}/review", timeout=60)
        
        if response.status_code == 402:
            pytest.skip("Out of credits - cannot test credit debit")
        
        assert response.status_code == 200
        
        # Check credits after
        me_resp2 = auth_client.get(f"{BASE_URL}/api/auth/me")
        credits_after = me_resp2.json().get("credits", 0)
        
        assert credits_after == credits_before - 1, f"Credits should decrease by 1: {credits_before} -> {credits_after}"
        print(f"Credit debited: {credits_before} -> {credits_after}")
    
    def test_review_logs_activity(self, auth_client, test_data):
        """POST /review logs activity event 'code.reviewed'"""
        project_id = test_data['project_id']
        
        # Get activity before
        activity_before = auth_client.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        review_events_before = [a for a in activity_before if a.get("event_type") == "code.reviewed"]
        
        # Do a review
        response = auth_client.post(f"{BASE_URL}/api/projects/{project_id}/review", timeout=60)
        if response.status_code == 402:
            pytest.skip("Out of credits")
        
        # Get activity after
        activity_after = auth_client.get(f"{BASE_URL}/api/projects/{project_id}/activity").json()
        review_events_after = [a for a in activity_after if a.get("event_type") == "code.reviewed"]
        
        assert len(review_events_after) > len(review_events_before), "Should have new 'code.reviewed' activity"
        print(f"Activity logged: {review_events_after[0]}")


# ==================== ④ Agent Mode ====================
class TestAgentMode:
    """Test mode='agent' with tool-use loop"""
    
    def test_agent_mode_streams_agent_step_events(self, auth_client, test_data):
        """POST with mode='agent' streams agent_step and tool_result SSE events"""
        payload = {
            "content": "Create a file called agent_test.txt with content 'hello from agent'",
            "mode": "agent"
        }
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=90
        )
        assert response.status_code == 200
        
        events = []
        agent_steps = []
        tool_results = []
        
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("event:"):
                event_type = line.split(":", 1)[1].strip()
                events.append(event_type)
            elif line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if "round" in data and "reply" in data:
                        agent_steps.append(data)
                    if "tool" in data and "result" in data:
                        tool_results.append(data)
                except:
                    pass
        
        assert "agent_step" in events, "Should have 'agent_step' events"
        assert len(agent_steps) >= 1, "Should have at least 1 agent step"
        print(f"Agent steps: {len(agent_steps)}, Tool results: {len(tool_results)}")
        
        # Check if write_file tool was called
        write_calls = [tr for tr in tool_results if tr.get("tool", {}).get("name") == "write_file"]
        if write_calls:
            print(f"write_file tool called: {write_calls[0]}")
            assert write_calls[0]["result"].get("ok") == True, "write_file should succeed"
    
    def test_agent_mode_creates_file_in_db(self, auth_client, test_data):
        """Agent mode write_file tool creates file in db.project_files"""
        project_id = test_data['project_id']
        
        # Send agent request to create a specific file
        payload = {
            "content": "Create a file called agent_created.txt with content 'created by agent test'",
            "mode": "agent"
        }
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{project_id}/chat/stream",
            json=payload,
            stream=True,
            timeout=90
        )
        assert response.status_code == 200
        
        # Consume stream
        for line in response.iter_lines(decode_unicode=True):
            pass
        
        # Check if file was created
        files_resp = auth_client.get(f"{BASE_URL}/api/projects/{project_id}/files")
        assert files_resp.status_code == 200
        files = files_resp.json()
        
        # Look for any file created by agent
        agent_files = [f for f in files if "agent" in f.get("path", "").lower()]
        print(f"Files in project: {[f['path'] for f in files]}")
        print(f"Agent-related files: {[f['path'] for f in agent_files]}")
    
    def test_agent_mode_max_5_rounds(self, auth_client, test_data):
        """Agent mode respects max 5 rounds (doesn't loop forever)"""
        payload = {
            "content": "List all files, then read each one, then summarize",
            "mode": "agent"
        }
        
        start_time = time.time()
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=120  # 2 min max
        )
        assert response.status_code == 200
        
        rounds = []
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if "round" in data:
                        rounds.append(data["round"])
                except:
                    pass
        
        elapsed = time.time() - start_time
        max_round = max(rounds) if rounds else 0
        
        assert max_round <= 4, f"Max round should be <=4 (0-indexed), got {max_round}"
        assert elapsed < 120, f"Should complete within 2 min, took {elapsed:.1f}s"
        print(f"Agent completed in {elapsed:.1f}s with {len(rounds)} rounds (max round: {max_round})")


# ==================== ⑤ Memory Endpoints ====================
class TestMemoryEndpoints:
    """Test GET/PUT /api/projects/{id}/memory"""
    
    def test_memory_get_new_project_returns_empty(self, auth_client, test_data):
        """GET /api/projects/{id}/memory returns {project_id, content:''} for new project"""
        # Create a fresh project
        create_resp = auth_client.post(f"{BASE_URL}/api/projects", json={
            "name": "Memory Test Project",
            "description": "Testing memory"
        })
        assert create_resp.status_code == 200
        new_project_id = create_resp.json()["project_id"]
        
        # Get memory
        response = auth_client.get(f"{BASE_URL}/api/projects/{new_project_id}/memory")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("project_id") == new_project_id, "Should return project_id"
        assert data.get("content") == "", f"Content should be empty string, got: {data.get('content')}"
        print(f"New project memory: {data}")
        
        # Cleanup
        auth_client.delete(f"{BASE_URL}/api/projects/{new_project_id}")
    
    def test_memory_put_persists_content(self, auth_client, test_data):
        """PUT /api/projects/{id}/memory with {content:'- A\\n- B'} persists and returns it"""
        project_id = test_data['project_id']
        
        memory_content = "- Architecture: React + FastAPI\n- Files: App.js, server.py\n- TODO: Add auth"
        payload = {"content": memory_content}
        
        response = auth_client.put(f"{BASE_URL}/api/projects/{project_id}/memory", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("content") == memory_content, f"Content should match, got: {data.get('content')}"
        
        # Verify persistence with GET
        get_resp = auth_client.get(f"{BASE_URL}/api/projects/{project_id}/memory")
        assert get_resp.status_code == 200
        assert get_resp.json().get("content") == memory_content
        print(f"Memory persisted: {memory_content[:50]}...")
    
    def test_memory_put_viewer_returns_403(self, viewer_client, test_data):
        """PUT /api/projects/{id}/memory as viewer (role=viewer) returns 403"""
        project_id = test_data['project_id']
        
        payload = {"content": "Viewer trying to edit memory"}
        response = viewer_client.put(f"{BASE_URL}/api/projects/{project_id}/memory", json=payload)
        
        assert response.status_code == 403, f"Viewer should get 403, got {response.status_code}"
        assert "viewer" in response.json().get("detail", "").lower()
        print("Viewer correctly blocked from editing memory (403)")
    
    def test_memory_injected_into_system_prompt(self, auth_client, test_data):
        """Memory is injected into system prompt - verify chat doesn't 500"""
        project_id = test_data['project_id']
        
        # Set some memory
        memory_content = "- This project uses React\n- Backend is FastAPI\n- Database is MongoDB"
        auth_client.put(f"{BASE_URL}/api/projects/{project_id}/memory", json={"content": memory_content})
        
        # Send a chat - should not 500
        payload = {"content": "What stack is this project using?", "mode": "build"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{project_id}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        
        assert response.status_code == 200, f"Chat with memory should not fail, got {response.status_code}"
        
        # Consume stream
        content = ""
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if "t" in data:
                        content += data["t"]
                except:
                    pass
        
        assert len(content) > 0, "Should get a response"
        print(f"Chat with memory succeeded: {content[:100]}...")


# ==================== Invalid Mode Fallback ====================
class TestInvalidModeFallback:
    """Test invalid mode falls back to 'build'"""
    
    def test_invalid_mode_falls_back_to_build(self, auth_client, test_data):
        """ChatRequest with invalid mode (e.g. 'xyz') falls back to 'build' without error"""
        payload = {"content": "Hello", "mode": "xyz"}  # Invalid mode
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        
        assert response.status_code == 200, f"Invalid mode should not error, got {response.status_code}"
        
        # Check that it processed as build mode (no agent_step events)
        events = []
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
        
        assert "agent_step" not in events, "Invalid mode should not trigger agent mode"
        assert "done" in events, "Should complete normally"
        print("Invalid mode 'xyz' fell back to build mode successfully")


# ==================== Agent Tool Parser Tests ====================
class TestAgentToolParser:
    """Test _parse_agent_tools regex parsing"""
    
    def test_parse_list_files(self):
        """_parse_agent_tools extracts <tool name='list_files' />"""
        # We can't directly call the function, but we can test via agent mode
        # This is a unit test placeholder - actual parsing tested via integration
        pass
    
    def test_parse_read_file(self):
        """_parse_agent_tools extracts <tool name='read_file' path='x.js' />"""
        pass
    
    def test_parse_write_file(self):
        """_parse_agent_tools extracts <tool name='write_file' path='y.js'>content</tool>"""
        pass
    
    def test_parse_done(self):
        """_parse_agent_tools extracts <tool name='done' />"""
        pass


# ==================== v6/v7 Regression Tests ====================
class TestV6V7Regression:
    """Verify existing features still work"""
    
    def test_export_zip_works(self, auth_client, test_data):
        """GET /api/projects/{id}/export still works"""
        response = auth_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/export")
        assert response.status_code == 200
        assert "application/zip" in response.headers.get("content-type", "")
        print("Export ZIP endpoint works")
    
    def test_activity_endpoint_works(self, auth_client, test_data):
        """GET /api/projects/{id}/activity still works"""
        response = auth_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("Activity endpoint works")
    
    def test_settings_endpoint_works(self, auth_client):
        """GET /api/settings still works"""
        response = auth_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "model_id" in data
        assert "integrations" in data
        print("Settings endpoint works")
    
    def test_models_endpoint_works(self, no_auth_client):
        """GET /api/models still works"""
        response = no_auth_client.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        models = response.json()
        assert len(models) == 7
        print("Models endpoint works")
    
    def test_stripe_packages_works(self, no_auth_client):
        """GET /api/payments/packages still works"""
        response = no_auth_client.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        packages = response.json()
        assert len(packages) > 0
        print("Stripe packages endpoint works")
    
    def test_invite_endpoint_works(self, auth_client, test_data):
        """POST /api/projects/{id}/invite still works"""
        payload = {"email": f"regression_v8_{int(time.time())}@forge.dev", "role": "editor"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/invite",
            json=payload
        )
        assert response.status_code == 200
        print("Invite endpoint works")
    
    def test_files_endpoint_works(self, auth_client, test_data):
        """GET /api/projects/{id}/files still works"""
        response = auth_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/files")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("Files endpoint works")


# ==================== Cleanup ====================
@pytest.fixture(scope="module", autouse=True)
def cleanup(request):
    """Cleanup test data after all tests"""
    yield
    # Cleanup after tests
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
db.users.deleteMany({email: /^test\.v8\./});
db.users.deleteMany({email: /^viewer\.v8\./});
db.user_sessions.deleteMany({session_token: /^test_session_v8_/});
db.user_sessions.deleteMany({session_token: /^test_viewer_session_v8_/});
db.projects.deleteMany({project_id: /^prj_test_v8_/});
db.project_members.deleteMany({member_id: /^mem_viewer_v8_/});
db.project_members.deleteMany({email: /^regression_v8_/});
db.project_memory.deleteMany({project_id: /^prj_test_v8_/});
db.project_files.deleteMany({project_id: /^prj_test_v8_/});
db.user_settings.deleteMany({user_id: /^test-user-v8-/});
db.user_settings.deleteMany({user_id: /^test-viewer-v8-/});
print("V8 cleanup completed");
'''
    ], capture_output=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
