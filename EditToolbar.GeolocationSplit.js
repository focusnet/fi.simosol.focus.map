L.EditToolbar.GeolocationSplit = L.EditToolbar.Split.extend({
    statics: {
        TYPE: 'geosplit'
    },

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
            this._markers = [];

            this._markerGroup = new L.LayerGroup();
            this._map.addLayer(this._markerGroup);

            this._splittedPolygons = new L.LayerGroup();
            this._map.addLayer(this._splittedPolygons);

            this._poly = new L.Polyline([], this.options.shapeOptions);

            var me = this;

            this._splittableLayers.eachLayer(function (layer) {
                layer.on('click', me._onTouch, me);
            });
        }
    }
});