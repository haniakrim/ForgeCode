"""
FORGE v4 Feature Tests
- Theme toggle (frontend only - tested via Playwright)
- Project public field and role computed field
- PATCH /api/projects/{id} - owner can update, collaborators get 404
- POST /api/projects/{id}/invite - owner invites email
- DELETE /api/projects/{id}/members/{member_id} - only owner can remove
- GET /api/share/{project_id} - public read-only endpoint (NO AUTH)
- Collaborator access: list shared projects, GET project, POST chat (deducts from collaborator)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - seeded via mongosh
OWNER_TOKEN = "test_session_owner_1776413946618"
OWNER_EMAIL = "owner@forge.dev"
COLLAB_TOKEN = "test_session_collab_1776413946618"
COLLAB_EMAIL = "collaborator@forge.dev"


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
def collab_client():
    """Session with collaborator auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {COLLAB_TOKEN}"
    })
    return session


@pytest.fixture(scope="module")
def no_auth_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_project(owner_client):
    """Create a test project for collaboration tests"""
    resp = owner_client.post(f"{BASE_URL}/api/projects", json={
        "name": "TEST_Collab_Project",
        "description": "Project for collaboration testing"
    })
    assert resp.status_code == 200, f"Failed to create project: {resp.text}"
    project = resp.json()
    yield project
    # Cleanup
    owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


