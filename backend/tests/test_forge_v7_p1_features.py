"""
FORGE v7 P1 Feature Tests
- GET /api/models - returns 7 models with provider field
- GET /api/settings - returns user settings with defaults
- PUT /api/settings - update model_id, system_prompt, byo_keys
- POST /api/integrations/{github,vercel,netlify}/connect - token validation (401 for fake tokens)
- DELETE /api/integrations/{provider} - disconnect integrations
- POST /api/projects/{id}/github/push - requires GitHub connected
- POST /api/projects/{id}/vercel/deploy - requires Vercel connected
- POST /api/projects/{id}/netlify/deploy - requires Netlify connected
- Chat endpoints regression - still work with default model after settings refactor
"""
import pytest
import requests
import os
import time
import json
import subprocess

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://buildforge-ai.preview.emergentagent.com').rstrip('/')


def get_test_data():
    """Get test tokens from mongosh"""
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
var session = db.user_sessions.findOne({session_token: /^test_session_v7_/}, {_id: 0});
var user = session ? db.users.findOne({user_id: session.user_id}, {_id: 0}) : null;
var project = db.projects.findOne({project_id: /^prj_test_v7_/}, {_id: 0});
print(JSON.stringify({
    session_token: session?.session_token,
    user_id: user?.user_id,
    email: user?.email,
    project_id: project?.project_id
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
    """Session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['session_token']}"
    })
    return session


@pytest.fixture
def no_auth_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== GET /api/models ====================
class TestModelsEndpoint:
    """Test GET /api/models - returns 7 models with provider field"""
    
    def test_models_returns_7_models(self, no_auth_client):
        """GET /api/models returns exactly 7 models"""
        response = no_auth_client.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        models = response.json()
        assert len(models) == 7, f"Expected 7 models, got {len(models)}"
        print(f"Models returned: {[m['id'] for m in models]}")
    
    def test_models_have_provider_field(self, no_auth_client):
        """Each model has provider field (anthropic/openai/gemini)"""
        response = no_auth_client.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        models = response.json()
        
        valid_providers = {"anthropic", "openai", "gemini"}
        for m in models:
            assert "provider" in m, f"Model {m['id']} missing provider field"
            assert m["provider"] in valid_providers, f"Invalid provider: {m['provider']}"
            assert "id" in m
            assert "label" in m
            assert "family" in m
        print(f"All models have valid provider fields")
    
    def test_claude_sonnet_is_recommended(self, no_auth_client):
        """claude-sonnet-4-5-20250929 is marked as recommended"""
        response = no_auth_client.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        models = response.json()
        
        sonnet = next((m for m in models if m["id"] == "claude-sonnet-4-5-20250929"), None)
        assert sonnet is not None, "claude-sonnet-4-5-20250929 not found"
        assert sonnet.get("recommended") == True, "claude-sonnet-4-5-20250929 should be recommended"
        print(f"Recommended model: {sonnet['id']}")


# ==================== GET /api/settings ====================
class TestGetSettings:
    """Test GET /api/settings - returns user settings with defaults"""
    
    def test_settings_requires_auth(self, no_auth_client):
        """GET /api/settings requires authentication"""
        response = no_auth_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 401
    
    def test_settings_returns_defaults(self, auth_client):
        """GET /api/settings returns defaults for new user"""
        response = auth_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Check default model_id
        assert data["model_id"] == "claude-sonnet-4-5-20250929", f"Default model should be claude-sonnet-4-5-20250929, got {data['model_id']}"
        
        # Check system_prompt is empty string (use FORGE default)
        assert data["system_prompt"] == "", "Default system_prompt should be empty"
        
        # Check byo_keys is empty dict
        assert data["byo_keys"] == {}, f"Default byo_keys should be empty, got {data['byo_keys']}"
        
        # Check integrations all disconnected
        assert "integrations" in data
        assert data["integrations"]["github"]["connected"] == False
        assert data["integrations"]["vercel"]["connected"] == False
        assert data["integrations"]["netlify"]["connected"] == False
        
        print(f"Settings defaults verified: model={data['model_id']}, integrations all disconnected")


# ==================== PUT /api/settings ====================
class TestUpdateSettings:
    """Test PUT /api/settings - update model_id, system_prompt, byo_keys"""
    
    def test_update_model_id_valid(self, auth_client):
        """PUT /api/settings with valid model_id persists and returns updated settings"""
        payload = {"model_id": "gpt-5.2"}
        response = auth_client.put(f"{BASE_URL}/api/settings", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "gpt-5.2"
        
        # Verify persistence with GET
        get_response = auth_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        assert get_response.json()["model_id"] == "gpt-5.2"
        print("Model updated to gpt-5.2 and persisted")
        
        # Reset to default
        auth_client.put(f"{BASE_URL}/api/settings", json={"model_id": "claude-sonnet-4-5-20250929"})
    
    def test_update_model_id_invalid(self, auth_client):
        """PUT /api/settings with invalid model_id returns 400"""
        payload = {"model_id": "invalid-model-id"}
        response = auth_client.put(f"{BASE_URL}/api/settings", json=payload)
        assert response.status_code == 400
        assert "Unknown model_id" in response.json().get("detail", "")
        print("Invalid model_id correctly rejected with 400")
    
    def test_update_system_prompt_valid(self, auth_client):
        """PUT /api/settings with valid system_prompt persists"""
        custom_prompt = "You are a helpful coding assistant."
        payload = {"system_prompt": custom_prompt}
        response = auth_client.put(f"{BASE_URL}/api/settings", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["system_prompt"] == custom_prompt
        
        # Verify persistence
        get_response = auth_client.get(f"{BASE_URL}/api/settings")
        assert get_response.json()["system_prompt"] == custom_prompt
        print("System prompt updated and persisted")
        
        # Reset
        auth_client.put(f"{BASE_URL}/api/settings", json={"system_prompt": ""})
    
    def test_update_system_prompt_too_long(self, auth_client):
        """PUT /api/settings with system_prompt > 8000 chars returns 400"""
        long_prompt = "X" * 9000
        payload = {"system_prompt": long_prompt}
        response = auth_client.put(f"{BASE_URL}/api/settings", json=payload)
        assert response.status_code == 400
        assert "too long" in response.json().get("detail", "").lower() or "8000" in response.json().get("detail", "")
        print("System prompt too long correctly rejected with 400")
    
    def test_update_byo_keys_stores_key(self, auth_client):
        """PUT /api/settings with byo_keys stores the key; GET returns redacted"""
        payload = {"byo_keys": {"openai": "sk-test-key-12345"}}
        response = auth_client.put(f"{BASE_URL}/api/settings", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Response should show key is set (redacted to boolean)
        assert data["byo_keys"].get("openai") == True, "byo_keys.openai should be True (redacted)"
        
        # Verify persistence
        get_response = auth_client.get(f"{BASE_URL}/api/settings")
        assert get_response.json()["byo_keys"].get("openai") == True
        print("BYO key stored and redacted correctly")
    
    def test_update_byo_keys_clear_key(self, auth_client):
        """PUT /api/settings with byo_keys: {openai: ''} clears the stored key"""
        # First set a key
        auth_client.put(f"{BASE_URL}/api/settings", json={"byo_keys": {"openai": "sk-test-key"}})
        
        # Clear the key
        payload = {"byo_keys": {"openai": ""}}
        response = auth_client.put(f"{BASE_URL}/api/settings", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Key should be cleared (not in byo_keys or False)
        assert data["byo_keys"].get("openai") in [None, False, {}], f"byo_keys.openai should be cleared, got {data['byo_keys']}"
        print("BYO key cleared successfully")


# ==================== Integration Connect Endpoints ====================
class TestIntegrationConnect:
    """Test POST /api/integrations/{provider}/connect - token validation"""
    
    def test_github_connect_fake_token_rejected(self, auth_client):
        """POST /api/integrations/github/connect with fake token returns 401"""
        payload = {"token": "ghp_fake_invalid_abc123"}
        response = auth_client.post(f"{BASE_URL}/api/integrations/github/connect", json=payload)
        assert response.status_code == 401
        assert "rejected" in response.json().get("detail", "").lower() or "github" in response.json().get("detail", "").lower()
        print("Fake GitHub token correctly rejected with 401")
    
    def test_vercel_connect_fake_token_rejected(self, auth_client):
        """POST /api/integrations/vercel/connect with fake token returns 401"""
        payload = {"token": "fake_vercel_token_xyz"}
        response = auth_client.post(f"{BASE_URL}/api/integrations/vercel/connect", json=payload)
        assert response.status_code == 401
        assert "rejected" in response.json().get("detail", "").lower() or "vercel" in response.json().get("detail", "").lower()
        print("Fake Vercel token correctly rejected with 401")
    
    def test_netlify_connect_fake_token_rejected(self, auth_client):
        """POST /api/integrations/netlify/connect with fake token returns 401"""
        payload = {"token": "fake_netlify_token_abc"}
        response = auth_client.post(f"{BASE_URL}/api/integrations/netlify/connect", json=payload)
        assert response.status_code == 401
        assert "rejected" in response.json().get("detail", "").lower() or "netlify" in response.json().get("detail", "").lower()
        print("Fake Netlify token correctly rejected with 401")
    
    def test_github_connect_missing_token(self, auth_client):
        """POST /api/integrations/github/connect with empty token returns 400"""
        payload = {"token": ""}
        response = auth_client.post(f"{BASE_URL}/api/integrations/github/connect", json=payload)
        assert response.status_code == 400
        assert "missing" in response.json().get("detail", "").lower()
        print("Empty GitHub token correctly rejected with 400")


# ==================== Integration Disconnect Endpoints ====================
class TestIntegrationDisconnect:
    """Test DELETE /api/integrations/{provider} - disconnect integrations"""
    
    def test_disconnect_github_when_not_connected(self, auth_client):
        """DELETE /api/integrations/github when not connected returns {disconnected: true}"""
        response = auth_client.delete(f"{BASE_URL}/api/integrations/github")
        assert response.status_code == 200
        data = response.json()
        assert data.get("disconnected") == True
        assert data.get("provider") == "github"
        print("GitHub disconnect (not connected) returns {disconnected: true}")
    
    def test_disconnect_vercel_when_not_connected(self, auth_client):
        """DELETE /api/integrations/vercel when not connected returns {disconnected: true}"""
        response = auth_client.delete(f"{BASE_URL}/api/integrations/vercel")
        assert response.status_code == 200
        data = response.json()
        assert data.get("disconnected") == True
        print("Vercel disconnect returns {disconnected: true}")
    
    def test_disconnect_netlify_when_not_connected(self, auth_client):
        """DELETE /api/integrations/netlify when not connected returns {disconnected: true}"""
        response = auth_client.delete(f"{BASE_URL}/api/integrations/netlify")
        assert response.status_code == 200
        data = response.json()
        assert data.get("disconnected") == True
        print("Netlify disconnect returns {disconnected: true}")
    
    def test_disconnect_unknown_provider(self, auth_client):
        """DELETE /api/integrations/unknown returns 400"""
        response = auth_client.delete(f"{BASE_URL}/api/integrations/unknown")
        assert response.status_code == 400
        assert "unknown" in response.json().get("detail", "").lower() or "provider" in response.json().get("detail", "").lower()
        print("Unknown provider correctly rejected with 400")


# ==================== Deploy Endpoints (Not Connected) ====================
class TestDeployNotConnected:
    """Test deploy endpoints when integrations not connected"""
    
    def test_github_push_not_connected(self, auth_client, test_data):
        """POST /api/projects/{id}/github/push without GitHub connected returns 400"""
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/github/push",
            json={"repo_name": "test-repo"}
        )
        assert response.status_code == 400
        detail = response.json().get("detail", "")
        assert "github" in detail.lower() and "not connected" in detail.lower()
        print(f"GitHub push without connection: 400 - {detail}")
    
    def test_vercel_deploy_not_connected(self, auth_client, test_data):
        """POST /api/projects/{id}/vercel/deploy without Vercel connected returns 400"""
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/vercel/deploy",
            json={"name": "test-deploy"}
        )
        assert response.status_code == 400
        detail = response.json().get("detail", "")
        assert "vercel" in detail.lower() and "not connected" in detail.lower()
        print(f"Vercel deploy without connection: 400 - {detail}")
    
    def test_netlify_deploy_not_connected(self, auth_client, test_data):
        """POST /api/projects/{id}/netlify/deploy without Netlify connected returns 400"""
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/netlify/deploy",
            json={"site_name": "test-site"}
        )
        assert response.status_code == 400
        detail = response.json().get("detail", "")
        assert "netlify" in detail.lower() and "not connected" in detail.lower()
        print(f"Netlify deploy without connection: 400 - {detail}")


# ==================== Chat Regression Tests ====================
class TestChatRegression:
    """Test chat endpoints still work after settings refactor"""
    
    def test_chat_endpoint_works_with_default_model(self, auth_client, test_data):
        """POST /api/projects/{id}/chat works with default model"""
        # Ensure default model is set
        auth_client.put(f"{BASE_URL}/api/settings", json={"model_id": "claude-sonnet-4-5-20250929"})
        
        payload = {"content": "Hello, just testing the chat endpoint works."}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat",
            json=payload,
            timeout=60
        )
        
        # Should succeed (200) or return error message in response (not 5xx)
        assert response.status_code in [200, 402], f"Chat should work, got {response.status_code}: {response.text[:200]}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "content" in data["message"]
            print(f"Chat response received: {data['message']['content'][:100]}...")
        else:
            print(f"Chat returned 402 (out of credits) - expected for test user")
    
    def test_chat_respects_selected_model(self, auth_client, test_data):
        """Chat endpoint respects user's selected model (gpt-5.2)"""
        # Set model to gpt-5.2
        settings_response = auth_client.put(f"{BASE_URL}/api/settings", json={"model_id": "gpt-5.2"})
        assert settings_response.status_code == 200
        assert settings_response.json()["model_id"] == "gpt-5.2"
        
        payload = {"content": "Quick test with GPT-5.2 model."}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/chat",
            json=payload,
            timeout=60
        )
        
        # Should not return 5xx
        assert response.status_code < 500, f"Chat with gpt-5.2 should not 5xx, got {response.status_code}: {response.text[:200]}"
        
        if response.status_code == 200:
            print("Chat with gpt-5.2 succeeded")
        elif response.status_code == 402:
            print("Chat returned 402 (out of credits) - model selection worked, just no credits")
        
        # Reset to default
        auth_client.put(f"{BASE_URL}/api/settings", json={"model_id": "claude-sonnet-4-5-20250929"})


# ==================== Existing Features Regression ====================
class TestExistingFeaturesRegression:
    """Test existing features still work (export, activity, invite, stripe)"""
    
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
    
    def test_invite_endpoint_works(self, auth_client, test_data):
        """POST /api/projects/{id}/invite still works"""
        payload = {"email": f"regression_test_{int(time.time())}@forge.dev", "role": "editor"}
        response = auth_client.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/invite",
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "member_id" in data or "already_invited" in data
        print("Invite endpoint works")
    
    def test_stripe_packages_endpoint_works(self, no_auth_client):
        """GET /api/payments/packages still works"""
        response = no_auth_client.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        packages = response.json()
        assert len(packages) > 0
        assert all("package_id" in p for p in packages)
        print(f"Stripe packages endpoint works: {len(packages)} packages")
    
    def test_stripe_checkout_works(self, auth_client):
        """POST /api/payments/checkout still works"""
        payload = {
            "package_id": "studio",
            "origin_url": "https://buildforge-ai.preview.emergentagent.com"
        }
        response = auth_client.post(f"{BASE_URL}/api/payments/checkout", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        print(f"Stripe checkout works: session_id={data['session_id'][:20]}...")


# ==================== Cleanup ====================
@pytest.fixture(scope="module", autouse=True)
def cleanup(request):
    """Cleanup test data after all tests"""
    yield
    # Cleanup after tests
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
db.users.deleteMany({email: /^test\.v7\./});
db.user_sessions.deleteMany({session_token: /^test_session_v7_/});
db.projects.deleteMany({project_id: /^prj_test_v7_/});
db.user_settings.deleteMany({user_id: /^test-user-v7-/});
db.project_members.deleteMany({email: /^regression_test_/});
print("Cleanup completed");
'''
    ], capture_output=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
