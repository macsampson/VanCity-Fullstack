import React, { Component } from "react";
import ReactDOMServer from "react-dom/server";
import InfoWindow from "./InfoWindow";
import PropTypes from "prop-types";
import toaster from "toasted-notes";
import Nav from "./Nav";
// import axios from "axios";

import "../App.css";

var map;
var markers = [];
var activeInfoWindow; // Keeps track of the last active info window (used for closing when a new one is opened)
var autocomplete;

class Container extends Component {
  constructor(props) {
    super(props);
    this.state = {
      location: null,
      rate: "Any",
      distance: 250,
      meter_type: "Any"
    };
  }

  componentDidMount() {
    window.initMap = this.initMap;
  }

  handleDistanceChange = distance => {
    this.setState({
      distance
    });
  };

  handleRateChange = rate => {
    this.setState({
      rate
    });
  };

  handleTypeChange = type => {
    this.setState({
      meter_type: type
    });
  };

  handleSearch = e => {
    this.search();
  };

  initMap = () => {
    let { initialCenter, zoom } = this.props;
    let { lat, lng } = initialCenter;
    const center = new window.google.maps.LatLng(lat, lng);
    const node = document.getElementById("map");
    const mapConfig = Object.assign(
      {},
      {
        center: center,
        zoom: zoom,
        gestureHandling: "greedy",
        fullscreenControl: false,
        zoomControl: false
      }
    );
    map = new window.google.maps.Map(node, mapConfig);

    // Close info window when the map is clicked
    window.google.maps.event.addListener(map, "click", e => {
      activeInfoWindow.close()
    });

    // Declare Options For Autocomplete
    var options = {
      types: []
    };
    // Set the search bar to use Googles Place Autocomplete library
    let inputNode = document.getElementById("autocomplete");
    autocomplete = new window.google.maps.places.Autocomplete(
      inputNode,
      options
    );

    autocomplete.addListener("place_changed", this.search);

    // Set the autocomplate to bias towards locations within the maps current viewport
    autocomplete.bindTo("bounds", map);

    // Prevent form from getting submitted when the enter key is pressed
    // window.google.maps.event.addDomListener(inputNode, "keydown", function(
    //   event
    // ) {
    //   if (event.keyCode === 13) {
    //     event.preventDefault();
    //   }
    // });
  };

  // Conduct search using parameters given from user
  search = () => {
    // Re-center and zoom the map to the location entered in the search box
    for (let marker of markers) {
      marker.setMap(null);
    }
    markers = [];
    var place = autocomplete.getPlace();
    // console.log(place);
    // console.log(place);
    // Do nothing is there is no place
    if (!place) {
      return;
    }
    if (!place.geometry) {
      // User entered the name of a Place that was not suggested and the Place Details request failed.
      window.alert("No details available for input: '" + place.name + "'");
      return;
    }

    // // If the place has a geometry, then present it on a map.
    // if (place.geometry.viewport) {
    //   map.fitBounds(place.geometry.viewport);
    // } else {
    //   map.setCenter(place.geometry.location);
    //   map.setZoom(17); // Why 17? Because it looks on point
    // }

    // Construct url with query params to pass to the fetch function
    var search_lat = place.geometry.location.lat();
    var search_lng = place.geometry.location.lng();


    var searchLatlng = new window.google.maps.LatLng(search_lat, search_lng);
    let search_location = new window.google.maps.Marker({
      position: searchLatlng,
      map: map
    })
    markers.push(search_location)
    

    // TODO: Change the domain and port before deploying to prod
    // var url = new URL("http://localhost:3001/meters"),
    //   params = {
    //     lat: search_lat,
    //     lng: search_lng,
    //     distance: this.state.distance,
    //     rate: this.state.rate,
    //     type: this.state.meter_type
    //   };

    var url =
      "/api/meters?lat=" +
      search_lat +
      "&lng=" +
      search_lng +
      "&distance=" +
      this.state.distance +
      "&rate=" +
      this.state.rate +
      "&type=" +
      this.state.meter_type;

    // Object.keys(params).forEach(key =>
    //   url.searchParams.append(key, params[key])
    // );
    getMeters(url, search_location).catch(err => console.log("Fetch Error : -S", err));
  };

