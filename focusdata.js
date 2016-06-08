var FocusData = Class.extend(function () {

    var type = null;
    var url = null;
    var version = null;
    var owner = null;
    var creationDateTime = null;
    var editor = null;
    var editionDateTime = null;
    var active = null;
    var data = null;

    this.getType = function () {
        return type;
    };

    this.setType = function (value) {
        type = value;
    };

    this.getURL = function () {
        return url;
    };

    this.setURL = function (value) {
        url = value;
    };

    this.getVersion = function () {
        return version;
    };

    this.setVersion = function (value) {
        version = value;
    };

    this.getOwner = function () {
        return owner;
    };

    this.setOwner = function (value) {
        owner = value;
    };

    this.getCreationDateTime = function () {
        return creationDateTime;
    };

    this.setCreationDateTime = function (value) {
        creationDateTime = value;
    };

    this.getEditor = function () {
        return editor;
    };

    this.setEditor = function (value) {
        editor = value;
    };

    this.getEditionDateTime = function () {
        return editionDateTime;
    };

    this.setEditionDateTime = function (value) {
        editionDateTime = value;
    };

    this.getActive = function () {
        return active;
    };

    this.setActive = function (value) {
        active = value;
    };

    this.getData = function () {
        return data;
    };

    this.setData = function (value) {
        data = value;
    };

    this.fromJSON = function (json) {
        try {
            if (json.hasOwnProperty('active')) {
                this.setActive(json.active);
            }

            if (json.hasOwnProperty('creationDateTime')) {
                this.setCreationDateTime(json.creationDateTime);
            }

            if (json.hasOwnProperty('editionDateTime')) {
                this.setEditionDateTime(json.editionDateTime);
            }

            if (json.hasOwnProperty('editor')) {
                this.setEditor(json.editor);
            }

            if (json.hasOwnProperty('owner')) {
                this.setOwner(json.owner);
            }

            if (json.hasOwnProperty('type')) {
                this.setType(json.type);
            }

            if (json.hasOwnProperty('url')) {
                this.setURL(json.url);
            }

            if (json.hasOwnProperty('version')) {
                this.setVersion(json.version);
            }

            if (json.hasOwnProperty('data')) {
                this.setData(json.data);
            }
        } catch (error) {
            console.warn(error);
        }
    }
});

var FocusRootData = FocusData.extend(function () {

    var projects = [];

    this.getProjects = function () {
        return projects;
    };

    this.setProejcts = function (value) {
        projects = value;
    };

    this.loadProjects = function () {
        console.log("loadProjects");
        var me = this, queueDone = 0;

        return new Promise(function (resolve, reject) {
            var data = me.getData();

            if (data.hasOwnProperty('project_urls')) {
                var projectURLs = data['project_urls'];

                console.log("Loading " + projectURLs.length + " projects...");

                for (var i = 0; i < projectURLs.length; ++i) {
                    var url = projectURLs[i];
                    loadProject(url).then(function (content) {
                        projects.push(content);
                        queueDone++;

                        if (queueDone == projectURLs.length) {
                            resolve("all projects loaded succesfully")
                        }
                    });
                }
            }
        });
    };

    function loadProject(url) {
        console.log("loadProject " + url);

        var me = this;

        return new Promise(function (resolve, reject) {
            var xmlhttp = new XMLHttpRequest();

            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {

                    if (xmlhttp.response) {
                        var project = new FocusProjectData();
                        project.fromJSON(JSON.parse(xmlhttp.responseText));

                        project.loadStands().then(function (content) {
                            console.log(content);
                            resolve(project);
                        })
                    }
                }
            };

            xmlhttp.open("GET", url, true);
            xmlhttp.setRequestHeader("FOCUS-FOREST-API-KEY", apikey);
            xmlhttp.send();
        });
    }
});

var FocusProjectData = FocusData.extend(function () {
    var stands = [];

    this.getStands = function () {
        return stands;
    };

    this.setStands = function (value) {
        stands = value;
    };

    this.loadStands = function () {
        console.log("loadStands");
        var me = this, queueDone = 0;

        return new Promise(function (resolve, reject) {
            var data = me.getData();

            if (data.hasOwnProperty('stands_urls')) {
                var standURLs = data['stands_urls'];

                console.log("Loading " + standURLs.length + " stands...");

                for (var i = 0; i < standURLs.length; ++i) {
                    var url = standURLs[i];
                    loadStand(url).then(function (content) {
                        if (content != null) {
                            stands.push(content);
                        }
                        queueDone++;

                        if (queueDone == standURLs.length) {
                            resolve("all stands loaded succesfully")
                        }
                    });
                }
            }
        });
    };

    function loadStand(url) {
        console.log("loadStand " + url);

        var me = this;

        return new Promise(function (resolve, reject) {
            var xmlhttp = new XMLHttpRequest();

            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {

                    if (xmlhttp.response) {
                        var stand = new FocusStandData();
                        try {
                            var json = JSON.parse(xmlhttp.responseText);
                        } catch (error) {
                            console.warn(error);
                        }
                        stand.fromJSON(json);
                        resolve(stand);
                    }
                }
            };
            xmlhttp.open("GET", url, true);
            xmlhttp.setRequestHeader("FOCUS-FOREST-API-KEY", apikey);
            xmlhttp.send();
        });
    }
});

var FocusStandData = FocusData.extend(function () {
    var me = this;

    this.getGeoJSON = function () {
        var data = me.getData();

        if (data && data.hasOwnProperty('geojson')) {
            var geojson = JSON.parse(data['geojson']);
            return geojson;
        } else {
            return null;
        }
    };
});