class TestProjectPublicField:
    """Test Project model has public field (default false) and role computed field"""
    
    def test_project_has_public_field_default_false(self, owner_client, test_project):
        """Project should have public field defaulting to false"""
        resp = owner_client.get(f"{BASE_URL}/api/projects/{test_project['project_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert "project" in data
        assert "public" in data["project"]
        assert data["project"]["public"] == False
    
    def test_project_has_role_field_owner(self, owner_client, test_project):
        """Owner should see role='owner' on their project"""
        resp = owner_client.get(f"{BASE_URL}/api/projects/{test_project['project_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project"]["role"] == "owner"
    
    def test_list_projects_includes_role(self, owner_client):
        """GET /api/projects should include role field"""
        resp = owner_client.get(f"{BASE_URL}/api/projects")
        assert resp.status_code == 200
        projects = resp.json()
        assert isinstance(projects, list)
        if len(projects) > 0:
            assert "role" in projects[0]


class TestPatchProject:
    """Test PATCH /api/projects/{id} - owner can update, collaborators get 404"""
    
    def test_owner_can_update_name(self, owner_client, test_project):
        """Owner can update project name"""
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{test_project['project_id']}", json={
            "name": "TEST_Updated_Name"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "TEST_Updated_Name"
    
    def test_owner_can_update_description(self, owner_client, test_project):
        """Owner can update project description"""
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{test_project['project_id']}", json={
            "description": "Updated description"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["description"] == "Updated description"
    
    def test_owner_can_set_public_true(self, owner_client, test_project):
        """Owner can set project to public"""
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{test_project['project_id']}", json={
            "public": True
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["public"] == True
    
    def test_owner_can_set_public_false(self, owner_client, test_project):
        """Owner can set project back to private"""
        resp = owner_client.patch(f"{BASE_URL}/api/projects/{test_project['project_id']}", json={
            "public": False
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["public"] == False
    
    def test_collaborator_cannot_update_project(self, owner_client, collab_client, test_project):
        """Collaborator should get 404 when trying to update project"""
        # First invite collaborator
        owner_client.post(f"{BASE_URL}/api/projects/{test_project['project_id']}/invite", json={
            "email": COLLAB_EMAIL
        })
        # Collaborator tries to update
        resp = collab_client.patch(f"{BASE_URL}/api/projects/{test_project['project_id']}", json={
            "name": "Hacked Name"
        })
        assert resp.status_code == 404
        assert "not owner" in resp.json().get("detail", "").lower() or "not found" in resp.json().get("detail", "").lower()


class TestInviteCollaborator:
    """Test POST /api/projects/{id}/invite"""
    
    def test_owner_can_invite_email(self, owner_client):
        """Owner can invite a collaborator by email"""
        # Create a fresh project for this test
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Invite_Project"
        })
        project = proj_resp.json()
        
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "newcollab@example.com"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "member_id" in data
        assert data["email"] == "newcollab@example.com"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_invite_returns_already_invited_on_duplicate(self, owner_client):
        """Inviting same email twice returns already_invited: true"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Duplicate_Invite"
        })
        project = proj_resp.json()
        
        # First invite
        owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "duplicate@example.com"
        })
        
        # Second invite
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "duplicate@example.com"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("already_invited") == True
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_cannot_invite_own_email(self, owner_client):
        """Owner cannot invite themselves"""
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Self_Invite"
        })
        project = proj_resp.json()
        
        resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": OWNER_EMAIL
        })
        assert resp.status_code == 400
        assert "owner" in resp.json().get("detail", "").lower()
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_collaborator_cannot_invite(self, owner_client, collab_client, test_project):
        """Collaborator cannot invite others"""
        resp = collab_client.post(f"{BASE_URL}/api/projects/{test_project['project_id']}/invite", json={
            "email": "another@example.com"
        })
        assert resp.status_code == 404


class TestRemoveMember:
    """Test DELETE /api/projects/{id}/members/{member_id}"""
    
    def test_owner_can_remove_member(self, owner_client):
        """Owner can remove a collaborator"""
        # Create project and invite
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Remove_Member"
        })
        project = proj_resp.json()
        
        invite_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "toremove@example.com"
        })
        member = invite_resp.json()
        
        # Remove member
        resp = owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}/members/{member['member_id']}")
        assert resp.status_code == 200
        assert resp.json().get("removed") == 1
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_collaborator_cannot_remove_member(self, owner_client, collab_client):
        """Collaborator cannot remove members"""
        # Create project and invite both collaborator and another user
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Collab_Remove"
        })
        project = proj_resp.json()
        
        # Invite collaborator
        owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": COLLAB_EMAIL
        })
        
        # Invite another user
        invite_resp = owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "other@example.com"
        })
        other_member = invite_resp.json()
        
        # Collaborator tries to remove
        resp = collab_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}/members/{other_member['member_id']}")
        assert resp.status_code == 404
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


class TestPublicShareEndpoint:
    """Test GET /api/share/{project_id} - public read-only, NO AUTH required"""
    
    def test_public_project_accessible_without_auth(self, owner_client, no_auth_client):
        """Public project can be accessed without authentication"""
        # Create and make public
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Public_Share"
        })
        project = proj_resp.json()
        owner_client.patch(f"{BASE_URL}/api/projects/{project['project_id']}", json={
            "public": True
        })
        
        # Access without auth
        resp = no_auth_client.get(f"{BASE_URL}/api/share/{project['project_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert "project" in data
        assert "messages" in data
        assert "owner" in data
        assert data["project"]["name"] == "TEST_Public_Share"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_private_project_returns_404(self, owner_client, no_auth_client):
        """Private project returns 404 on share endpoint"""
        # Create private project
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Private_Share"
        })
        project = proj_resp.json()
        
        # Access without auth
        resp = no_auth_client.get(f"{BASE_URL}/api/share/{project['project_id']}")
        assert resp.status_code == 404
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_nonexistent_project_returns_404(self, no_auth_client):
        """Non-existent project returns 404"""
        resp = no_auth_client.get(f"{BASE_URL}/api/share/nonexistent_project_id")
        assert resp.status_code == 404


class TestCollaboratorAccess:
    """Test collaborator can access shared projects"""
    
    def test_collaborator_sees_shared_project_in_list(self, owner_client, collab_client):
        """Collaborator sees shared projects in GET /api/projects"""
        # Create project and invite collaborator
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Shared_List"
        })
        project = proj_resp.json()
        owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": COLLAB_EMAIL
        })
        
        # Collaborator lists projects
        resp = collab_client.get(f"{BASE_URL}/api/projects")
        assert resp.status_code == 200
        projects = resp.json()
        shared = [p for p in projects if p["project_id"] == project["project_id"]]
        assert len(shared) == 1
        assert shared[0]["role"] == "collaborator"
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_collaborator_can_get_project(self, owner_client, collab_client):
        """Collaborator can GET /api/projects/{id}"""
        # Create project and invite collaborator
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Collab_Get"
        })
        project = proj_resp.json()
        owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": COLLAB_EMAIL
        })
        
        # Collaborator gets project
        resp = collab_client.get(f"{BASE_URL}/api/projects/{project['project_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project"]["role"] == "collaborator"
        assert "members" in data
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")
    
    def test_collaborator_cannot_access_uninvited_project(self, owner_client, collab_client):
        """Collaborator cannot access project they're not invited to"""
        # Create project without inviting collaborator
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_No_Access"
        })
        project = proj_resp.json()
        
        # Collaborator tries to access
        resp = collab_client.get(f"{BASE_URL}/api/projects/{project['project_id']}")
        assert resp.status_code == 404
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


class TestGetProjectReturnsMembers:
    """Test GET /api/projects/{id} returns members list"""
    
    def test_get_project_includes_members(self, owner_client):
        """GET /api/projects/{id} returns members array"""
        # Create project and invite
        proj_resp = owner_client.post(f"{BASE_URL}/api/projects", json={
            "name": "TEST_Members_List"
        })
        project = proj_resp.json()
        owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "member1@example.com"
        })
        owner_client.post(f"{BASE_URL}/api/projects/{project['project_id']}/invite", json={
            "email": "member2@example.com"
        })
        
        # Get project
        resp = owner_client.get(f"{BASE_URL}/api/projects/{project['project_id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert "members" in data
        assert len(data["members"]) == 2
        emails = [m["email"] for m in data["members"]]
        assert "member1@example.com" in emails
        assert "member2@example.com" in emails
        
        # Cleanup
        owner_client.delete(f"{BASE_URL}/api/projects/{project['project_id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
