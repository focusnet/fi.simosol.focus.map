var map;
var data;
var apikey;
var locationMarker;

function init(context) {
    console.log("init :: %o", context);

    if (!apikey) {
        window.alert("You must provide apikey within the code!");
    }
    else {
        loadData(context);
    }
}

// Do we run the webbapp from FOCUS, or do we want to display a demo in the browser?
if (window.FocusApp) {
    var header = FocusApp.getAccessControlToken('core.focusnet.eu');
    var match = /^[^:]+:\s*(.+)$/.exec(header);
    apikey = match[1];
    window.FocusApp.init = init;
} else {
    document.addEventListener("DOMContentLoaded", function (event) {
        var context = document.getElementsByTagName("body")[0].getAttribute("data-context");
        apikey = document.getElementsByTagName("body")[0].getAttribute("data-api-key");
        init(context);
    });
}

function loadData(url) {
    // let's see what case we are dealing with
    var split = url.split("/"), me = this;
    switch (split[3]) {
        case "forest":
            console.log("forest");
            data = new FocusRootData();
            data.load(url).then(function (result) {
                console.log(result);
                me.initmap("forest");
            });
            break;
        case "forest_data":
            console.log("forest_data");
            data = new FocusProjectData();
            data.load(url).then(function (result) {
                console.log(result);
                me.initmap("forest_data");
            });
            break;
        case "stand":
            console.log("stand");
            data = new FocusStandData();
            data.load(url).then(function (result) {
                console.log(result);
                me.initmap("stand");
            });
            break;
        default:
            window.alert("Invalid url " + url);
            break;
    }
}

function initmap(datatype) {
    console.log("initmap");

    var me = this;

    // set up the map
    map = new L.Map('map', {
        attributionControl: false
    });

    var shapeOptions = {
        stroke: true,
        color: '#f06eaa',
        weight: 4,
        opacity: 0.5,
        fill: true,
        fillColor: null, //same as color by default
        fillOpacity: 0.2,
        clickable: true
    };

    // create the openstreetmap tile layer
    var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osm = new L.TileLayer(osmUrl, {
        minZoom: 5,
        maxZoom: 18
    });

    // start the map in South-East England
    map.setView([51.505, -0.09], 8);
    map.addLayer(osm);

    var drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    map.on('draw:created', function (e) {
        var type = e.layerType,
            layer = e.layer;

        // Do whatever else you need to. (save to db, add to map etc)
        drawnItems.addLayer(layer);
    });

    // in here you do whatever you want with the split output
    map.on('merge:created', function (e) {
        if (e.merge) {
            var result = e.merge;
            result.eachLayer(function (layer) {
                drawnItems.addLayer(layer);
            });
        }
    });

    // in here you do whatever you want with merge output
    map.on('split:created', function (e) {
        if (e.created) {
            var result = e.created;
            result.eachLayer(function (layer) {
                console.log(layer);
                layer.eachLayer(function (sublayer) {
                    sublayer.setStyle(shapeOptions);
                    drawnItems.addLayer(sublayer);
                })
            });
        }
    });


    var drawOptions = {
        position: 'topright',
        draw: {
            marker: false,
            circle: false,
            polygon: false,
            rectangle: false
        },
        edit: {
            edit: false,
            merge: true,
            split: true,
            remove: false,
            featureGroup: drawnItems
        }
    };

    switch (datatype) {
        case "forest":
            var projects = me.data.getProjects();

            for (var p = 0; p < projects.length; ++p) {
                var project = projects[p];
                var stands = project.getStands();
                for (var s = 0; s < stands.length; ++s) {
                    var stand = stands[s];
                    var geojson = stand.getGeoJSON();

                    if (geojson != null) {
                        var projGeoJSON = L.Proj.geoJson(geojson, shapeOptions).addTo(drawnItems);
                        var data = stand.getData();
                        projGeoJSON.bindPopup(createPopUp(data));
                    }
                }
            }
            break;
        case "forest_data":
            var stands = me.data.getStands();
            for (var s = 0; s < stands.length; ++s) {
                var stand = stands[s];
                var geojson = stand.getGeoJSON();

                if (geojson != null) {
                    var projGeoJSON = L.Proj.geoJson(geojson, shapeOptions).addTo(drawnItems);
                    var data = stand.getData();
                    projGeoJSON.bindPopup(createPopUp(data));
                }
            }
            break;
        case "stand":
            var stand = me.data;
            var geojson = stand.getGeoJSON();

            if (geojson != null) {
                var projGeoJSON = L.Proj.geoJson(geojson, shapeOptions).addTo(drawnItems);
                var data = stand.getData();
                projGeoJSON.bindPopup(createPopUp(data));
            }

            break;
    }

    map.fitBounds(drawnItems.getBounds());

    var drawControl = new L.Control.Draw(drawOptions);
    map.addControl(drawControl);

    this.initGeolocation();
}

function initGeolocation() {
    console.log("initGeolocation");
    locationMarker = L.marker([51.5, -0.09]);

    if (navigator.geolocation) {
        map.addLayer(locationMarker);
        navigator.geolocation.watchPosition(updatePosition, geolocationError, {enableHighAccuracy: true});
    } else {
        console.warn("Geolocation is not supported by this browser.");
    }
}

function geolocationError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            console.warn("User denied the request for Geolocation.");
            break;
        case error.POSITION_UNAVAILABLE:
            console.warn("Location information is unavailable.");
            break;
        case error.TIMEOUT:
            console.warn("The request to get user location timed out.");
            break;
        case error.UNKNOWN_ERROR:
            console.warn("An unknown error occurred.");
            break;
    }
}

function updatePosition(position) {
    console.log("Latitude: " + position.coords.latitude + " Longitude: " + position.coords.longitude);
    locationMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
}

function createPopUp(data) {
    var popupstr = "<table>";

    for (var property in data) {
        if (data.hasOwnProperty(property)) {
            if (property != "geojson") { // geojson is way too big attribute to dipslay so we skip it

                var value = data[property];

                if (!isNaN(value)) {
                    value = Math.round(value * 10) / 10;
                }

                popupstr += "<tr><th>" + property + "</th><td>" + value + "</td></tr>";
            }
        }
    }

    popupstr += "</table>";

    return popupstr;
}