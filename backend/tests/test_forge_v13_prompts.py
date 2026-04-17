"""
FORGE v13 — Prompt Marketplace Tests
Tests for P3 backlog: Community prompt marketplace (/prompts page)
- GET /api/prompts (no auth) returns 6 curated prompts
- Sorting: popular, recent, featured
- Filtering: q=search, tag=filter
- GET /api/prompts/{prompt_id} returns full prompt with body
- POST /api/prompts (authed) creates community prompt
- Validation: empty title/body → 400, title > 80 chars → 400, body > 8000 chars → 400
- POST /api/prompts/{id}/upvote toggles upvote
- POST /api/prompts/{id}/apply sets user's system_prompt + applied_prompt_id
- GET /api/settings returns applied_prompt_id
- Seeding idempotency: curated prompts don't duplicate on restart
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for local testing
    BASE_URL = "https://buildforge-ai.preview.emergentagent.com"

# Test credentials from iteration_12
TEST_TOKEN = "fork_p1_tok_1776417567179"
TEST_USER_ID = "fork-p1-1776417567179"


class TestPromptsPublicEndpoints:
    """Public endpoints - no auth required"""

    def test_list_prompts_returns_6_curated(self):
        """GET /api/prompts returns 6 curated prompts seeded on startup"""
        r = requests.get(f"{BASE_URL}/api/prompts")
        assert r.status_code == 200
        prompts = r.json()
        curated = [p for p in prompts if p.get("curated")]
        assert len(curated) == 6, f"Expected 6 curated prompts, got {len(curated)}"
        
        # Verify expected titles
        titles = {p["title"] for p in curated}
        expected = {
            "Stripe-style Engineer",
            "Paranoid Security Auditor",
            "Design-obsessed Frontend Dev",
            "Rust Systems Engineer",
            "Concise Documentation Writer",
            "Kubernetes-native DevOps",
        }
        assert titles == expected, f"Missing prompts: {expected - titles}"

    def test_list_prompts_3_featured(self):
        """3 prompts should be marked featured=true"""
        r = requests.get(f"{BASE_URL}/api/prompts")
        assert r.status_code == 200
        prompts = r.json()
        featured = [p for p in prompts if p.get("featured")]
        assert len(featured) == 3, f"Expected 3 featured prompts, got {len(featured)}"
        
        featured_titles = {p["title"] for p in featured}
        expected = {"Stripe-style Engineer", "Paranoid Security Auditor", "Design-obsessed Frontend Dev"}
        assert featured_titles == expected

    def test_sort_popular(self):
        """GET /api/prompts?sort=popular sorts by upvotes DESC, then usage_count DESC"""
        r = requests.get(f"{BASE_URL}/api/prompts?sort=popular")
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) >= 6
        # Verify sort order - upvotes should be descending
        for i in range(len(prompts) - 1):
            upvotes_a = prompts[i].get("upvotes", 0)
            upvotes_b = prompts[i + 1].get("upvotes", 0)
            if upvotes_a == upvotes_b:
                # Secondary sort by usage_count
                usage_a = prompts[i].get("usage_count", 0)
                usage_b = prompts[i + 1].get("usage_count", 0)
                assert usage_a >= usage_b, f"Usage count not sorted: {usage_a} < {usage_b}"
            else:
                assert upvotes_a >= upvotes_b, f"Upvotes not sorted: {upvotes_a} < {upvotes_b}"

    def test_sort_recent(self):
        """GET /api/prompts?sort=recent sorts by created_at DESC"""
        r = requests.get(f"{BASE_URL}/api/prompts?sort=recent")
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) >= 6
        # Verify sort order - created_at should be descending
        for i in range(len(prompts) - 1):
            ts_a = prompts[i].get("created_at", "")
            ts_b = prompts[i + 1].get("created_at", "")
            assert ts_a >= ts_b, f"Created_at not sorted: {ts_a} < {ts_b}"

    def test_sort_featured(self):
        """GET /api/prompts?sort=featured puts featured=true first, then curated=true, then by upvotes"""
        r = requests.get(f"{BASE_URL}/api/prompts?sort=featured")
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) >= 6
        
        # First 3 should be featured
        for i in range(3):
            assert prompts[i].get("featured") is True, f"Prompt {i} should be featured"

    def test_search_q_security(self):
        """GET /api/prompts?q=security filters by title/description/tag regex-insensitive"""
        r = requests.get(f"{BASE_URL}/api/prompts?q=security")
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) >= 1
        # Should return Paranoid Security Auditor
        titles = [p["title"] for p in prompts]
        assert "Paranoid Security Auditor" in titles

    def test_filter_tag_frontend(self):
        """GET /api/prompts?tag=frontend returns prompts with 'frontend' in tags"""
        r = requests.get(f"{BASE_URL}/api/prompts?tag=frontend")
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) >= 1
        # Should return Design-obsessed Frontend Dev
        for p in prompts:
            assert "frontend" in p.get("tags", []), f"Prompt {p['title']} missing 'frontend' tag"
        titles = [p["title"] for p in prompts]
        assert "Design-obsessed Frontend Dev" in titles

    def test_get_prompt_by_id(self):
        """GET /api/prompts/{prompt_id} returns full prompt including body"""
        r = requests.get(f"{BASE_URL}/api/prompts/curated_stripe_style")
        assert r.status_code == 200
        prompt = r.json()
        assert prompt["title"] == "Stripe-style Engineer"
        assert "body" in prompt
        assert len(prompt["body"]) > 50  # Body should have content
        assert "Stripe engineer" in prompt["body"]

    def test_get_prompt_not_found(self):
        """GET /api/prompts/{prompt_id} returns 404 for unknown prompt"""
        r = requests.get(f"{BASE_URL}/api/prompts/nonexistent_prompt_xyz")
        assert r.status_code == 404


class TestPromptsAuthenticatedEndpoints:
    """Authenticated endpoints - require session token"""

    @pytest.fixture
    def auth_headers(self):
        return {"Authorization": f"Bearer {TEST_TOKEN}", "Content-Type": "application/json"}

    def test_submit_prompt_success(self, auth_headers):
        """POST /api/prompts creates a community prompt with curated=false, featured=false"""
        payload = {
            "title": f"TEST Pytest Prompt {int(time.time())}",
            "description": "A test prompt created by pytest",
            "body": "You are a helpful test assistant for pytest testing.",
            "tags": ["test", "pytest"],
        }
        r = requests.post(f"{BASE_URL}/api/prompts", json=payload, headers=auth_headers)
        assert r.status_code == 200
        prompt = r.json()
        
        # Verify response structure
        assert prompt["title"] == payload["title"]
        assert prompt["description"] == payload["description"]
        assert prompt["body"] == payload["body"]
        assert prompt["tags"] == ["test", "pytest"]
        assert prompt["curated"] is False
        assert prompt["featured"] is False
        assert prompt["upvotes"] == 0
        assert prompt["usage_count"] == 0
        assert prompt["author_user_id"] == TEST_USER_ID
        assert "prompt_id" in prompt
        assert prompt["prompt_id"].startswith("pmt_")

    def test_submit_prompt_empty_title_400(self, auth_headers):
        """POST /api/prompts with empty title returns 400"""
        payload = {"title": "", "description": "test", "body": "test body", "tags": []}
        r = requests.post(f"{BASE_URL}/api/prompts", json=payload, headers=auth_headers)
        assert r.status_code == 400
        assert "Title must be 1-80 chars" in r.json().get("detail", "")

    def test_submit_prompt_empty_body_400(self, auth_headers):
        """POST /api/prompts with empty body returns 400"""
        payload = {"title": "Valid Title", "description": "test", "body": "", "tags": []}
        r = requests.post(f"{BASE_URL}/api/prompts", json=payload, headers=auth_headers)
        assert r.status_code == 400
        assert "Prompt body must be 1-8000 chars" in r.json().get("detail", "")

    def test_submit_prompt_title_too_long_400(self, auth_headers):
        """POST /api/prompts with title > 80 chars returns 400"""
        payload = {"title": "A" * 81, "description": "test", "body": "test body", "tags": []}
        r = requests.post(f"{BASE_URL}/api/prompts", json=payload, headers=auth_headers)
        assert r.status_code == 400
        assert "Title must be 1-80 chars" in r.json().get("detail", "")

    def test_submit_prompt_body_too_long_400(self, auth_headers):
        """POST /api/prompts with body > 8000 chars returns 400"""
        payload = {"title": "Valid Title", "description": "test", "body": "A" * 8001, "tags": []}
        r = requests.post(f"{BASE_URL}/api/prompts", json=payload, headers=auth_headers)
        assert r.status_code == 400
        assert "Prompt body must be 1-8000 chars" in r.json().get("detail", "")

    def test_upvote_toggle(self, auth_headers):
        """POST /api/prompts/{id}/upvote toggles upvote on/off"""
        prompt_id = "curated_docs_writer"
        
        # First upvote
        r1 = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/upvote", headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["upvoted"] is True
        
        # Second call toggles off
        r2 = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/upvote", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["upvoted"] is False

    def test_upvote_unknown_prompt_404(self, auth_headers):
        """POST /api/prompts/{id}/upvote with unknown prompt_id returns 404"""
        r = requests.post(f"{BASE_URL}/api/prompts/nonexistent_xyz/upvote", headers=auth_headers)
        assert r.status_code == 404
        assert "Prompt not found" in r.json().get("detail", "")

    def test_apply_prompt_sets_settings(self, auth_headers):
        """POST /api/prompts/{id}/apply sets user_settings.system_prompt and applied_prompt_id"""
        prompt_id = "curated_k8s_devops"
        
        # Apply the prompt
        r1 = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/apply", headers=auth_headers)
        assert r1.status_code == 200
        result = r1.json()
        assert result["applied"] is True
        assert result["prompt_id"] == prompt_id
        assert result["title"] == "Kubernetes-native DevOps"
        
        # Verify settings updated
        r2 = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert r2.status_code == 200
        settings = r2.json()
        assert settings["applied_prompt_id"] == prompt_id
        assert "Kubernetes-native" in settings["system_prompt"]

    def test_apply_prompt_increments_usage_count(self, auth_headers):
        """POST /api/prompts/{id}/apply increments usage_count"""
        prompt_id = "curated_rust_systems"
        
        # Get initial usage count
        r1 = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}")
        initial_count = r1.json().get("usage_count", 0)
        
        # Apply the prompt
        r2 = requests.post(f"{BASE_URL}/api/prompts/{prompt_id}/apply", headers=auth_headers)
        assert r2.status_code == 200
        
        # Verify usage count incremented
        r3 = requests.get(f"{BASE_URL}/api/prompts/{prompt_id}")
        new_count = r3.json().get("usage_count", 0)
        assert new_count == initial_count + 1

    def test_apply_unknown_prompt_404(self, auth_headers):
        """POST /api/prompts/{id}/apply with unknown prompt_id returns 404"""
        r = requests.post(f"{BASE_URL}/api/prompts/nonexistent_xyz/apply", headers=auth_headers)
        assert r.status_code == 404


class TestShowcaseRegression:
    """Regression tests for showcase endpoints (from iteration_10)"""

    def test_showcase_detail_returns_file_paths(self):
        """GET /api/showcase/{id} returns file_paths array"""
        r = requests.get(f"{BASE_URL}/api/showcase/prj_7c24b636fe")
        assert r.status_code == 200
        data = r.json()
        assert "file_paths" in data
        assert isinstance(data["file_paths"], list)
        assert len(data["file_paths"]) >= 1

    def test_showcase_detail_returns_fork_count(self):
        """GET /api/showcase/{id} returns fork_count"""
        r = requests.get(f"{BASE_URL}/api/showcase/prj_7c24b636fe")
        assert r.status_code == 200
        data = r.json()
        assert "fork_count" in data
        assert isinstance(data["fork_count"], int)

    def test_showcase_list_public(self):
        """GET /api/showcase returns public projects with owner info"""
        r = requests.get(f"{BASE_URL}/api/showcase")
        assert r.status_code == 200
        projects = r.json()
        assert isinstance(projects, list)
        # All returned projects should have owner info (enriched by showcase endpoint)
        for p in projects:
            assert "owner_name" in p, "Showcase projects should have owner_name"
            assert "name" in p, "Showcase projects should have name"


class TestSeedingIdempotency:
    """Test that curated prompts don't duplicate on restart"""

    def test_curated_prompts_count_stable(self):
        """Curated prompts should always be exactly 6"""
        r = requests.get(f"{BASE_URL}/api/prompts")
        assert r.status_code == 200
        prompts = r.json()
        curated = [p for p in prompts if p.get("curated")]
        assert len(curated) == 6, f"Expected 6 curated prompts, got {len(curated)}"

    def test_curated_prompt_ids_unique(self):
        """Each curated prompt should have a unique prompt_id"""
        r = requests.get(f"{BASE_URL}/api/prompts")
        assert r.status_code == 200
        prompts = r.json()
        curated = [p for p in prompts if p.get("curated")]
        prompt_ids = [p["prompt_id"] for p in curated]
        assert len(prompt_ids) == len(set(prompt_ids)), "Duplicate prompt_ids found"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
