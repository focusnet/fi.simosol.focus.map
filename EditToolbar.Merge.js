L.EditToolbar.Merge = L.Handler.extend({
  statics: {
    TYPE: 'merge'
  },

  options: {
    shapeOptions: {
      stroke: true,
      color: '#f06eaa',
      weight: 4,
      opacity: 0.5,
      fill: true,
      fillColor: null, //same as color by default
      fillOpacity: 0.2,
      clickable: true
    }
  },

  includes: L.Mixin.Events,

  initialize: function(map, options) {
    L.Handler.prototype.initialize.call(this, map);

    L.Util.setOptions(this, options);

    this._mergeableLayers = this.options.featureGroup; // These are the layers that can be merged currently

    if (!(this._mergeableLayers instanceof L.FeatureGroup)) {
      throw new Error('options.featureGroup must be a L.FeatureGroup');
    }

    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
    this.type = "merge";
  },

  enable: function() {
    console.log("ENABLE");

    this.fire("enabled", {
      handler: this.type
    });

    this._map.fire('draw:mergestart', {
      handler: this.type
    });

    L.Handler.prototype.enable.call(this);
  },

  disable: function() {
    console.log("DISABLE");
    if (!this._enabled) {
      return;
    }

    L.Handler.prototype.disable.call(this);

    this._map.fire('draw:mergestop', {
      handler: this.type
    });

    this.fire('disabled', {
      handler: this.type
    });
  },

  addHooks: function() {
    console.log("ADDHOOKS");

    var map = this._map;

    if (map) {
      map.getContainer().focus();
      this._mergeableLayers.eachLayer(this._enableLayerMerge, this);
      this._selectedLayers = new L.LayerGroup();
    }
  },

  removeHooks: function() {
    console.log("REMOVEHOOKS");
    if (this._map) {
			this._mergeableLayers.eachLayer(this._disableLayerMerge, this);
      this._selectedLayers = null;
		}
  },

  save: function() {
    console.log("SAVE");
    var me = this,
    merged = L.geoJson(turf.merge(this._selectedLayers.toGeoJSON()));

    merged.setStyle(this.options.shapeOptions);

    this._selectedLayers.eachLayer(function (layer) {
      me._mergeableLayers.removeLayer(layer);
      me._selectedLayers.removeLayer(layer);
    });

    this._map.fire('merge:created', { merge: merged });
  },

  revertLayers: function() {
    console.log("REVERTLAYERS");
    this._deselectAll();
  },

  _enableLayerMerge: function(e) {
    console.log("ENABLELAYERMERGE");
    var layer = e.layer || e.target || e;
    layer.on('click', this._addToBeMerged, this);

    if(this.options.selectedPathOptions) {
      pathOptions = L.Util.extend({}, this.options.selectedPathOptions);

      pathOptions.color = layer.options.color;
			pathOptions.fillColor = layer.options.fillColor;

      layer.options.original = L.extend({}, layer.options);
      layer.options.editing = pathOptions;
    }
  },

  _disableLayerMerge: function(e) {
    var layer = e.layer || e.target || e;

		layer.off('click', this._addToBeMerged, this);

		// Remove from the deleted layers so we can't accidentally revert if the user presses cancel
		this._selectedLayers.removeLayer(layer);
  },

  _addToBeMerged: function(e) {
    console.log("ADDTOBEMERGED");
    var layer = e.layer || e.target || e;

    layer.addTo(this._selectedLayers);
    layer.setStyle(this.options.selectedPathOptions);
  },

  _deselectAll: function() {
    var me = this;
    this._selectedLayers.eachLayer(function (layer) {
      me._deselect(layer);
    });
  },

  _deselect:function(layer) {
    layer.setStyle(layer.options.original);
  }
});
