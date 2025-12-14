// Admin Users Management

let currentUserId = null;

// Edit user
function editUser(userId) {
    currentUserId = userId;
    const row = document.querySelector(`tr[data-user-id="${userId}"]`);
    
    const username = row.querySelector('[data-field="username"]').textContent;
    const displayName = row.querySelector('[data-field="displayName"]').textContent;
    const email = row.querySelector('[data-field="email"]').textContent;
    const role = row.cells[3].textContent;
    
    document.getElementById('editUsername').value = username;
    document.getElementById('editDisplayName').value = displayName;
    document.getElementById('editEmail').value = email;
    document.getElementById('editRole').value = role;
    
    document.getElementById('editUserModal').style.display = 'block';
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.querySelector(`tr[data-user-id="${userId}"]`).remove();
            alert('User deleted successfully');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Delete user error:', error);
        alert('Failed to delete user');
    }
}

// Close modal
function closeModal() {
    document.getElementById('editUserModal').style.display = 'none';
    currentUserId = null;
}

// Handle form submission
document.getElementById('editUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!currentUserId) return;
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch(`/admin/users/${currentUserId}/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: data.username,
                displayName: data.displayName,
                email: data.email
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            alert('Error: ' + result.error);
            return;
        }
        
        const row = document.querySelector(`tr[data-user-id="${currentUserId}"]`);
        const currentRole = row.cells[3].textContent;
        
        if (data.role !== currentRole) {
            const roleResponse = await fetch(`/admin/users/${currentUserId}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: data.role })
            });
            
            const roleResult = await roleResponse.json();
            
            if (!roleResult.success) {
                alert('User info updated but role change failed: ' + roleResult.error);
                return;
            }
        }
        
        row.querySelector('[data-field="username"]').textContent = data.username;
        row.querySelector('[data-field="displayName"]').textContent = data.displayName;
        row.querySelector('[data-field="email"]').textContent = data.email;
        row.cells[3].textContent = data.role;
        
        closeModal();
        alert('User updated successfully');
        
        if (data.role !== currentRole) {
            location.reload();
        }
    } catch (error) {
        console.error('Edit user error:', error);
        alert('Failed to update user');
    }
});

// Close modal when clicking outside
window.addEventListener('click', function(e) {
    const modal = document.getElementById('editUserModal');
    if (e.target === modal) {
        closeModal();
    }
});