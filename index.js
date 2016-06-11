var map;
var rootdata;
var apikey = "";

function init(context) {
    console.log("init :: %o", context);

    if (!apikey) {
        window.alert("You must provide apikey within the code!");
    }
    else {
        loadRootData(context);
    }
}

// Do we run the webbapp from FOCUS, or do we want to display a demo in the browser?
if(window.FocusApp) {
     var header = FocusApp.getAccessControlToken('core.focusnet.eu');
     var match = /^[^:]+:\s*(.+)$/.exec(header);
     apikey = match[1];
     window.FocusApp.init = init;
}
else {
     document.addEventListener("DOMContentLoaded", function(event) {
         var context = document.getElementsByTagName("body")[0].getAttribute("data-context");
         apikey = document.getElementsByTagName("body")[0].getAttribute("data-api-key");
         init(context);
        });
}

function loadRootData(url) {
    console.log("load data");

    var me = this, xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {

            if (xmlhttp.response) {

                rootdata = new FocusRootData();
                rootdata.fromJSON(JSON.parse(xmlhttp.responseText));
                rootdata.loadProjects().then(function(result) {
                    console.log(result); // "Stuff worked!"
                    me.initmap();
                }, function(err) {
                    console.log(err); // Error: "It broke"
                });
            }
        }
    };

    xmlhttp.open("GET", url, true);
    xmlhttp.setRequestHeader(apikey, "FOCUS-FOREST-API-KEY");
    xmlhttp.setRequestHeader("FOCUS-FOREST-API-KEY", apikey);
    xmlhttp.send();
}

function loadStand(url) {
    var standrequest = new XMLHttpRequest();

    standrequest.onreadystatechange = function() {
        if (standrequest.readyState == 4 && standrequest.status == 200) {
            var stand = factory.createStandData(JSON.parse(standrequest.responseText));
            console.log("%o", stand);
        }
    }

    standrequest.withCredentials = true;
    standrequest.open("GET", url, true);
    standrequest.send();
}


function initmap() {
    console.log("initmap");

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

    L.drawLocal.draw.toolbar.buttons.polygon = 'Draw a sexy polygon!';

    var drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            marker: false,
            circle: false,
            polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: {
                    color: '#b00b00',
                    timeout: 1000
                }
            }
        },
        edit: {
            edit: false,
            featureGroup: drawnItems,
            remove: true
        }
    });
    map.addControl(drawControl);

    map.on('draw:created', function(e) {
        var type = e.layerType,
            layer = e.layer;

        // Do whatever else you need to. (save to db, add to map etc)
        drawnItems.addLayer(layer);
    });

    // in here you do whatever you want with the split output
    map.on('merge:created', function(e) {
        if (e.merge) {
            var result = e.merge;
            result.eachLayer(function(layer) {
                drawnItems.addLayer(layer);
            });
        }
    });

    // in here you do whatever you want with merge output
    map.on('split:created', function(e) {
        if (e.created) {
            var result = e.created;
            result.eachLayer(function(layer) {
                console.log(layer);
                layer.eachLayer(function(sublayer) {
                    sublayer.setStyle(shapeOptions);
                    drawnItems.addLayer(sublayer);
                })
            });
        }
    })

    var projects = rootdata.getProjects();

    for (var p = 0; p < projects.length; ++p) {
        var project = projects[p];
        var stands = project.getStands();
        for (var s = 0; s < stands.length; ++s) {
            var stand = stands[s];
            var geojson = stand.getGeoJSON();

            if (geojson != null) {
                var projGeoJSON = L.Proj.geoJson(geojson, shapeOptions).addTo(drawnItems);
                var data = stand.getData();

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

                projGeoJSON.bindPopup(popupstr);
            }
        }
    }

    map.fitBounds(drawnItems.getBounds());
}
