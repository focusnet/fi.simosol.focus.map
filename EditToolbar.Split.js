L.EditToolbar.Split = L.Draw.Feature.extend({
    statics: {
        TYPE: 'split'
    },

    Poly: L.Polyline,

    options: {
        icon: new L.DivIcon({
            iconSize: new L.Point(8, 8),
            className: 'leaflet-div-icon leaflet-editing-icon'
        }),
        touchIcon: new L.DivIcon({
            iconSize: new L.Point(20, 20),
            className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
        }),
        shapeOptions: {
            stroke: true,
            color: '#f06eaa',
            weight: 4,
            opacity: 0.5,
            fill: false,
            clickable: true
        },
        zIndexOffset: 2000
    },

    initialize: function (map, options) {
        console.log("INITIALIZE");

        if (L.Browser.touch) {
            this.options.icon = this.options.touchIcon;
        }

        L.Draw.Feature.prototype.initialize.call(this, map, options);

        L.Util.setOptions(this, options);

        this._splittableLayers = this.options.featureGroup;

        if (!(this._splittableLayers instanceof L.FeatureGroup)) {
            throw new Error('options.featureGroup must be a L.FeatureGroup');
        }

        this.type = "split";
    },

    addHooks: function () {
        console.log("ADDHOOKS");

        L.Draw.Feature.prototype.addHooks.call(this);

        if (this._map) {
            this._markers = [];

            this._markerGroup = new L.LayerGroup();
            this._map.addLayer(this._markerGroup);

            this._splittedPolygons = new L.LayerGroup();
            this._map.addLayer(this._splittedPolygons);

            this._poly = new L.Polyline([], this.options.shapeOptions);

            if (!this._mouseMarker) {
                this._mouseMarker = L.marker(this._map.getCenter(), {
                    icon: L.divIcon({
                        className: 'leaflet-mouse-marker',
                        iconAnchor: [20, 20],
                        iconSize: [40, 40]
                    }),
                    opacity: 0,
                    zIndexOffset: this.options.zIndexOffset
                });
            }

            this._mouseMarker
                .on('mousedown', this._onMouseDown, this)
                .on('mouseout', this._onMouseOut, this)
                .on('mouseup', this._onMouseUp, this) // Necessary for 0.8 compatibility
                .on('mousemove', this._onMouseMove, this) // Necessary to prevent 0.8 stutter
                .addTo(this._map);

            this._map
                .on('mouseup', this._onMouseUp, this) // Necessary for 0.7 compatibility
                .on('mousemove', this._onMouseMove, this)
                .on('zoomlevelschange', this._onZoomEnd, this)
                .on('click', this._onTouch, this)
                .on('zoomend', this._onZoomEnd, this);

            var me = this;

            this._splittableLayers.eachLayer(function (layer) {
                layer.on('click', me._onTouch, me);
            });
        }
    },

    removeHooks: function () {
        console.log("REMOVEHOOKS");

        L.Draw.Feature.prototype.removeHooks.call(this);
        this._map.removeLayer(this._markerGroup);
        delete this._markerGroup;
        delete this._markers;

        this._map.removeLayer(this._poly);
        delete this._poly;

        this._mouseMarker
            .off('mousedown', this._onMouseDown, this)
            .off('mouseout', this._onMouseOut, this)
            .off('mouseup', this._onMouseUp, this)
            .off('mousemove', this._onMouseMove, this);
        this._map.removeLayer(this._mouseMarker);
        delete this._mouseMarker;

        // clean up DOM
        this._clearGuides();

        this._map
            .off('mouseup', this._onMouseUp, this)
            .off('mousemove', this._onMouseMove, this)
            .off('mouseup', this._onMouseUp, this)
            .off('zoomend', this._onZoomEnd, this)
            .off('click', this._onTouch, this);
    },

    save: function () {
        console.log("SAVE");
        this._map.fire('split:created', {
            created: this._splittedPolygons
        });
        //  this._map.removeLayer(this._splittedPolygons);
    },

    revertLayers: function () {
        console.log("REVERTLAYERS");
    },

    enable: function () {
        console.log("ENABLE");

        var me = this;

        this.fire("enabled", {
            handler: this.type
        });

        this._backup = [];


        this._splittableLayers.eachLayer(function (layer) {
            me._backup.push(layer);
        });

        L.Handler.prototype.enable.call(this);
    },

    disable: function () {
        console.log("DISABLE");

        L.Handler.prototype.disable.call(this);

        this.fire('disabled', {
            handler: this.type
        });
    },

    addVertex: function (latlng) {
        var markersLength = this._markers.length;

        if (markersLength > 0 && !this.options.allowIntersection && this._poly.newLatLngIntersects(latlng)) {
            // this._showErrorTooltip();
            return;
        } else if (this._errorShown) {
            // this._hideErrorTooltip();
        }

        this._markers.push(this._createMarker(latlng));

        this._poly.addLatLng(latlng);

        if (this._poly.getLatLngs().length === 2) {
            this._map.addLayer(this._poly);
        }

        this._vertexChanged(latlng, true);
    },

    cut: function (polygons, blade) {
        if (blade && polygons.length > 0) {
            for (var i = 0; i < polygons.length; ++i) {
                var result = this.split(polygons[i], blade);
                this._splittedPolygons.addLayer(L.geoJson(result));
            }
        }
    },

    _showErrorTooltip: function () {
        this._errorShown = true;

        // Update tooltip
        this._tooltip
            .showAsError()
            .updateContent({ text: this.options.drawError.message });

        // Update shape
        this._updateGuideColor(this.options.drawError.color);
        this._poly.setStyle({ color: this.options.drawError.color });

        // Hide the error after 2 seconds
        this._clearHideErrorTimeout();
        this._hideErrorTimeout = setTimeout(L.Util.bind(this._hideErrorTooltip, this), this.options.drawError.timeout);
    },

    _hideErrorTooltip: function () {
        this._errorShown = false;

        this._clearHideErrorTimeout();

        // Revert tooltip
        this._tooltip
            .removeError()
            .updateContent(this._getTooltipText());

        // Revert shape
        this._updateGuideColor(this.options.shapeOptions.color);
        this._poly.setStyle({ color: this.options.shapeOptions.color });
    },

    split: function (polygon, blade) {
        var me = this;
        var reader = new jsts.io.GeoJSONReader();

        var a = reader.read(polygon);
        var b = reader.read(blade);

        var union = a.geometry.getExteriorRing().union(b.geometry);

        var interiorRingNum = a.geometry.getNumInteriorRing();

        console.log(interiorRingNum);

        var interiorRings = [];

        for (var i = 0; i < interiorRingNum; ++i) {
            var ir = a.geometry.getInteriorRingN(i);
            var fact = new jsts.geom.GeometryFactory();
            var poly = new jsts.geom.Polygon(ir, null, fact);
            interiorRings.push(me._polygon2geonjson(poly));
        }

        var polygonizer = new jsts.operation.polygonize.Polygonizer();

        polygonizer.add(union);

        var output = {
            type: "FeatureCollection",
            features: []
        }
        var polygons = polygonizer.getPolygons();
        var me = this;

        polygons.a.forEach(function (poly) {
            var p = me._polygon2geonjson(poly);

            // let's cut interior rings if there was any
            if (interiorRings.length > 0) {
                for (var i = 0; i < interiorRings.length; i++) {
                    p = turf.erase(p, interiorRings[i]);
                }
            }

            output.features.push(p);
        });

        return output;
    },

    _polygon2geonjson: function (polygon) {
        writer = new jsts.io.GeoJSONWriter();
        var f = {
            type: "Feature",
            properties: {},
            geometry: writer.write(polygon)
        };

        return f;
    },

    _polygon2linestring: function (polygon) {
        var polygonLine = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": []
            }
        };

        for (var i = 0; i < polygon.geometry.coordinates[0].length; ++i) {
            polygonLine.geometry.coordinates.push(polygon.geometry.coordinates[0][i]);
        }

        console.log(JSON.stringify(polygonLine));

        return polygonLine;
    },

    _createMarker: function (latlng) {
        var marker = new L.Marker(latlng, {
            icon: this.options.icon,
            zIndexOffset: this.options.zIndexOffset * 2
        });

        this._markerGroup.addLayer(marker);

        return marker;
    },

    _drawGuide: function (pointA, pointB) {
        var length = Math.floor(Math.sqrt(Math.pow((pointB.x - pointA.x), 2) + Math.pow((pointB.y - pointA.y), 2))),
            guidelineDistance = this.options.guidelineDistance,
            maxGuideLineLength = this.options.maxGuideLineLength,
        // Only draw a guideline with a max length
            i = length > maxGuideLineLength ? length - maxGuideLineLength : guidelineDistance,
            fraction,
            dashPoint,
            dash;

        //create the guides container if we haven't yet
        if (!this._guidesContainer) {
            this._guidesContainer = L.DomUtil.create('div', 'leaflet-draw-guides', this._overlayPane);
        }

        //draw a dash every GuildeLineDistance
        for (; i < length; i += this.options.guidelineDistance) {
            //work out fraction along line we are
            fraction = i / length;

            //calculate new x,y point
            dashPoint = {
                x: Math.floor((pointA.x * (1 - fraction)) + (fraction * pointB.x)),
                y: Math.floor((pointA.y * (1 - fraction)) + (fraction * pointB.y))
            };

            //add guide dash to guide container
            dash = L.DomUtil.create('div', 'leaflet-draw-guide-dash', this._guidesContainer);
            dash.style.backgroundColor = !this._errorShown ? this.options.shapeOptions.color : this.options.drawError.color;

            L.DomUtil.setPosition(dash, dashPoint);
        }
    },

    _updateFinishHandler: function () {
        var markerCount = this._markers.length;
        // The last marker should have a click handler to close the polyline
        if (markerCount > 1) {
            this._markers[markerCount - 1].on('click', this._finishShape, this);
        }

        // Remove the old marker click handler (as only the last point should close the polyline)
        if (markerCount > 2) {
            this._markers[markerCount - 2].off('click', this._finishShape, this);
        }
    },

    _updateRunningMeasure: function (latlng, added) {
        var markersLength = this._markers.length,
            previousMarkerIndex, distance;

        if (this._markers.length === 1) {
            this._measurementRunningTotal = 0;
        } else {
            previousMarkerIndex = markersLength - (added ? 2 : 1);
            distance = latlng.distanceTo(this._markers[previousMarkerIndex].getLatLng());

            this._measurementRunningTotal += distance * (added ? 1 : -1);
        }
    },

    _vertexChanged: function (latlng, added) {
        this._map.fire('draw:drawvertex', {
            layers: this._markerGroup
        });
        this._updateFinishHandler();

        this._updateRunningMeasure(latlng, added);

        this._clearGuides();

        this._updateTooltip();
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
            polygons = polygons.concat(me._getPolygons(layerGeoJSON));
        });

        this.cut(polygons, blade);

        this._map.removeLayer(this._poly);
        this._map.removeLayer(this._markerGroup);

        this.save();
        this.disable();
    },

    _getPolygons:function (layer) {
        console.log(layer.type);

        var me = this;

        var result = [];

        if (layer.type == "FeatureCollection") {
            for (var i = 0; i < layer.features.length; ++i) {
                result = result.concat(me._getPolygons(layer.features[i]));
            }
        } else if (layer.type == "Feature" && layer.geometry.type == "Polygon") {
            result.push(layer);
        }

        return result;
    },

    _onMouseUp: function (e) {
        console.log("MOUSEUP");
        if (this._mouseDownOrigin) {
            // We detect clicks within a certain tolerance, otherwise let it
            // be interpreted as a drag by the map
            var distance = L.point(e.originalEvent.clientX, e.originalEvent.clientY)
                .distanceTo(this._mouseDownOrigin);
            if (Math.abs(distance) < 9 * (window.devicePixelRatio || 1)) {
                this.addVertex(e.latlng);
            }
        }
        this._mouseDownOrigin = null;
    },

    _onMouseDown: function (e) {
        console.log("MOUSEDOWN");
        var originalEvent = e.originalEvent;
        this._mouseDownOrigin = L.point(originalEvent.clientX, originalEvent.clientY);
    },

    _onTouch: function (e) {
        console.log("ONTOUCH");

        if (L.Browser.touch) { // #TODO: get rid of this once leaflet fixes their click/touch.
            this._onMouseMove(e);
            this._onMouseDown(e);
            this._onMouseUp(e);
        }
    },

    _onMouseOut: function () {
        // console.log("ONMOUSEOUT");
    },

    _onMouseMove: function (e) {
        var newPos = this._map.mouseEventToLayerPoint(e.originalEvent);
        var latlng = this._map.layerPointToLatLng(newPos);

        // Save latlng
        // should this be moved to _updateGuide() ?
        this._currentLatLng = latlng;

        this._updateTooltip(latlng);

        // Update the guide line
        this._updateGuide(newPos);

        // Update the mouse marker position
        this._mouseMarker.setLatLng(latlng);

        L.DomEvent.preventDefault(e.originalEvent);
    },

    _onZoomEnd: function () {

    },

    _updateTooltip: function (latLng) {
        var text = this._getTooltipText();

        if (latLng) {
            this._tooltip.updatePosition(latLng);
        }

        if (!this._errorShown) {
            this._tooltip.updateContent(text);
        }
    },

    _getTooltipText: function () {
        var showLength = this.options.showLength,
            labelText, distanceStr;

        if (this._markers.length === 0) {
            labelText = {
                text: "Click to start the cut line"
            };
        } else {
            distanceStr = showLength ? this._getMeasurementString() : '';

            if (this._markers.length === 1) {
                labelText = {
                    text: L.drawLocal.draw.handlers.polyline.tooltip.cont,
                    subtext: distanceStr
                };
            } else {
                labelText = {
                    text: L.drawLocal.draw.handlers.polyline.tooltip.end,
                    subtext: distanceStr
                };
            }
        }
        return labelText;
    },

    _updateGuide: function (newPos) {
        var markerCount = this._markers.length;

        if (markerCount > 0) {
            newPos = newPos || this._map.latLngToLayerPoint(this._currentLatLng);

            // draw the guide line
            this._clearGuides();
            this._drawGuide(
                this._map.latLngToLayerPoint(this._markers[markerCount - 1].getLatLng()),
                newPos
            );
        }
    },

    // removes all child elements (guide dashes) from the guides container
    _clearGuides: function () {
        if (this._guidesContainer) {
            while (this._guidesContainer.firstChild) {
                this._guidesContainer.removeChild(this._guidesContainer.firstChild);
            }
        }
    }


});
