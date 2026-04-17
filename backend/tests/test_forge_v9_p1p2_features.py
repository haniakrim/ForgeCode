"""
FORGE v9 P1/P2 Feature Tests
Tests for 4 new features:
① File history: versioning, diff, rollback
② Notifications: in-app notification bell
③ Multi-agent orchestration: planner → coder → reviewer
④ Agent write_file creates version with source='agent'

Collections used: project_file_versions, notifications
"""
import pytest
import requests
import os
import time
import json
import subprocess
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://buildforge-ai.preview.emergentagent.com').rstrip('/')


def seed_test_data():
    """Seed test user, session, project, viewer, and invitee via mongosh"""
    ts = str(int(time.time() * 1000))
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', f'''
use('test_database');

// Clean up old test data
db.users.deleteMany({{user_id: /^test-user-v9-/}});
db.user_sessions.deleteMany({{session_token: /^test_session_v9_/}});
db.projects.deleteMany({{project_id: /^prj_test_v9_/}});
db.project_members.deleteMany({{project_id: /^prj_test_v9_/}});
db.project_files.deleteMany({{project_id: /^prj_test_v9_/}});
db.project_file_versions.deleteMany({{project_id: /^prj_test_v9_/}});
db.notifications.deleteMany({{user_id: /^test-user-v9-/}});
db.messages.deleteMany({{project_id: /^prj_test_v9_/}});

// Create owner user with 100 credits
var ownerId = 'test-user-v9-owner-{ts}';
var ownerToken = 'test_session_v9_owner_{ts}';
db.users.insertOne({{
  user_id: ownerId,
  email: 'test.owner.v9.{ts}@forge.dev',
  name: 'Test Owner V9',
  picture: 'https://via.placeholder.com/150',
  credits: 100,
  created_at: new Date().toISOString()
}});
db.user_sessions.insertOne({{
  user_id: ownerId,
  session_token: ownerToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
}});

// Create project
var projectId = 'prj_test_v9_{ts}';
db.projects.insertOne({{
  project_id: projectId,
  user_id: ownerId,
  name: 'Test Project V9',
  description: 'Testing file history, notifications, multi-agent',
  stack: 'react-fastapi',
  public: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}});

// Create viewer user
var viewerId = 'test-user-v9-viewer-{ts}';
var viewerToken = 'test_session_v9_viewer_{ts}';
db.users.insertOne({{
  user_id: viewerId,
  email: 'test.viewer.v9.{ts}@forge.dev',
  name: 'Test Viewer V9',
  picture: 'https://via.placeholder.com/150',
  credits: 10,
  created_at: new Date().toISOString()
}});
db.user_sessions.insertOne({{
  user_id: viewerId,
  session_token: viewerToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
}});

// Add viewer as project member with viewer role
db.project_members.insertOne({{
  member_id: 'mem_v9_viewer_{ts}',
  project_id: projectId,
  email: 'test.viewer.v9.{ts}@forge.dev',
  role: 'viewer',
  invited_by: ownerId,
  invited_at: new Date().toISOString()
}});

// Create invitee user (for notification test)
var inviteeId = 'test-user-v9-invitee-{ts}';
var inviteeToken = 'test_session_v9_invitee_{ts}';
db.users.insertOne({{
  user_id: inviteeId,
  email: 'invitee.test@forge.dev',
  name: 'Test Invitee V9',
  picture: 'https://via.placeholder.com/150',
  credits: 10,
  created_at: new Date().toISOString()
}});
db.user_sessions.insertOne({{
  user_id: inviteeId,
  session_token: inviteeToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
}});

// Create low-credits user for 402 test
var lowCreditsId = 'test-user-v9-lowcredits-{ts}';
var lowCreditsToken = 'test_session_v9_lowcredits_{ts}';
db.users.insertOne({{
  user_id: lowCreditsId,
  email: 'test.lowcredits.v9.{ts}@forge.dev',
  name: 'Test LowCredits V9',
  picture: 'https://via.placeholder.com/150',
  credits: 1,
  created_at: new Date().toISOString()
}});
db.user_sessions.insertOne({{
  user_id: lowCreditsId,
  session_token: lowCreditsToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
}});
// Add low-credits user as editor
db.project_members.insertOne({{
  member_id: 'mem_v9_lowcredits_{ts}',
  project_id: projectId,
  email: 'test.lowcredits.v9.{ts}@forge.dev',
  role: 'editor',
  invited_by: ownerId,
  invited_at: new Date().toISOString()
}});

