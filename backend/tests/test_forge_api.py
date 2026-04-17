"""
FORGE API Backend Tests
Tests all endpoints: health, templates, auth, projects, chat
"""
import pytest
import requests
import os
import time

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test session token seeded in MongoDB
TEST_SESSION_TOKEN = "test_session_forge_1776410053910"
TEST_USER_ID = "test-user-forge-1776410053910"


class TestHealthAndPublicEndpoints:
    """Test public endpoints that don't require authentication"""
    
    def test_root_endpoint_returns_app_status(self):
        """GET /api/ returns {app:FORGE, status:ok}"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["app"] == "FORGE"
        assert data["status"] == "ok"
        print(f"✓ Root endpoint: {data}")
    
    def test_templates_returns_six_templates(self):
        """GET /api/templates returns 6 templates"""
        response = requests.get(f"{BASE_URL}/api/templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 6
        # Verify template structure
        for t in data:
            assert "template_id" in t
            assert "name" in t
            assert "description" in t
            assert "icon" in t
            assert "prompt" in t
        print(f"✓ Templates endpoint: {len(data)} templates returned")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_auth_session_missing_header_returns_400(self):
        """POST /api/auth/session returns 400 when X-Session-ID header is missing"""
        response = requests.post(f"{BASE_URL}/api/auth/session")
        assert response.status_code == 400
        data = response.json()
        assert "Missing X-Session-ID" in data.get("detail", "")
        print(f"✓ Auth session without header: 400 - {data}")
    
    def test_auth_session_invalid_header_returns_401(self):
        """POST /api/auth/session returns 401 when X-Session-ID is invalid"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            headers={"X-Session-ID": "invalid_session_id_12345"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "Invalid session_id" in data.get("detail", "")
        print(f"✓ Auth session with invalid header: 401 - {data}")
    
    def test_auth_me_without_token_returns_401(self):
        """GET /api/auth/me returns 401 when no session cookie/token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
        print(f"✓ Auth me without token: 401 - {data}")
    
    def test_auth_me_with_valid_token_returns_user(self):
        """GET /api/auth/me returns user data with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == TEST_USER_ID
        assert "email" in data
        assert "name" in data
        assert "credits" in data
        print(f"✓ Auth me with token: {data['name']} ({data['email']})")


class TestProjectsEndpoints:
    """Test project CRUD endpoints"""
    
    def test_projects_list_without_auth_returns_401(self):
        """GET /api/projects returns 401 when unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 401
        print("✓ Projects list without auth: 401")
    
    def test_projects_list_with_auth_returns_list(self):
        """GET /api/projects returns list when authenticated"""
        response = requests.get(
            f"{BASE_URL}/api/projects",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Projects list with auth: {len(data)} projects")
    
    def test_create_project_and_verify_persistence(self):
        """POST /api/projects creates project and GET verifies persistence"""
        # Create project
        create_payload = {
            "name": "TEST_Project_" + str(int(time.time())),
            "description": "Test project for automated testing",
            "stack": "react-fastapi"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/projects",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=create_payload
        )
        assert create_response.status_code == 200
        created = create_response.json()
        assert created["name"] == create_payload["name"]
        assert created["description"] == create_payload["description"]
        assert "project_id" in created
        project_id = created["project_id"]
        print(f"✓ Created project: {project_id}")
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["project"]["name"] == create_payload["name"]
        assert fetched["project"]["project_id"] == project_id
        print(f"✓ Verified project persistence: {project_id}")
        
        return project_id
    
    def test_get_project_not_found_returns_404(self):
        """GET /api/projects/{id} returns 404 for non-existent project"""
        response = requests.get(
            f"{BASE_URL}/api/projects/nonexistent_project_id",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 404
        print("✓ Get non-existent project: 404")


class TestChatEndpoint:
    """Test chat endpoint with Claude Sonnet 4.5"""
    
    @pytest.fixture
    def test_project(self):
        """Create a test project for chat tests"""
        create_response = requests.post(
            f"{BASE_URL}/api/projects",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Chat_Project_" + str(int(time.time())),
                "description": "Project for chat testing"
            }
        )
        assert create_response.status_code == 200
        project = create_response.json()
        yield project["project_id"]
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/projects/{project['project_id']}",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
    
    def test_chat_sends_message_and_receives_response(self, test_project):
        """POST /api/projects/{id}/chat sends message and gets AI response"""
        # Get initial credits
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        initial_credits = me_response.json()["credits"]
        
        # Send chat message
        chat_response = requests.post(
            f"{BASE_URL}/api/projects/{test_project}/chat",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"content": "Say hello in one word"}
        )
        assert chat_response.status_code == 200
        data = chat_response.json()
        assert "message" in data
        assert data["message"]["role"] == "assistant"
        assert len(data["message"]["content"]) > 0
        print(f"✓ Chat response received: {data['message']['content'][:100]}...")
        
        # Verify credit deduction
        me_response2 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        new_credits = me_response2.json()["credits"]
        assert new_credits == initial_credits - 1
        print(f"✓ Credit deducted: {initial_credits} -> {new_credits}")
        
        # Verify messages persisted
        project_response = requests.get(
            f"{BASE_URL}/api/projects/{test_project}",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        messages = project_response.json()["messages"]
        assert len(messages) >= 2  # user + assistant
        roles = [m["role"] for m in messages]
        assert "user" in roles
        assert "assistant" in roles
        print(f"✓ Messages persisted: {len(messages)} messages")


class TestDeleteProject:
    """Test project deletion"""
    
    def test_delete_project_and_verify_removal(self):
        """DELETE /api/projects/{id} removes project"""
        # Create project
        create_response = requests.post(
            f"{BASE_URL}/api/projects",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Delete_Project_" + str(int(time.time())),
                "description": "Project to be deleted"
            }
        )
        project_id = create_response.json()["project_id"]
        print(f"✓ Created project for deletion: {project_id}")
        
        # Delete project
        delete_response = requests.delete(
            f"{BASE_URL}/api/projects/{project_id}",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["deleted"] == 1
        print(f"✓ Deleted project: {project_id}")
        
        # Verify removal
        get_response = requests.get(
            f"{BASE_URL}/api/projects/{project_id}",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert get_response.status_code == 404
        print("✓ Verified project removal: 404")


class TestLogout:
    """Test logout endpoint"""
    
    def test_logout_endpoint_works(self):
        """POST /api/auth/logout returns ok (using a dummy token to not break other tests)"""
        # Note: We use a non-existent token to test the endpoint without breaking other tests
        response = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": "Bearer dummy_token_for_logout_test"},
            cookies={"session_token": "dummy_token_for_logout_test"}
        )
        assert response.status_code == 200
        assert response.json()["ok"] == True
        print("✓ Logout endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
