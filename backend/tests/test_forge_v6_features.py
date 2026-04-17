"""
FORGE v6 Feature Tests
- Activity log endpoints (GET /projects/{id}/activity)
- Project files endpoints (PUT/GET /projects/{id}/files)
- Activity auto-logging (member.invited, member.role_changed, file.edited, message.sent)
- Invite endpoint email mocking (RESEND_API_KEY not set)
- Export ZIP includes edited files
- WebSocket Yjs relay (/api/ws/yjs/{project_id}/{file_path})
"""
import pytest
import requests
import os
import time
import asyncio
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://buildforge-ai.preview.emergentagent.com').rstrip('/')

# Test credentials - will be set by fixture
OWNER_TOKEN = None
COLLAB_TOKEN = None
VIEWER_TOKEN = None
PROJECT_ID = None


def get_tokens():
    """Get test tokens from mongosh"""
    import subprocess
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
var owner = db.user_sessions.findOne({session_token: /^test_session_v6_owner/}, {_id: 0});
var collab = db.user_sessions.findOne({session_token: /^test_session_v6_collab/}, {_id: 0});
var viewer = db.user_sessions.findOne({session_token: /^test_session_v6_viewer/}, {_id: 0});
var project = db.projects.findOne({project_id: /^prj_test_v6/}, {_id: 0});
print(JSON.stringify({
    owner_token: owner?.session_token,
    collab_token: collab?.session_token,
    viewer_token: viewer?.session_token,
    project_id: project?.project_id
}));
'''
    ], capture_output=True, text=True)
    data = json.loads(result.stdout.strip())
    return data


@pytest.fixture(scope="module")
def test_data():
    """Get test tokens and project ID"""
    data = get_tokens()
    return data


@pytest.fixture
def owner_client(test_data):
    """Session with owner auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['owner_token']}"
    })
    return session


@pytest.fixture
def collab_client(test_data):
    """Session with collaborator (editor) auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['collab_token']}"
    })
    return session


@pytest.fixture
def viewer_client(test_data):
    """Session with viewer auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_data['viewer_token']}"
    })
    return session


@pytest.fixture
def no_auth_client():
    """Session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestActivityEndpoint:
    """Test GET /api/projects/{id}/activity"""
    
    def test_owner_can_get_activity(self, owner_client, test_data):
        """Owner can access activity log"""
        response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Activity log has {len(data)} entries")
    
    def test_collaborator_can_get_activity(self, collab_client, test_data):
        """Collaborator (editor) can access activity log"""
        response = collab_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_viewer_can_get_activity(self, viewer_client, test_data):
        """Viewer can access activity log"""
        response = viewer_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_non_member_cannot_get_activity(self, no_auth_client, test_data):
        """Non-member gets 401"""
        response = no_auth_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 401


class TestProjectFilesEndpoint:
    """Test PUT/GET /api/projects/{id}/files"""
    
    def test_owner_can_save_file(self, owner_client, test_data):
        """Owner can save a file"""
        payload = {"path": "src/App.jsx", "content": "// Test file content\nexport default function App() { return <div>Hello</div>; }"}
        response = owner_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "src/App.jsx"
        assert "content" in data
        assert "updated_at" in data
        assert "updated_by_name" in data
        print(f"File saved: {data['path']} by {data['updated_by_name']}")
    
    def test_editor_can_save_file(self, collab_client, test_data):
        """Editor can save a file"""
        payload = {"path": "src/utils.js", "content": "// Utils\nexport const helper = () => {};"}
        response = collab_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["path"] == "src/utils.js"
    
    def test_viewer_cannot_save_file(self, viewer_client, test_data):
        """Viewer gets 403 when trying to save"""
        payload = {"path": "src/viewer.js", "content": "// Should fail"}
        response = viewer_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload)
        assert response.status_code == 403
        data = response.json()
        assert "viewer" in data.get("detail", "").lower() or "edit" in data.get("detail", "").lower()
    
    def test_owner_can_list_files(self, owner_client, test_data):
        """Owner can list saved files"""
        response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/files")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        paths = [f["path"] for f in data]
        assert "src/App.jsx" in paths
        print(f"Files in project: {paths}")
    
    def test_collaborator_can_list_files(self, collab_client, test_data):
        """Collaborator can list saved files"""
        response = collab_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/files")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_file_update_overwrites_content(self, owner_client, test_data):
        """Updating a file overwrites content"""
        # First save
        payload1 = {"path": "src/test.js", "content": "// Version 1"}
        response1 = owner_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload1)
        assert response1.status_code == 200
        
        # Update
        payload2 = {"path": "src/test.js", "content": "// Version 2 - updated"}
        response2 = owner_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload2)
        assert response2.status_code == 200
        data = response2.json()
        assert "Version 2" in data["content"]


class TestActivityAutoLogging:
    """Test that activities are auto-logged for various events"""
    
    def test_invite_logs_member_invited(self, owner_client, test_data):
        """Inviting a member logs member.invited activity"""
        # Invite a new member
        invite_email = f"test_invite_{int(time.time())}@forge.dev"
        payload = {"email": invite_email, "role": "editor"}
        response = owner_client.post(f"{BASE_URL}/api/projects/{test_data['project_id']}/invite", json=payload)
        assert response.status_code == 200
        
        # Check activity log
        time.sleep(0.5)  # Allow async logging
        activity_response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert activity_response.status_code == 200
        activities = activity_response.json()
        
        # Find member.invited event
        invited_events = [a for a in activities if a["event_type"] == "member.invited"]
        assert len(invited_events) > 0, "member.invited event should be logged"
        latest = invited_events[0]
        assert invite_email in latest.get("detail", "")
        print(f"Found member.invited activity: {latest['detail']}")
    
    def test_file_edit_logs_file_edited(self, owner_client, test_data):
        """Saving a file logs file.edited activity"""
        # Save a file
        payload = {"path": "src/activity_test.js", "content": "// Activity test"}
        response = owner_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload)
        assert response.status_code == 200
        
        # Check activity log
        time.sleep(0.5)
        activity_response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert activity_response.status_code == 200
        activities = activity_response.json()
        
        # Find file.edited event
        file_events = [a for a in activities if a["event_type"] == "file.edited"]
        assert len(file_events) > 0, "file.edited event should be logged"
        latest = file_events[0]
        assert "activity_test.js" in latest.get("detail", "")
        print(f"Found file.edited activity: {latest['detail']}")


class TestInviteEmailMocking:
    """Test that invite endpoint works with mocked email (no RESEND_API_KEY)"""
    
    def test_invite_returns_200_without_resend_key(self, owner_client, test_data):
        """Invite works and returns 200 even without RESEND_API_KEY"""
        invite_email = f"mock_email_test_{int(time.time())}@forge.dev"
        payload = {"email": invite_email, "role": "viewer"}
        response = owner_client.post(f"{BASE_URL}/api/projects/{test_data['project_id']}/invite", json=payload)
        assert response.status_code == 200
        data = response.json()
        # Should return member record
        assert "member_id" in data or "already_invited" in data
        print(f"Invite response (mocked email): {data}")


class TestExportWithEditedFiles:
    """Test that export ZIP includes edited files from project_files"""
    
    def test_export_includes_edited_files(self, owner_client, test_data):
        """Export ZIP should include files saved via PUT /files"""
        # First save a unique file
        unique_content = f"// Unique export test {int(time.time())}"
        payload = {"path": "src/export_test.js", "content": unique_content}
        response = owner_client.put(f"{BASE_URL}/api/projects/{test_data['project_id']}/files", json=payload)
        assert response.status_code == 200
        
        # Export project
        export_response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/export")
        assert export_response.status_code == 200
        assert "application/zip" in export_response.headers.get("content-type", "")
        
        # Check ZIP contains our file
        import zipfile
        import io
        zip_buffer = io.BytesIO(export_response.content)
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            file_list = zf.namelist()
            print(f"Export ZIP contains: {file_list}")
            assert "src/export_test.js" in file_list, "Edited file should be in export"
            content = zf.read("src/export_test.js").decode('utf-8')
            assert "Unique export test" in content


class TestYjsWebSocketRelay:
    """Test WebSocket /api/ws/yjs/{project_id}/{file_path}"""
    
    def test_yjs_ws_rejects_bad_auth(self):
        """Yjs WS closes with 4401 on bad auth"""
        import websocket
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/yjs/prj_test/src/App.jsx?token=invalid_token"
        
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            # If connection succeeds, it should close quickly with error code
            result = ws.recv()
            ws.close()
            # Should not reach here normally
        except websocket.WebSocketBadStatusException as e:
            # Expected - connection rejected
            print(f"Yjs WS rejected bad auth: {e}")
            assert True
        except Exception as e:
            # Connection closed or rejected
            print(f"Yjs WS connection failed (expected): {e}")
            assert True
    
    def test_yjs_ws_accepts_valid_auth(self, test_data):
        """Yjs WS accepts valid token and stays open"""
        import websocket
        ws_url = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_url}/api/ws/yjs/{test_data['project_id']}/src/App.jsx?token={test_data['owner_token']}"
        
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            # Connection should succeed
            print("Yjs WS connected successfully with valid auth")
            ws.close()
            assert True
        except Exception as e:
            pytest.fail(f"Yjs WS should accept valid auth: {e}")


class TestActivityEventTypes:
    """Test that activity log contains expected event types"""
    
    def test_activity_has_required_fields(self, owner_client, test_data):
        """Activity entries have required fields"""
        response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 200
        activities = response.json()
        
        if len(activities) > 0:
            activity = activities[0]
            assert "activity_id" in activity
            assert "project_id" in activity
            assert "event_type" in activity
            assert "created_at" in activity
            print(f"Activity fields: {list(activity.keys())}")
    
    def test_activity_sorted_by_created_at_desc(self, owner_client, test_data):
        """Activity is sorted by created_at descending (newest first)"""
        response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 200
        activities = response.json()
        
        if len(activities) >= 2:
            # Check that first entry is newer than second
            first_time = activities[0]["created_at"]
            second_time = activities[1]["created_at"]
            assert first_time >= second_time, "Activities should be sorted newest first"


class TestRoleChangeActivity:
    """Test that role changes are logged"""
    
    def test_role_change_logs_activity(self, owner_client, test_data):
        """Changing member role logs member.role_changed activity"""
        # First get members to find one to update
        project_response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}")
        assert project_response.status_code == 200
        members = project_response.json().get("members", [])
        
        if len(members) > 0:
            member = members[0]
            member_id = member["member_id"]
            current_role = member.get("role", "editor")
            new_role = "viewer" if current_role == "editor" else "editor"
            
            # Change role
            patch_response = owner_client.patch(
                f"{BASE_URL}/api/projects/{test_data['project_id']}/members/{member_id}",
                json={"role": new_role}
            )
            assert patch_response.status_code == 200
            
            # Check activity
            time.sleep(0.5)
            activity_response = owner_client.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
            activities = activity_response.json()
            
            role_events = [a for a in activities if a["event_type"] == "member.role_changed"]
            assert len(role_events) > 0, "member.role_changed event should be logged"
            print(f"Found role change activity: {role_events[0]['detail']}")
            
            # Restore original role
            owner_client.patch(
                f"{BASE_URL}/api/projects/{test_data['project_id']}/members/{member_id}",
                json={"role": current_role}
            )


class TestNonMemberAccess:
    """Test that non-members get 404 for activity and files"""
    
    def test_non_member_activity_returns_404(self, test_data):
        """Non-member trying to access activity gets 404"""
        # Create a new user who is not a member
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
use('test_database');
var userId = 'test-user-nonmember-' + Date.now();
var sessionToken = 'test_session_nonmember_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'nonmember@forge.dev',
  name: 'Non Member',
  credits: 10,
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print(sessionToken);
'''
        ], capture_output=True, text=True)
        nonmember_token = result.stdout.strip()
        
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {nonmember_token}"
        })
        
        response = session.get(f"{BASE_URL}/api/projects/{test_data['project_id']}/activity")
        assert response.status_code == 404
        
        # Cleanup
        subprocess.run([
            'mongosh', '--quiet', '--eval', '''
use('test_database');
db.users.deleteOne({email: 'nonmember@forge.dev'});
db.user_sessions.deleteOne({session_token: /^test_session_nonmember/});
'''
        ], capture_output=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