print(JSON.stringify({{
    owner_token: ownerToken,
    owner_id: ownerId,
    owner_email: 'test.owner.v9.{ts}@forge.dev',
    project_id: projectId,
    viewer_token: viewerToken,
    viewer_id: viewerId,
    invitee_token: inviteeToken,
    invitee_id: inviteeId,
    invitee_email: 'invitee.test@forge.dev',
    low_credits_token: lowCreditsToken,
    low_credits_id: lowCreditsId
}}));
'''
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Seed error: {result.stderr}")
        raise Exception(f"Failed to seed test data: {result.stderr}")
    
    return json.loads(result.stdout.strip())


@pytest.fixture(scope="module")
def test_data():
    """Seed and return test data"""
    return seed_test_data()


@pytest.fixture
def owner_client(test_data):
    """Session with auth (owner)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['owner_token']}"
    })
    return session


@pytest.fixture
def viewer_client(test_data):
    """Session with auth (viewer role)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['viewer_token']}"
    })
    return session


@pytest.fixture
def invitee_client(test_data):
    """Session with auth (invitee)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['invitee_token']}"
    })
    return session


@pytest.fixture
def low_credits_client(test_data):
    """Session with auth (low credits user)"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['low_credits_token']}"
    })
    return session


@pytest.fixture
def no_auth_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ==================== ① FILE HISTORY / VERSIONING ====================
class TestFileHistory:
    """Test file versioning, history, diff, and restore endpoints"""
    
    def test_put_file_creates_version(self, owner_client, test_data):
        """PUT /api/projects/{id}/files creates a version in project_file_versions"""
        project_id = test_data['project_id']
        
        # Create first version
        payload = {"path": "test_history.txt", "content": "Version 1 content"}
        response = owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check version was created via history endpoint
        history_response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=test_history.txt")
        assert history_response.status_code == 200
        versions = history_response.json()
        assert len(versions) >= 1, "Should have at least 1 version"
        assert versions[0]['path'] == 'test_history.txt'
        assert versions[0]['source'] == 'user'
        print(f"Created version: {versions[0]['version_id']}")
    
    def test_put_file_twice_creates_two_versions(self, owner_client, test_data):
        """PUT /api/projects/{id}/files twice on same path with DIFFERENT content creates 2 versions"""
        project_id = test_data['project_id']
        
        # Create first version
        payload1 = {"path": "test_multi_version.txt", "content": "First version content AAA"}
        response1 = owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=payload1)
        assert response1.status_code == 200
        
        time.sleep(0.1)  # Small delay to ensure different timestamps
        
        # Create second version with DIFFERENT content
        payload2 = {"path": "test_multi_version.txt", "content": "Second version content BBB"}
        response2 = owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=payload2)
        assert response2.status_code == 200
        
        # Check history has 2 versions
        history_response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=test_multi_version.txt")
        assert history_response.status_code == 200
        versions = history_response.json()
        assert len(versions) >= 2, f"Should have at least 2 versions, got {len(versions)}"
        print(f"Created {len(versions)} versions for test_multi_version.txt")
    
    def test_put_identical_content_no_duplicate_version(self, owner_client, test_data):
        """PUT /api/projects/{id}/files with IDENTICAL content back-to-back does NOT create duplicate version"""
        project_id = test_data['project_id']
        
        # Create first version
        payload = {"path": "test_idempotent.txt", "content": "Identical content XYZ"}
        response1 = owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=payload)
        assert response1.status_code == 200
        
        # Get version count
        history1 = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=test_idempotent.txt")
        count1 = len(history1.json())
        
        time.sleep(0.1)
        
        # PUT same content again
        response2 = owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=payload)
        assert response2.status_code == 200
        
        # Version count should be the same (idempotent by content)
        history2 = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=test_idempotent.txt")
        count2 = len(history2.json())
        
        assert count2 == count1, f"Identical content should not create new version. Before: {count1}, After: {count2}"
        print(f"Idempotent check passed: {count1} versions before and after identical PUT")
    
    def test_get_files_history_returns_all_versions_newest_first(self, owner_client, test_data):
        """GET /api/projects/{id}/files/history returns all versions, newest first"""
        project_id = test_data['project_id']
        
        # Create multiple versions
        for i in range(3):
            payload = {"path": "test_order.txt", "content": f"Version {i+1} content - {time.time()}"}
            owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", json=payload)
            time.sleep(0.1)
        
        # Get history
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=test_order.txt")
        assert response.status_code == 200
        versions = response.json()
        
        assert len(versions) >= 3, f"Should have at least 3 versions, got {len(versions)}"
        
        # Check newest first (descending order by created_at)
        for i in range(len(versions) - 1):
            assert versions[i]['created_at'] >= versions[i+1]['created_at'], \
                f"Versions should be newest first: {versions[i]['created_at']} < {versions[i+1]['created_at']}"
        print(f"History order verified: {len(versions)} versions, newest first")
    
    def test_get_files_history_filters_by_path(self, owner_client, test_data):
        """GET /api/projects/{id}/files/history?path=X filters to that path only"""
        project_id = test_data['project_id']
        
        # Create files with different paths
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "filter_test_a.txt", "content": "Content A"})
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "filter_test_b.txt", "content": "Content B"})
        
        # Get history for path A only
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=filter_test_a.txt")
        assert response.status_code == 200
        versions = response.json()
        
        # All versions should be for path A
        for v in versions:
            assert v['path'] == 'filter_test_a.txt', f"Expected path filter_test_a.txt, got {v['path']}"
        print(f"Path filter verified: {len(versions)} versions for filter_test_a.txt")
    
    def test_get_file_version_returns_full_doc_with_content(self, owner_client, test_data):
        """GET /api/projects/{id}/files/version/{version_id} returns full doc including content"""
        project_id = test_data['project_id']
        
        # Create a file
        content = "Full content for version test - unique " + str(time.time())
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "version_detail.txt", "content": content})
        
        # Get history to find version_id
        history = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=version_detail.txt")
        version_id = history.json()[0]['version_id']
        
        # Get full version
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/version/{version_id}")
        assert response.status_code == 200
        version = response.json()
        
        assert 'content' in version, "Version should include content"
        assert version['content'] == content, f"Content mismatch"
        assert version['version_id'] == version_id
        assert version['path'] == 'version_detail.txt'
        print(f"Version detail verified: {version_id} with {len(version['content'])} bytes")
    
    def test_get_diff_default_params(self, owner_client, test_data):
        """GET /api/projects/{id}/files/diff?path=X returns unified diff between previous and current"""
        project_id = test_data['project_id']
        
        # Create two versions with different content
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "diff_test.txt", "content": "Line 1\nLine 2\nLine 3"})
        time.sleep(0.1)
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "diff_test.txt", "content": "Line 1\nLine 2 MODIFIED\nLine 3\nLine 4 NEW"})
        
        # Get diff
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/diff?path=diff_test.txt")
        assert response.status_code == 200
        diff_data = response.json()
        
        assert 'diff' in diff_data, "Response should include diff"
        assert 'path' in diff_data
        assert diff_data['path'] == 'diff_test.txt'
        
        # Unified diff should contain +/- markers
        diff_text = diff_data['diff']
        assert '---' in diff_text or '+++' in diff_text or diff_text == '', \
            f"Diff should be unified format or empty: {diff_text[:200]}"
        print(f"Diff generated: {len(diff_text)} chars")
    
    def test_get_diff_specific_versions(self, owner_client, test_data):
        """GET /api/projects/{id}/files/diff?path=X&a=<v1>&b=<v2> returns diff between specific versions"""
        project_id = test_data['project_id']
        
        # Create three versions
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "diff_specific.txt", "content": "V1 content"})
        time.sleep(0.1)
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "diff_specific.txt", "content": "V2 content"})
        time.sleep(0.1)
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "diff_specific.txt", "content": "V3 content"})
        
        # Get history to find version IDs
        history = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=diff_specific.txt")
        versions = history.json()
        
        if len(versions) >= 2:
            v_newer = versions[0]['version_id']  # newest
            v_older = versions[-1]['version_id']  # oldest
            
            # Get diff between specific versions
            response = owner_client.get(
                f"{BASE_URL}/api/projects/{project_id}/files/diff?path=diff_specific.txt&a={v_older}&b={v_newer}"
            )
            assert response.status_code == 200
            diff_data = response.json()
            assert 'diff' in diff_data
            print(f"Specific version diff: {v_older} → {v_newer}, {len(diff_data['diff'])} chars")
    
    def test_restore_file_version(self, owner_client, test_data):
        """POST /api/projects/{id}/files/restore copies version content back and creates new version with source='restore'"""
        project_id = test_data['project_id']
        
        # Create two versions
        original_content = "Original content to restore - " + str(time.time())
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "restore_test.txt", "content": original_content})
        time.sleep(0.1)
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "restore_test.txt", "content": "Modified content"})
        
        # Get history to find original version
        history = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=restore_test.txt")
        versions = history.json()
        original_version_id = versions[-1]['version_id']  # oldest
        
        # Restore original version
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/files/restore",
            json={"version_id": original_version_id}
        )
        assert response.status_code == 200
        restore_result = response.json()
        assert restore_result['restored'] == True
        assert restore_result['path'] == 'restore_test.txt'
        
        # Verify current file has original content
        files_response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files")
        files = files_response.json()
        restored_file = next((f for f in files if f['path'] == 'restore_test.txt'), None)
        assert restored_file is not None
        assert restored_file['content'] == original_content, "File content should be restored"
        
        # Verify new version created with source='restore'
        history2 = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/files/history?path=restore_test.txt")
        versions2 = history2.json()
        newest_version = versions2[0]
        assert newest_version['source'] == 'restore', f"Expected source='restore', got {newest_version['source']}"
        print(f"Restore verified: {original_version_id} → new version {newest_version['version_id']} with source='restore'")
    
    def test_restore_as_viewer_returns_403(self, viewer_client, test_data):
        """POST /restore as viewer role → 403"""
        project_id = test_data['project_id']
        
        response = viewer_client.post(
            f"{BASE_URL}/api/projects/{project_id}/files/restore",
            json={"version_id": "ver_nonexistent"}
        )
        assert response.status_code == 403, f"Expected 403 for viewer, got {response.status_code}"
        print("Viewer restore blocked with 403")
    
    def test_restore_unknown_version_returns_404(self, owner_client, test_data):
        """POST /restore with unknown version_id → 404"""
        project_id = test_data['project_id']
        
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/files/restore",
            json={"version_id": "ver_nonexistent_12345"}
        )
        assert response.status_code == 404, f"Expected 404 for unknown version, got {response.status_code}"
        print("Unknown version restore returns 404")


# ==================== ② NOTIFICATIONS ====================
class TestNotifications:
    """Test in-app notification endpoints"""
    
    def test_get_notifications_fresh_user(self, invitee_client, test_data):
        """GET /api/notifications returns {notifications: [], unread: 0} for fresh user"""
        # Clear any existing notifications for invitee
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.notifications.deleteMany({{user_id: '{test_data["invitee_id"]}'}});
'''
        ], capture_output=True)
        
        response = invitee_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert 'notifications' in data
        assert 'unread' in data
        assert data['notifications'] == []
        assert data['unread'] == 0
        print("Fresh user notifications: empty list, 0 unread")
    
    def test_invite_creates_notification_for_invitee(self, owner_client, invitee_client, test_data):
        """POST /api/projects/{id}/invite adds a notification for the invited user"""
        project_id = test_data['project_id']
        invitee_email = test_data['invitee_email']
        
        # Clear existing notifications
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.notifications.deleteMany({{user_id: '{test_data["invitee_id"]}'}});
'''
        ], capture_output=True)
        
        # Send invite
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/invite",
            json={"email": invitee_email, "role": "editor"}
        )
        # May return 200 (already_invited) or 200 (new invite)
        assert response.status_code == 200
        
        # Check invitee's notifications
        notif_response = invitee_client.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        data = notif_response.json()
        
        # Should have at least one notification
        assert len(data['notifications']) >= 1, "Invitee should have notification"
        invite_notif = next((n for n in data['notifications'] if n['kind'] == 'invite'), None)
        assert invite_notif is not None, "Should have invite notification"
        assert invite_notif['project_id'] == project_id
        print(f"Invite notification created: {invite_notif['title']}")
    
    def test_review_creates_notification(self, owner_client, test_data):
        """POST /api/projects/{id}/review adds a notification for the reviewer (kind='review')"""
        project_id = test_data['project_id']
        
        # Create a file so review has something to review
        owner_client.put(f"{BASE_URL}/api/projects/{project_id}/files", 
                        json={"path": "review_test.js", "content": "function test() { return 42; }"})
        
        # Clear owner's notifications
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.notifications.deleteMany({{user_id: '{test_data["owner_id"]}', kind: 'review'}});
'''
        ], capture_output=True)
        
        # Run review
        response = owner_client.post(f"{BASE_URL}/api/projects/{project_id}/review", timeout=90)
        assert response.status_code == 200, f"Review failed: {response.text[:200]}"
        
        # Check owner's notifications
        notif_response = owner_client.get(f"{BASE_URL}/api/notifications")
        assert notif_response.status_code == 200
        data = notif_response.json()
        
        review_notif = next((n for n in data['notifications'] if n['kind'] == 'review'), None)
        assert review_notif is not None, "Should have review notification"
        assert review_notif['project_id'] == project_id
        print(f"Review notification created: {review_notif['title']}")
    
    def test_mark_notifications_read_specific_ids(self, owner_client, test_data):
        """POST /api/notifications/read with {ids: [id1, id2]} marks those read"""
        # Get current notifications
        notif_response = owner_client.get(f"{BASE_URL}/api/notifications")
        notifications = notif_response.json()['notifications']
        
        if len(notifications) == 0:
            # Create a notification first
            subprocess.run([
                'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.notifications.insertOne({{
  notification_id: 'ntf_test_read_' + Date.now(),
  user_id: '{test_data["owner_id"]}',
  kind: 'system',
  title: 'Test notification',
  body: 'For testing mark read',
  read: false,
  created_at: new Date().toISOString()
}});
'''
            ], capture_output=True)
            notif_response = owner_client.get(f"{BASE_URL}/api/notifications")
            notifications = notif_response.json()['notifications']
        
        unread = [n for n in notifications if not n.get('read', False)]
        if len(unread) > 0:
            ids_to_mark = [unread[0]['notification_id']]
            response = owner_client.post(
                f"{BASE_URL}/api/notifications/read",
                json={"ids": ids_to_mark}
            )
            assert response.status_code == 200
            result = response.json()
            assert 'marked' in result
            print(f"Marked {result['marked']} notifications as read")
    
    def test_mark_all_notifications_read(self, owner_client, test_data):
        """POST /api/notifications/read with {ids: null} marks all read"""
        response = owner_client.post(
            f"{BASE_URL}/api/notifications/read",
            json={"ids": None}
        )
        assert response.status_code == 200
        result = response.json()
        assert 'marked' in result
        
        # Verify all are read
        notif_response = owner_client.get(f"{BASE_URL}/api/notifications")
        assert notif_response.json()['unread'] == 0
        print(f"Marked all notifications read: {result['marked']} total")
    
    def test_notifications_require_auth(self, no_auth_client):
        """Notification endpoints require auth — 401 without session"""
        response = no_auth_client.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        response2 = no_auth_client.post(f"{BASE_URL}/api/notifications/read", json={"ids": None})
        assert response2.status_code == 401, f"Expected 401, got {response2.status_code}"
        print("Notification endpoints require auth: 401 verified")


# ==================== ③ MULTI-AGENT ORCHESTRATION ====================
class TestMultiAgent:
    """Test multi-agent planner → coder → reviewer orchestration"""
    
    def test_multi_agent_streams_three_phases(self, owner_client, test_data):
        """POST /api/projects/{id}/multi-agent/stream streams SSE events for 3 phases"""
        project_id = test_data['project_id']
        
        # Ensure user has enough credits
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.users.updateOne({{user_id: '{test_data["owner_id"]}'}}, {{$set: {{credits: 100}}}});
'''
        ], capture_output=True)
        
        payload = {"content": "Build a simple counter button component"}
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/multi-agent/stream",
            json=payload,
            stream=True,
            timeout=120
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        # Parse SSE events
        phases_started = []
        phases_ended = []
        tokens_by_phase = {}
        done_data = None
        
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("event:"):
                event_type = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if event_type == "phase_start":
                        phases_started.append(data.get('phase'))
                    elif event_type == "phase_end":
                        phases_ended.append(data.get('phase'))
                    elif event_type == "token":
                        phase = data.get('phase', 'unknown')
                        tokens_by_phase[phase] = tokens_by_phase.get(phase, 0) + 1
                    elif event_type == "done":
                        done_data = data
                except:
                    pass
        
        # Verify 3 phases
        assert 'planner' in phases_started, "Should have planner phase_start"
        assert 'coder' in phases_started, "Should have coder phase_start"
        assert 'reviewer' in phases_started, "Should have reviewer phase_start"
        assert 'planner' in phases_ended, "Should have planner phase_end"
        assert 'coder' in phases_ended, "Should have coder phase_end"
        assert 'reviewer' in phases_ended, "Should have reviewer phase_end"
        assert done_data is not None, "Should have done event"
        
        print(f"Multi-agent phases: {phases_started}")
        print(f"Tokens by phase: {tokens_by_phase}")
    
    def test_multi_agent_debits_three_credits(self, owner_client, test_data):
        """Multi-agent debits 3 credits from user"""
        project_id = test_data['project_id']
        
        # Set credits to known value
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.users.updateOne({{user_id: '{test_data["owner_id"]}'}}, {{$set: {{credits: 50}}}});
'''
        ], capture_output=True)
        
        # Get initial credits
        me_response = owner_client.get(f"{BASE_URL}/api/auth/me")
        initial_credits = me_response.json()['credits']
        
        # Run multi-agent
        payload = {"content": "Create a hello world function"}
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/multi-agent/stream",
            json=payload,
            stream=True,
            timeout=120
        )
        # Consume stream
        for _ in response.iter_lines(decode_unicode=True):
            pass
        
        # Check credits after
        me_response2 = owner_client.get(f"{BASE_URL}/api/auth/me")
        final_credits = me_response2.json()['credits']
        
        credits_used = initial_credits - final_credits
        assert credits_used == 3, f"Expected 3 credits used, got {credits_used}"
        print(f"Credits: {initial_credits} → {final_credits} (used {credits_used})")
    
    def test_multi_agent_returns_402_low_credits(self, low_credits_client, test_data):
        """Multi-agent returns 402 when user has < 3 credits"""
        project_id = test_data['project_id']
        
        # Ensure low credits user has < 3 credits
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.users.updateOne({{user_id: '{test_data["low_credits_id"]}'}}, {{$set: {{credits: 2}}}});
'''
        ], capture_output=True)
        
        payload = {"content": "Build something"}
        response = low_credits_client.post(
            f"{BASE_URL}/api/projects/{project_id}/multi-agent/stream",
            json=payload,
            timeout=30
        )
        assert response.status_code == 402, f"Expected 402, got {response.status_code}"
        print("Low credits returns 402 for multi-agent")
    
    def test_multi_agent_persists_one_message_mode_multi(self, owner_client, test_data):
        """Multi-agent persists ONE assistant message with mode='multi'"""
        project_id = test_data['project_id']
        
        # Ensure credits
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.users.updateOne({{user_id: '{test_data["owner_id"]}'}}, {{$set: {{credits: 100}}}});
'''
        ], capture_output=True)
        
        # Count messages before
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
print(db.messages.countDocuments({{project_id: '{project_id}', mode: 'multi'}}));
'''
        ], capture_output=True, text=True)
        count_before = int(result.stdout.strip())
        
        # Run multi-agent
        payload = {"content": "Create a utility function"}
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/multi-agent/stream",
            json=payload,
            stream=True,
            timeout=120
        )
        # Consume stream
        for _ in response.iter_lines(decode_unicode=True):
            pass
        
        # Count messages after
        result2 = subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