  render() {
    // const mapStyle = {
    //   height: "90vh",
    //   marginTop: "70px"
    // };
    return (
      <div>
        <Nav
          distance={this.handleDistanceChange}
          rate={this.handleRateChange}
          type={this.handleTypeChange}
          search={this.handleSearch}
        />
        <div id="map" />
      </div>
    );
  }
}

// Fetch meters from the given endpoint and add each one to the map
async function getMeters(url, search_loc) {
  let response = await fetch(url);
  let meters = await response.json();

  // If no meters are returned, show an alert and return
  if (meters.length === 0) {
    toaster.notify(
      "No meters found with specified filters. Adjust filters and try again.",
      {
        duration: 3000
      }
    );
    return;
  }

  var icons = {
    parking: {
      icon: "/images/parking-meter.png"
    },
    ev: {
      icon: "/images/ev-station.png"
    }
  };


  // Else begin adding markers to the map
  for (let meter of meters) {
    addMarker(meter, map, icons.parking.icon);
  }

  // Fit the map to the coordinates of all the markers
  var bounds = new window.google.maps.LatLngBounds();
  for (let marker of markers) {
    bounds.extend(marker.getPosition());
  }
  map.fitBounds(bounds);
}

// // Fetch unique rates from a given endpoint and save them to the state
// function getRates(url) {
//   fetch("http://localhost:3001/rates")
//     .then(response => {
//       return response.json();
//     })
//     .then(data => {
//       let rates = data.map(rate => {
//         return { value: rate, display: rate };
//       });
//       this.setState({
//         rates: [{ value: "", display: "Select Rate" }].concat(rates)
//       });
//     })
//     .catch(error => {
//       console.log(error);
//     });
// }

// Function to add markers to the map
function addMarker(meter, map, icon) {
  var latLng = new window.google.maps.LatLng(
    meter.geometry.coordinates[1],
    meter.geometry.coordinates[0]
  );

  var marker = new window.google.maps.Marker({
    position: latLng,
    icon: icon,
    map: map
  });

  addInfoWindow(marker, meter.properties);
  markers.push(marker);
}

// Function to add info window to a marker
function addInfoWindow(marker, json) {
  let contentString = ReactDOMServer.renderToString(
    <InfoWindow
      key={json.meter_id}
      weekdays={json.limits_and_rates.weekdays}
      saturdays={json.limits_and_rates.saturday}
      sundays={json.limits_and_rates.sunday}
      meter_type={json.meter_type}
      pay_by_phone={json.pay_by_phone_num}
      credit_card={json.credit_card}
      extras={json.prohibitions}
    />
  );

  var infowindow = new window.google.maps.InfoWindow({});

  var street = map.getStreetView();

  bindInfoWindow(marker, map, infowindow, contentString);
  bindInfoWindow(marker, street, infowindow, contentString);

  // Close active infowindow if another one is clicked
  marker.addListener("click", function() {
    if (activeInfoWindow) {
      activeInfoWindow.close();
    }
    infowindow.open(map, marker);
    activeInfoWindow = infowindow;
  });
}

// Function to attach a click event to the current marker
function bindInfoWindow(marker, mapOrStreetViewObject, infoWindowObject, html) {
  window.google.maps.event.addListener(marker, "click", function() {
    infoWindowObject.setContent(html);
    infoWindowObject.open(mapOrStreetViewObject, marker);
  });
}

Container.propTypes = {
  zoom: PropTypes.number,
  center: PropTypes.object,
  gestureHandling: PropTypes.string,
  fullscreenControl: PropTypes.bool
};

Container.defaultProps = {
  zoom: 13,
  // Vancouver, by default
  initialCenter: {
    lat: 49.24966,
    lng: -123.11934
  }
};

export default Container;
