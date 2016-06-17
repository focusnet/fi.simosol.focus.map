L.EditToolbar.GeolocationSplit = L.EditToolbar.Split.extend({
    statics: {
        TYPE: 'geosplit'
    },

    watchID: null,

    initialize: function (map, options) {
        console.log("INITIALIZE");

        L.Draw.Feature.prototype.initialize.call(this, map, options);

        L.Util.setOptions(this, options);

        this._splittableLayers = this.options.featureGroup;

        if (!(this._splittableLayers instanceof L.FeatureGroup)) {
            throw new Error('options.featureGroup must be a L.FeatureGroup');
        }

        this.type = "geosplit";
    },

    addHooks: function () {
        console.log("ADDHOOKS GEOSPLIT");

        L.Draw.Feature.prototype.addHooks.call(this);

        if (this._map) {
            this._splittedPolygons = new L.LayerGroup();
            this._map.addLayer(this._splittedPolygons);
            this._poly = new L.Polyline([], this.options.shapeOptions);
            var me = this;
        }

        // this.startFakeWatch();
        this.startWatch();
    },

    removeHooks: function () {
        console.log("REMOVEHOOKS");
        L.Draw.Feature.prototype.removeHooks.call(this);

        this.endWatch();
        this._map.removeLayer(this._poly);
        delete this._poly;
    },

    _finishShape: function () {
        console.log("FINISHSHAPE");

        var me = this;

        // BLADE TO GEOJSON
        var blade = this._poly.toGeoJSON();

        var polygons = [];

        this._splittableLayers.eachLayer(function (layer) {
            me.options.featureGroup.removeLayer(layer);
            var layerGeoJSON = layer.toGeoJSON();

            layerGeoJSON.focusdata = layer.focusdata;
            polygons = polygons.concat(me._getPolygons(layerGeoJSON, layer.focusdata));
        });

        this.cut(polygons, blade);

        this._map.removeLayer(this._poly);

        this.disable();
    },

    save: function () {
        this._finishShape();

        console.log("SAVE");

        this._map.fire('split:created', {
            created: this._splittedPolygons
        });
    },

    updatePosition: function (position) {
        console.log("GEOSPLIT Latitude: " + position.coords.latitude + " Longitude: " + position.coords.longitude);

        this._poly.addLatLng(L.latLng(position.coords.latitude, position.coords.longitude));

        if (this._poly.getLatLngs().length === 2) {
            this._map.addLayer(this._poly);
        }
    },

    startWatch: function () {
        console.log("STARTWATCH");
        var onPositionResponse = L.bind(this.updatePosition, this);

        if (navigator.geolocation) {
            this.watchID = navigator.geolocation.watchPosition(onPositionResponse, null, {enableHighAccuracy: true});
        } else {
            console.warn("Geolocation is not supported by this browser.");
        }
    },

    endWatch: function () {
        console.log("ENDWATCH");
        if (navigator.geolocation && this.watchID != null) {
            navigator.geolocation.clearWatch(this.watchID);
        }
    },

    /**
     * just for indoor testing purpose
     */
    startFakeWatch: function () {
        var me = this;
        fakestep = 0;
        fakegps = window.setInterval(this.updateFakePosition, 20, me);
    },

    updateFakePosition: function (me) {
        var position = {
            coords: {
                latitude: fakegpsline[fakestep][1],
                longitude: fakegpsline[fakestep][0]
            }
        };

        fakestep++;

        if (fakestep == fakegpsline.length) {
            console.log("FAKE END");
            window.clearInterval(fakegps);
        } else {
            me.updatePosition(position);
        }
    }
});

var fakegps;
var fakestep;
var fakegpsline = [
    [
        8.741093873977661,
        47.515084846083624
    ],
    [
        8.741083145141602,
        47.51496166030528
    ],
    [
        8.74110460281372,
        47.51489644418791
    ],
    [
        8.741147518157959,
        47.51480948923867
    ],
    [
        8.741211891174316,
        47.514715287881074
    ],
    [
        8.741211891174316,
        47.51460659379678
    ],
    [
        8.741190433502197,
        47.51450514578161
    ],
    [
        8.741254806518555,
        47.51440369757035
    ],
    [
        8.741308450698853,
        47.5143167418046
    ],
    [
        8.741394281387329,
        47.5142442785564
    ],
    [
        8.741501569747925,
        47.51415732252646
    ],
    [
        8.741576671600342,
        47.51409210540945
    ],
    [
        8.741694688796997,
        47.51404138092907
    ],
    [
        8.741898536682129,
        47.513947178192566
    ],
    [
        8.742016553878784,
        47.513896453572116
    ],
    [
        8.742177486419678,
        47.513816743355164
    ],
    [
        8.742284774780273,
        47.51373703301717
    ],
    [
        8.74238133430481,
        47.51367181537782
    ],
    [
        8.742488622665405,
        47.513584858399284
    ],
    [
        8.742574453353882,
        47.51350514770905
    ],
    [
        8.742671012878418,
        47.51333847951092
    ],
    [
        8.742703199386597,
        47.51323702904421
    ],
    [
        8.742767572402954,
        47.51310659244168
    ],
    [
        8.742831945419312,
        47.51304137401884
    ],
    [
        8.742939233779907,
        47.51298340201937
    ],
    [
        8.743239641189575,
        47.51295441599561
    ],
    [
        8.743529319763184,
        47.512976155514934
    ],
    [
        8.743679523468018,
        47.51304137401884
    ],
    [
        8.743797540664671,
        47.51312108541351
    ]
];