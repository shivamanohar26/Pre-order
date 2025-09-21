// // Wait until page is loaded
// document.addEventListener("DOMContentLoaded", () => {
    
//     const searchInput = document.getElementById("searchInput");
//     const restaurantCards = document.querySelectorAll(".restaurant-card");

//     // 🔍 Search Filter
//     searchInput.addEventListener("keyup", () => {
//         let filter = searchInput.value.toLowerCase();

//         restaurantCards.forEach(card => {
//             let name = card.querySelector("h3").textContent.toLowerCase();
//             if (name.includes(filter)) {
//                 card.style.display = "block";
//             } else {
//                 card.style.display = "none";
//             }
//         });
//     });

//     // 🍔 Restaurant Selection (dummy action for now)
//     restaurantCards.forEach(card => {
//         card.addEventListener("click", () => {
//             let name = card.querySelector("h3").textContent;
//             alert(`You selected ${name}! (Later this will redirect to menu page)`);
//         });
//     });
// });
// api key
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nearby Restaurants</title>
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDT8BI2FGUm3R69foATdZO_dEFJDBvyq5k&libraries=places"></script>
  <style>
    #map { height: 400px; width: 100%; }
  </style>
</head>
<body>
  <h1>Find Nearby Restaurants 🍴</h1>
  <div id="map"></div>
  
  <script>
    function initMap() {
      // Center map at your city (example: Hyderabad)
      const center = { lat: 17.3850, lng: 78.4867 };

      const map = new google.maps.Map(document.getElementById("map"), {
        center: center,
        zoom: 14,
      });

      const service = new google.maps.places.PlacesService(map);

      // Search for nearby restaurants
      service.nearbySearch(
        {
          location: center,
          radius: 2000, // 2km range
          type: ["restaurant"]
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            results.forEach(place => {
              new google.maps.Marker({
                position: place.geometry.location,
                map,
                title: place.name,
              });
            });
          }
        }
      );
    }

    // Run when page loads
    window.onload = initMap;
  </script>
</body>
</html>