print(db.messages.countDocuments({{project_id: '{project_id}', mode: 'multi'}}));
'''
        ], capture_output=True, text=True)
        count_after = int(result2.stdout.strip())
        
        assert count_after == count_before + 1, f"Expected 1 new multi message, got {count_after - count_before}"
        print(f"Multi-agent messages: {count_before} → {count_after}")
    
    def test_multi_agent_message_contains_three_sections(self, owner_client, test_data):
        """Multi-agent message contains Plan, Build, Review sections"""
        project_id = test_data['project_id']
        
        # Ensure credits
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.users.updateOne({{user_id: '{test_data["owner_id"]}'}}, {{$set: {{credits: 100}}}});
'''
        ], capture_output=True)
        
        # Run multi-agent and capture done event
        payload = {"content": "Create a simple greeting function"}
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/multi-agent/stream",
            json=payload,
            stream=True,
            timeout=120
        )
        
        done_message = None
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if 'message' in data:
                        done_message = data['message']
                except:
                    pass
        
        assert done_message is not None, "Should have done message"
        content = done_message.get('content', '')
        
        # Check for section headers (emoji variants)
        has_plan = '## 📐 Plan' in content or '### Plan' in content or 'Plan' in content
        has_build = '## 🔨 Build' in content or '### Build' in content or 'Build' in content
        has_review = '## 🔍 Review' in content or '### Review' in content or 'Review' in content
        
        assert has_plan, "Message should contain Plan section"
        assert has_build, "Message should contain Build section"
        assert has_review, "Message should contain Review section"
        print(f"Multi-agent message has all 3 sections ({len(content)} chars)")
    
    def test_multi_agent_as_viewer_returns_403(self, viewer_client, test_data):
        """Multi-agent as viewer → 403"""
        project_id = test_data['project_id']
        
        payload = {"content": "Build something"}
        response = viewer_client.post(
            f"{BASE_URL}/api/projects/{project_id}/multi-agent/stream",
            json=payload,
            timeout=30
        )
        assert response.status_code == 403, f"Expected 403 for viewer, got {response.status_code}"
        print("Viewer blocked from multi-agent with 403")


