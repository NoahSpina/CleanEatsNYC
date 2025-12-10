(function($) {
    function bindEventsToFavoriteButton(btn) {
        btn.on('click', function(event) {
            event.preventDefault();
            const currentBtn = $(this);
            const restaurantId = currentBtn.data('id');

            if (!restaurantId) return;

            const isFavorited = currentBtn.hasClass('favorited');
            const method = isFavorited ? 'DELETE' : 'POST';
            
            const requestConfig = {
                method: method,
                url: `/favorite/${restaurantId}`
            };

            $.ajax(requestConfig).then(function(response) {
                if (response.success) {
                    currentBtn.toggleClass('favorited');
                } else if (response.error) {
                    alert(response.error);
                }
            }).catch(function(error) {
                console.error('Error:', error);
                if (error.status === 401 || error.status === 403) {
                     window.location.href = '/login';
                }
            });
        });
    }

    // bind to existing buttons on load
    $(document).ready(function() {
        bindEventsToFavoriteButton($('.restaurant-favorite'));
    });

    // this causes the page to reload after a user clicks the back button.
    // needed for when user clicks favorite button on restaurant/:id page and then hits back.
    // https://developer.mozilla.org/en-US/docs/Web/API/PageTransitionEvent/persisted
    window.addEventListener('pageshow', function(event) {
        // basically asks server to send page again
        if (event.persisted) {
            window.location.reload();
        }
    });

})(window.jQuery);
