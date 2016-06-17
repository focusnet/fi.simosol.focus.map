var map;
var data;
var apikey;
var locationMarker;
var popupsEnabled = true;

/**
 * Defines the order in which properties will be displayed in the
 * popup
 */
var STAND_PROPERTIES_ORDER = [
    "G",
    "N",
    "V",
    "Dd",
    "Hd",
    "D",
    "PRFI",
    "PRTA",
    "PRFO",
    "PRLA",
    "PRAN",
    "PRBU",
    "PREI",
    "PREA",
    "PRAH",
    "PRAL"
];

/**
 * List of properties to exclude from the popup
 */
var STAND_PROPERTIES_TO_EXCLUDE = [
    "geojson",
    "operation_urls",
    "uid"
];

/**
 * Defines labels for the properties to be displayed in the popup.
 */
var STAND_LABELS = {
    "Hd": "hdom",
    "Dd": "ddom",
    "inventoryDate": "Inventory date",
    "area": "Stand area (ha)",
    "D": "DG (cm)",
    "N": "Number of stems per ha",
    "V": "Growing stock (m3/ha)",
    "canopyCover": "Degree of canopy cover (%)",
    "structure": "Stand basic structure (1 = even-aged; 2 = uneven aged)",
    "G": "Basal area (m2/ha)",
    "PRAN": "Percentage of coniferous (%G)",
    "PREA": "Percentage of ash (%G)",
    "PRBU": "Percentage of beech (%G)",
    "PRFO": "Percentage of scots pine (%G)",
    "PRAL": "Percentage of other hardwood (%G)",
    "PRAH": "Percentage of maple (%G)",
    "PRFI": "Percentage of spruce (%G)",
    "PRLA": "Percentage of larch (%G)",
    "PREI": "Percentage of oak (%G)",
    "PRTA": "Percentage of silver fir (%G)"
};


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
                // layer.bindPopup(createPopUp(layer.focusdata.getData()));
                layer.eachLayer(function (sublayer) {
                    sublayer.setStyle(shapeOptions);
                    drawnItems.addLayer(sublayer);
                })
            });
        }
    });

    var drawOptions = {
        position: 'topright',
        draw: false,
        edit: {
            edit: false,
            merge: true,
            split: true,
            geosplit: true,
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
                    projGeoJSON.focusdata = stand;
                    projGeoJSON.on('click', onClick);
                }
            }
            break;
        case "stand":
            var stand = me.data;
            var geojson = stand.getGeoJSON();

            if (geojson != null) {
                var projGeoJSON = L.Proj.geoJson(geojson, shapeOptions).addTo(drawnItems);
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

function onClick(event) {
    console.log("CLICK!!!");
    if (popupsEnabled) {
        var target = event.target;

        if (target.hasOwnProperty("focusdata")) {
            var bounds = target.getBounds();
            var center = bounds.getCenter();

            var popup = createPopUp(event.target.focusdata.getData());
            map.openPopup(popup, center);
        }
    }
}

function updatePosition(position) {
    locationMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
}

/**
 * Create the HTML to include in the popup.
 *
 * The entries are order according to STAND_PROPERTIES_ORDER and take their labels
 * from STAND_LABELS. Properties without order are appended to the end of the list,
 * if they are not in the STAND_PROPERTIES_TO_EXCLUDE array. If no label can be found,
 * the property name is used instead.
 *
 * @param data
 * @returns {string}
 *
 * FIXME TODO could be better modularized and cleaner.
 */
function createPopUp(data) {
    var popupstr = "<table>";

    var label, value;
    var alreadySeen = [];
    for (var len = STAND_PROPERTIES_ORDER.length, i = 0; i < len; ++i) {
        if (i in STAND_PROPERTIES_ORDER) {
            var k = STAND_PROPERTIES_ORDER[i];
            label = STAND_LABELS.hasOwnProperty(k) ? STAND_LABELS[k] : k;
            if (data.hasOwnProperty(k)) {
                value = data[k];
                var v2 = ("" + value).substring(0, 20);
                if (v2 != "" + value) {
                    value = v2 + "...";
                }
                if (!isNaN(value)) {
                    value = Math.round(value * 10) / 10;
                }
                popupstr += "<tr><th>" + label + "</th><td>" + value + "</td></tr>\n";
            }
            else {
                popupstr += "<tr><th>" + label + "</th><td>N/A</td></tr>\n";
            }
            alreadySeen[k] = true;
        }
    }

    for (var prop in data) {
        if (alreadySeen.hasOwnProperty(prop) && alreadySeen[prop]) {
            continue;
        }
        if (STAND_PROPERTIES_TO_EXCLUDE.indexOf(prop) != -1) {
            continue;
        }
        if (data.hasOwnProperty(prop)) {
            label = STAND_LABELS.hasOwnProperty(prop) ? STAND_LABELS[prop] : prop;
            value = data[prop];
            var v2 = ("" + value).substring(0, 20);
            if (v2 != ("" + value)) {
                value = v2 + "...";
            }
            if (!isNaN(value)) {
                value = Math.round(value * 10) / 10;
            }
            popupstr += "<tr><th>" + label + "</th><td>" + value + "</td></tr>\n";
        }
    }

    popupstr += "</table>";

    return popupstr;
}