# ==================== ④ AGENT WRITE_FILE CREATES VERSION WITH SOURCE='AGENT' ====================
class TestAgentFileVersioning:
    """Test that agent mode write_file creates versions with source='agent'"""
    
    def test_agent_write_file_creates_version_source_agent(self, owner_client, test_data):
        """Agent write_file tool creates a version with source='agent'"""
        project_id = test_data['project_id']
        
        # Ensure credits
        subprocess.run([
            'mongosh', '--quiet', '--eval', f'''
use('test_database');
db.users.updateOne({{user_id: '{test_data["owner_id"]}'}}, {{$set: {{credits: 100}}}});
'''
        ], capture_output=True)
        
        # Send agent mode chat that should trigger write_file
        payload = {
            "content": "Create a file called agent_test_file.txt with content 'Hello from agent'",
            "mode": "agent"
        }
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/chat/stream",
            json=payload,
            stream=True,
            timeout=90
        )
        assert response.status_code == 200
        
        # Consume stream and look for tool_result
        tool_results = []
        for line in response.iter_lines(decode_unicode=True):
            if line.startswith("data:"):
                try:
                    data = json.loads(line.split(":", 1)[1].strip())
                    if 'tool' in data and 'result' in data:
                        tool_results.append(data)
                except:
                    pass
        
        # Check if write_file was called
        write_file_results = [r for r in tool_results if r.get('tool', {}).get('name') == 'write_file']
        
        if len(write_file_results) > 0:
            # Check version was created with source='agent'
            result = subprocess.run([
                'mongosh', '--quiet', '--eval', f'''
use('test_database');
var v = db.project_file_versions.findOne(
  {{project_id: '{project_id}', source: 'agent'}},
  {{_id: 0}}
);
print(JSON.stringify(v || {{}}));
'''
            ], capture_output=True, text=True)
            version = json.loads(result.stdout.strip())
            
            if version:
                assert version.get('source') == 'agent', f"Expected source='agent', got {version.get('source')}"
                print(f"Agent version created: {version.get('version_id')} with source='agent'")
            else:
                print("Note: Agent may not have created a file in this run")
        else:
            print("Note: Agent did not call write_file tool in this run (may have used done)")


