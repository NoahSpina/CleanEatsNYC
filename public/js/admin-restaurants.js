let currentRestaurantId = null;

function showAddRestaurant() {
    document.getElementById('addRestaurantModal').style.display = 'block';
}

function editRestaurant(restaurantId) {
    currentRestaurantId = restaurantId;
    const row = document.querySelector(`tr[data-restaurant-id="${restaurantId}"]`);
    const cells = row.querySelectorAll('td');
    const addressParts = cells[3].textContent.split(', ');
    const streetParts = addressParts[0].split(' ');
    
    document.getElementById('editName').value = cells[0].textContent;
    document.getElementById('editBorough').value = cells[1].textContent.toUpperCase();
    document.getElementById('editCuisine').value = cells[2].textContent;
    document.getElementById('editBuilding').value = streetParts[0];
    document.getElementById('editStreet').value = streetParts.slice(1).join(' ');
    document.getElementById('editZipcode').value = addressParts[1] || '';
    document.getElementById('editRestaurantModal').style.display = 'block';
}

async function deleteRestaurant(restaurantId) {
    if (!confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`/admin/restaurants/${restaurantId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
            document.querySelector(`tr[data-restaurant-id="${restaurantId}"]`).remove();
            alert('Restaurant deleted successfully');
            window.location.reload();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Delete restaurant error:', error);
        alert('Failed to delete restaurant');
    }
}

function closeModal() {
    document.getElementById('addRestaurantModal').style.display = 'none';
    document.getElementById('editRestaurantModal').style.display = 'none';
    currentRestaurantId = null;
}

document.getElementById('addRestaurantForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(this));
    try {
        const response = await fetch('/admin/restaurants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            closeModal();
            alert('Restaurant added successfully');
            location.reload();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Add restaurant error:', error);
        alert('Failed to add restaurant');
    }
});

document.getElementById('editRestaurantForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentRestaurantId) return;
    const data = Object.fromEntries(new FormData(this));
    try {
        const response = await fetch(`/admin/restaurants/${currentRestaurantId}/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            const row = document.querySelector(`tr[data-restaurant-id="${currentRestaurantId}"]`);
            const cells = row.querySelectorAll('td');
            cells[0].textContent = data.name;
            cells[1].textContent = data.borough.toLowerCase();
            cells[2].textContent = data.cuisine;
            cells[3].textContent = `${data.building} ${data.street}, ${data.zipcode}`;
            closeModal();
            alert('Restaurant updated successfully');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Edit restaurant error:', error);
        alert('Failed to update restaurant');
    }
});

window.addEventListener('click', function(e) {
    const addModal = document.getElementById('addRestaurantModal');
    const editModal = document.getElementById('editRestaurantModal');
    if (e.target === addModal || e.target === editModal) closeModal();
});