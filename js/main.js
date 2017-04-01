var state = {
  position: {
    marker: null,
    updated: null
  }
};

//global variables to store the user's current location
var latitude, longitude;

//the mapzen key
var mapzenKey = 'mapzen-qJmfq5U';

//a global variable to store returned autocomplete data from the mapzen autocomplete API
var autocompleteData;

//a global varible to store place objects based on user's input
//each object contains the place name and the location
//these places are generated from autocomplete API call
var places = [];

//a global variable to store any markers that are plotted on the map
//it could be all destinations based on user input
//it could be the actual destination selected by the user
var layerPlottedMarkers = [];

//a global variable that store the line route
var layerRoute = [];

/* We'll use underscore's `once` function to make sure this only happens
 *  one time even if weupdate the position later
 */
var goToOrigin = _.once(function(lat, lng) {
  map.flyTo([lat, lng], 14);
});


/* Given a lat and a long, we should create a marker, store it
 *  somewhere, and add it to the map
 */
var updatePosition = function(lat, lng, updated) {
  if (state.position.marker) { map.removeLayer(state.position.marker); }
  state.position.marker = L.circleMarker([lat, lng], {color: "blue"});
  state.position.updated = updated;
  state.position.marker.addTo(map);
  goToOrigin(lat, lng);
};

//
var DesLoc = function(input){
  if(input.length !== 0){
    //construct the uri for mapzen autocomplte api call
    var uri = "https://search.mapzen.com/v1/autocomplete?focus.point.lat=" + latitude + "&focus.point.lon=" + longitude + "&text=" + input + "&api_key" + mapzenKey;
    $.ajax(uri).done(function(data){
      autocompleteData = data;//the returned places from the API is passed to the global variable, which will be then passed to jquery's autocomplete box
    })
  }
}

// a throttled version of the above function
// so that the api call will not exceed the request limit set by mapzen
var throttledDesLoc = _.throttle(DesLoc, 2000);

// pluck all place names from the paramter passed to this function,
// populate the jquery's autocomplete box
var jqueryAutocomplete = function(items){
  $('#dest').autocomplete({
    source: _.pluck(items, 'name')
  })
}

var clearMarkers = function(markers){
  _.each(markers, function(marker){
    map.removeLayer(marker);
  })
}

var findRoute = function(desCoor){
  var json = {
    "locations":[
      {
        "lat": latitude,
        "lon": longitude
      },
      {
        "lat": desCoor.location[1],
        "lon": desCoor.location[0]
      }
    ],
    "costing": "auto",
    "directions_options": {
      "units": "miles"
    }
  }
  var uri = "https://matrix.mapzen.com/optimized_route?json=" + JSON.stringify(json) + "&api_key="+mapzenKey;

  $.ajax(uri).done(function(data){
    var tripShape = decode(data.trip.legs[0].shape);
    var coords = [[latitude, longitude]].concat(tripShape).concat([[desCoor.location[1], desCoor.location[0]]]);
    console.log(coords)
    layerRoute = [L.polyline(coords).addTo(map)];
    map.fitBounds(layerRoute[0].getBounds());
  })
}

var plotOneMarker = function(place){
  return L.circleMarker([place.location[1], place.location[0]], {color: "red"}).addTo(map);
}

var plotMarkers = function(places){
  var destination;
  //if there is only one place that matches the user's choice of destination
  //pass this place to the find route function
  //and plot this marker
  if(places.length === 1){
    findRoute(places[0])
    return [plotOneMarker(places[0])];
  }else{
    //if there are more than one place that matches user's choice of destination
    //let the user choose one of them on the map to be the actual destination
    //remove all other places from the map
    //pass this one place to the find route function as the destination
    return _.map(places, function(place){
      return L.marker([place.location[1], place.location[0]])
              .on('click', function(){
                clearMarkers(layerPlottedMarkers);
                layerPlottedMarkers = [plotOneMarker(place)];
                findRoute(place)
              })
              .addTo(map);
    })
  }
}

$(document).ready(function() {
  /* This 'if' check allows us to safely ask for the user's current position */
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(function(position) {
      latitude = position.coords.latitude; //user's current latitude is passed to the global latitude variable
      longitude = position.coords.longitude; //user's current longitude is passed to the global longitude variable
      updatePosition(position.coords.latitude, position.coords.longitude, position.timestamp);
    });
  } else {
    alert("Unable to access geolocation API!");
  }


  /* Every time a key is lifted while typing in the #dest input, disable
   * the #calculate button if no text is in the input
   */
  $('#dest').keyup(function(e) {
    if ($('#dest').val().length === 0) {
      $('#calculate').attr('disabled', true);
    } else {
      $('#calculate').attr('disabled', false);
    }
    //every time the user stops typing
    //call the throttled function that makes mapzen api calls to get place names based on user's input
    throttledDesLoc($('#dest').val());
    //remove all the places generated by last time user's input
    places = [];
    //if the autocomplete API returned something
    //construct the places containing names and locations
    if(autocompleteData){
      _.each(autocompleteData.features, function(datum){
        places.push({
          name: datum.properties.label,
          location: datum.geometry.coordinates
        })
      });
    }
    // populate the jquery autocomplete box with these places (names)
    jqueryAutocomplete(places)
  });

  // click handler for the "calculate" button (probably you want to do something with this)
  $("#calculate").click(function(e) {
    //remove any existing marker layers, they are usually destinations based on user input
    if(layerPlottedMarkers.length){
      clearMarkers(layerPlottedMarkers);
    }
    if(layerRoute.length){
      clearMarkers(layerRoute);
    }
    //if there are searched places
    //filter these places
    //find the place(s) that match(es) the user's choice of destination
    if(places.length){
      layerPlottedMarkers = plotMarkers(_.filter(places, function(place){return place.name === $('#dest').val();}));
    }

  });

});