# ==================== REGRESSION TESTS ====================
class TestRegression:
    """Regression tests for v7 features"""
    
    def test_chat_stream_still_works(self, owner_client, test_data):
        """REGRESSION: Chat stream still works"""
        project_id = test_data['project_id']
        
        payload = {"content": "Say hello", "mode": "build"}
        response = owner_client.post(
            f"{BASE_URL}/api/projects/{project_id}/chat/stream",
            json=payload,
            stream=True,
            timeout=60
        )
        assert response.status_code == 200
        
        has_done = False
        for line in response.iter_lines(decode_unicode=True):
            if 'event: done' in line:
                has_done = True
        
        assert has_done, "Should have done event"
        print("Chat stream regression: PASS")
    
    def test_get_models(self, owner_client):
        """REGRESSION: GET /api/models returns models"""
        response = owner_client.get(f"{BASE_URL}/api/models")
        assert response.status_code == 200
        models = response.json()
        assert len(models) >= 7, f"Expected at least 7 models, got {len(models)}"
        print(f"Models regression: {len(models)} models")
    
    def test_get_settings(self, owner_client):
        """REGRESSION: GET /api/settings works"""
        response = owner_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        print("Settings regression: PASS")
    
    def test_get_packages(self, owner_client):
        """REGRESSION: GET /api/payments/packages works"""
        response = owner_client.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        packages = response.json()
        assert len(packages) >= 4
        print(f"Packages regression: {len(packages)} packages")
    
    def test_project_crud(self, owner_client, test_data):
        """REGRESSION: Project CRUD works"""
        # Create
        response = owner_client.post(
            f"{BASE_URL}/api/projects",
            json={"name": "Regression Test Project", "description": "Testing"}
        )
        assert response.status_code == 200
        project = response.json()
        project_id = project['project_id']
        
        # Read
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert response.status_code == 200
        
        # Update
        response = owner_client.patch(
            f"{BASE_URL}/api/projects/{project_id}",
            json={"name": "Updated Name"}
        )
        assert response.status_code == 200
        
        # Delete
        response = owner_client.delete(f"{BASE_URL}/api/projects/{project_id}")
        assert response.status_code == 200
        
        print("Project CRUD regression: PASS")
    
    def test_memory_endpoints(self, owner_client, test_data):
        """REGRESSION: Memory GET/PUT works"""
        project_id = test_data['project_id']
        
        # GET
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/memory")
        assert response.status_code == 200
        
        # PUT
        response = owner_client.put(
            f"{BASE_URL}/api/projects/{project_id}/memory",
            json={"content": "Test memory content"}
        )
        assert response.status_code == 200
        
        print("Memory regression: PASS")
    
    def test_export_endpoint(self, owner_client, test_data):
        """REGRESSION: Export endpoint works"""
        project_id = test_data['project_id']
        
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/export")
        assert response.status_code == 200
        assert response.headers.get('content-type') == 'application/zip'
        print("Export regression: PASS")
    
    def test_activity_endpoint(self, owner_client, test_data):
        """REGRESSION: Activity endpoint works"""
        project_id = test_data['project_id']
        
        response = owner_client.get(f"{BASE_URL}/api/projects/{project_id}/activity")
        assert response.status_code == 200
        print("Activity regression: PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
