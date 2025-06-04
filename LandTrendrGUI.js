/*
===============================================================================
 GEOG 4/581 Final Project - LandTrendr Analysis GUI
 Team: "Kuhisi Kwa Mbali"

 Team Members:
   - Brenda Schuster (schusteb@oregonstate.edu)
   - Dan Parker (parkerd4@oregonstate.edu)
   - PB Echevarría (batistaj@oregonstate.edu)

 Project Title:
   Remote Sensing Change Detection of Above-Ground Biomass (AGB) in Dryland
   Protected Forests of East Africa

 Description:
   This script runs LandTrendr change detection for multiple study areas
   using Google Earth Engine. It provides an interactive GUI for exploring
   change results, RGB composites, and pixel time series for each area.

 Study Areas (from data.js):
   - Chyulu Hills National Park, Kenya
   - Amboseli National Park, Kenya
   - Bale Mountains National Park, Ethiopia
   - Leroghi Forest Reserve, Kenya
   - Marsabit National Park, Kenya
   - Lower Zambezi National Park, Zambia
   - Munyeta Forest Reserve, Zambia

 Usage:
   - Intended for use in the Google Earth Engine Code Editor.
   - Select study areas, indices, and parameters using the GUI.
   - Visualize change maps and time series interactively.

 Dependencies:
   - LandTrendr module:    users/emaprlab/public:Modules/LandTrendr.js
   - LandTrendr UI module: users/emaprlab/public:Modules/LandTrendr-UI.js

 License:
   Copyright (c) 2025 Brenda Schuster, Dan Parker, PB Echevarría
   Licensed under the MIT License: https://opensource.org/licenses/MIT

 If you use this script in a publication or project, please cite the authors.
===============================================================================
*/

print("=== Kuhisi Kwa Mbali ===");

// Load the data, you can change the path to use different datasets
// Uncomment the desired dataset to use

// var data = require("users/elpbatista/GEOG4581:data.js");
var data = require("users/elpbatista/GEOG4581:data-Chyulu_Amboseli.js");
// var data = require("users/elpbatista/GEOG4581:data-Bale_Leroghi_Marsabit.js");
// var data = require("users/elpbatista/GEOG4581:data-LowerZambezi_Munyeta.js");
// var data = require("users/elpbatista/GEOG4581:test_data.js"); // Load test data for demonstration

var locations = data.locations; // Load study area locations from the data module

// Color palette for study areas (ColorBrewer Set1)
var colorBrewer = [
  "#e41a1c",
  "#377eb8",
  "#4daf4a",
  "#984ea3",
  "#ff7f00",
  "#ffff33",
  "#a65628",
  "#f781bf",
];

// Convert locations to ee.FeatureCollection for map centering
var features = locations.map(function (location) {
  return ee.Feature(ee.Geometry(location.geometry), location.properties);
});
var allFeatures = ee.FeatureCollection(features);
var selectedStudyArea = null;
var selectedPoint = [];
var selectedLocationName = null;
var pleaseSelect = "Please select a study area and click a point inside it before submitting.";

var labels = {
  rgbChangeCtrlButton: "RGB Change Options",
  tsCtrlButton: "Pixel Time Series Options",
  clickToSelect: "Click to Select the Study Area",
  clickHere: "Click a point",
};

var styles = {
  button: {
    stretch: "horizontal",
    color: "#222",
    margin: "0 4px 4px 0",
    fontWeight: "bold",
    backgroundColor: "#eaf2fb",
  },
  toggleButton: {
    stretch: "horizontal",
    color: "#3366cc",
  },
  panelLabel: {
    fontWeight: "bold",
    fontSize: "14px",
    margin: "0 0 8px 0",
    color: "#222",
  },
  mapLabel: {
    position: "top-center",
  },
  panel: {
    width: "320px",
    padding: "8px",
    backgroundColor: "#f9f9f9",
    border: "1px solid #ccc",
    borderRadius: "4px",
  },
};

var ltgee = require("users/emaprlab/public:Modules/LandTrendr.js");
var ltgeeUI = require("users/emaprlab/public:Modules/LandTrendr-UI.js");

// ===================== Set Up UI Panel =====================

ui.root.clear();

// ===================== Map Panel Setup ======================

var map = ui.Map();
map.style().set({ cursor: "crosshair" });
map.setOptions("HYBRID");
map.centerObject(allFeatures, 5); // Center the map to show all study areas

// display initial layers
var holder = ee.Image(0).selfMask();
map.layers().set(0, ui.Map.Layer(holder, {}, "RGB Change", false));
map.layers().set(1, ui.Map.Layer(holder, {}, "TS Pixel", false));

// Add a label to the map
map.add(
  ui.Label({
    value: labels.clickHere,
    style: styles.mapLabel,
  })
);

// ------------------ Map Click Event Handler ------------------

map.onClick(function (coords) {
  selectedPoint = [coords.lon, coords.lat];
  print("Clicked at: ", coords.lon + ", " + coords.lat);
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  var found = false;
  function checkLocation(i) {
    if (i >= locations.length || found) {
      // Not found or already found
      if (!found) {
        // selectedStudyArea = null;
        // selectedLocationName = null;
        print(pleaseSelect);
      }
      return;
    }
    var feature = locations[i];
    var geom = ee.Geometry(feature.geometry);
    var name = feature.properties.name;
    geom.contains(point).evaluate(function (isInside) {
      if (found) return; // Already found, skip
      if (isInside) {
        found = true;
        print("Clicked on: ", name);
        if (selectedLocationName !== name) {
          selectedStudyArea = geom;
          selectedLocationName = name;
          plotTheMap();
          map.centerObject(selectedStudyArea, 10);
        }
        plotTimeSeries();
      } else {
        checkLocation(i + 1); // Check next location
      }
    });
  }
  checkLocation(0);
});

// ================= Control Panel Setup ======================

var controlPanel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: { width: "320px" },
});

// ----------------- Location Selection Panel -----------------

var locationTitle = ui.Label({
  value: labels.clickToSelect,
  style: styles.panelLabel
});

var locationPanel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: {
    width: "320px",
    padding: "8px",
  },
});

// Add a title to the locations panel

locationPanel.add(locationTitle);

// Add a button for each location
locations.forEach(function (location, idx) {
  var name = location.properties.name;
  var label = name;
  var study_area = ee.Geometry(location.geometry);
  var color = colorBrewer[idx % colorBrewer.length]; // Use colorBrewer palette

  // Create and add the outline layer for the selected study area
  var outline = ee.FeatureCollection([ee.Feature(study_area)]).style({
    color: color,
    fillColor: "00000000", // transparent fill
    width: 3,
  });
  map.layers().insert(2, ui.Map.Layer(outline, {}, label));
  var button = ui.Button({
    label: label,
    onClick: function () {
      if (selectedLocationName !== name) {
        selectedStudyArea = study_area; // Set the global variable
        selectedLocationName = name;
        plotTheMap();
        map.centerObject(selectedStudyArea, 10);
      }
    },
    style: styles.button,
  });
  locationPanel.add(button);
});


// ------------------ RGB Change Panel Setup ------------------

var colYearsPanel = ltgeeUI.colYearsPanel();
var colDatesPanel = ltgeeUI.colDatesPanel();
var indexSelectPanel = ltgeeUI.indexSelectPanel();
var rgbYearsPanel = ltgeeUI.rgbYearsPanel();
var maskPanel = ltgeeUI.maskSelectPanel();
var bufferPanel = ltgeeUI.bufferPanel({});
var paramPanel = ltgeeUI.paramPanel();

var rgbChangeCtrlPanel = addCtrlPanel(
  [
    colYearsPanel,
    colDatesPanel,
    indexSelectPanel,
    rgbYearsPanel,
    maskPanel,
    bufferPanel,
    paramPanel,
  ]
);

var rgbChangeCtrlButton = ui.Button({
  label: labels.rgbChangeCtrlButton + " >>",
  style: styles.toggleButton,
});

// ------------------- Time Series Panel Setup -------------------

var colYearsPanelTS = ltgeeUI.colYearsPanel();
var colDatesPanelTS = ltgeeUI.colDatesPanel();
var indexBoxesTSdict = ltgeeUI.indexSelectPanelTS();
var indexBoxesTS = indexBoxesTSdict.ui;
var indexListTS = indexBoxesTSdict.list;
var indexLabelTS = ui.Label("Select Indices", { fontWeight: "bold" });
var indexPanelTS = ui.Panel(
  [
    ui.Panel(
      [
        indexBoxesTS[0],
        indexBoxesTS[4],
        indexBoxesTS[8],
        indexBoxesTS[12],
        indexBoxesTS[16],
      ],
      null,
      { stretch: "horizontal" }
    ),
    ui.Panel(
      [indexBoxesTS[1], indexBoxesTS[5], indexBoxesTS[9], indexBoxesTS[13]],
      null,
      { stretch: "horizontal" }
    ),
    ui.Panel(
      [indexBoxesTS[2], indexBoxesTS[6], indexBoxesTS[10], indexBoxesTS[14]],
      null,
      { stretch: "horizontal" }
    ),
    ui.Panel(
      [indexBoxesTS[3], indexBoxesTS[7], indexBoxesTS[11], indexBoxesTS[15]],
      null,
      { stretch: "horizontal" }
    ),
  ],
  ui.Panel.Layout.Flow("horizontal"),
  { stretch: "horizontal" }
);
indexBoxesTS[0].setValue(1);

var indexSelectPanelTS = ui.Panel([indexLabelTS, indexPanelTS], null, {
  stretch: "horizontal",
});
var maskPanelTS = ltgeeUI.maskSelectPanel();
var bufferPanelTS = ltgeeUI.bufferPanel({
  panelLabel: "Define a pixel size for time series (m)",
  varLabel: "Size:",
  defVar: 90,
});
var paramPanelTS = ltgeeUI.paramPanel();

var tsCtrlPanel = addCtrlPanel(
  [
    colYearsPanelTS,
    colDatesPanelTS,
    indexSelectPanelTS,
    maskPanelTS,
    bufferPanelTS,
    paramPanelTS,
  ]
);

var tsCtrlButton = ui.Button({
  label: labels.tsCtrlButton + " >>",
  style: styles.toggleButton,
});

// ------------------ Toggle Logic ------------------
var togglePanelsList = [
  {panel: rgbChangeCtrlPanel, button: rgbChangeCtrlButton, label: labels.rgbChangeCtrlButton},
  {panel: tsCtrlPanel, button: tsCtrlButton, label: labels.tsCtrlButton}
];

function togglePanel(panelObj) {
  var isOpen = panelObj.panel.style().get("shown");
  togglePanelsList.forEach(function(obj) {
    obj.panel.style().set("shown", false);
    obj.button.setLabel(obj.label + " >>");
  });
  if (!isOpen) {
    panelObj.panel.style().set("shown", true);
    panelObj.button.setLabel(panelObj.label + " <<");
  }
}

togglePanelsList.forEach(function(obj) {
  obj.button.onClick(function() {
    togglePanel(obj);
  });
});

// ------------------- Submit Button Logic -------------------

var submitButton = ui.Button({
  label: "Apply Changes",
  style: styles.button,
});

submitButton.onClick(function () {
  var canPlotMap = !!selectedStudyArea;
  var canPlotTS = Array.isArray(selectedPoint) && selectedPoint.length === 2;

  if (!canPlotMap && !canPlotTS) {
    print(pleaseSelect);
    return;
  }
  if (canPlotMap) {
    plotTheMap();
  }
  if (canPlotTS) {
    plotTimeSeries();
  }
});

// ------------------ Add to Control Panel ------------------

controlPanel.add(locationPanel);
controlPanel.add(rgbChangeCtrlButton);
controlPanel.add(rgbChangeCtrlPanel);
controlPanel.add(tsCtrlButton);
controlPanel.add(tsCtrlPanel);
controlPanel.add(submitButton);

// ===================== Plots Panel Setup =====================

var plotPanel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: { width: "480px" },
});

// plot panel children
var plotsPanelLabel = ui.Label("LandTrendr Time Series Plots", {
  fontWeight: "bold",
  stretch: "horizontal",
});
var plotHolder = ui.Panel({ style: { stretch: "horizontal" } });

// add plot panel children to parent
plotPanel.add(plotsPanelLabel);
plotPanel.add(plotHolder);

// rgb change mapping function
var plotTheMap = function () {
  var runParams = ltgeeUI.getParams(paramPanel);
  runParams.timeSeries = ee.ImageCollection([]);
  var colYrs = ltgeeUI.colYearsGet(colYearsPanel);
  var colDates = ltgeeUI.colDatesGet(colDatesPanel);
  var index = ltgeeUI.indexSelectGet(indexSelectPanel);
  var rgbYears = ltgeeUI.rgbYearsGet(rgbYearsPanel);
  // var masked = ltgeeUI.getMaskSelect(maskPanel); //////////////////////   TODO - this is not working 

  var aoi = selectedStudyArea;

  var rgbVis = ltgee.mapRGBcomposite(
    index,
    colYrs.startYear,
    colYrs.endYear,
    colDates.startDate,
    colDates.endDate,
    rgbYears.red,
    rgbYears.green,
    rgbYears.blue,
    aoi,
    runParams,
    2
  );
  // map.setCenter(coords.lon, coords.lat);
  map.layers().set(0, ui.Map.Layer(rgbVis, null, "RGB Change"));
};

// function to draw plots of source and fitted time series to panel
var plotTimeSeries = function () {
  // get values to define year and date window for image collection
  plotHolder = plotHolder.clear();
  var runParams = ltgeeUI.getParams(paramPanel);
  var colYrs = ltgeeUI.colYearsGet(colYearsPanelTS);
  var colDates = ltgeeUI.colDatesGet(colDatesPanelTS);
  var buffer = ltgeeUI.getBuffer(bufferPanelTS);
  var point = ee.Geometry.Point(selectedPoint[0], selectedPoint[1]);
  var pixel = point.buffer(ee.Number(buffer).divide(2)).bounds();

  // add the target pixel to the map
  map.layers().set(1, ui.Map.Layer(pixel, { color: "FF0000" }, "Target"));

  var doTheseIndices = [];
  indexBoxesTS.forEach(function (name, index) {
    var isChecked = indexBoxesTS[index].getValue();
    if (isChecked) {
      doTheseIndices.push([indexListTS[index][0], indexListTS[index][1]]);
    }
  });

  // make an annual SR collection
  var annualSRcollection = ltgee.buildSRcollection(
    colYrs.startYear,
    colYrs.endYear,
    colDates.startDate,
    colDates.endDate,
    pixel
  );

  // for each selected index, draw a plot to the plot panel
  doTheseIndices.forEach(function (name, index) {
    var annualLTcollection = ltgee.buildLTcollection(
      annualSRcollection,
      name[0],
      []
    );
    runParams.timeSeries = annualLTcollection;
    var lt = ee.Algorithms.TemporalSegmentation.LandTrendr(runParams);
    var chart = chartPoint(lt, pixel, name[0], name[1], buffer);
    plotHolder.add(chart);
  });
};

var chartPoint = function (lt, pixel, index, indexFlip, scale) {
  var pixelTimeSeriesData = ltPixelTimeSeriesArray(lt, pixel, indexFlip, scale);
  return ui.Chart(
    pixelTimeSeriesData.ts,
    "LineChart",
    {
      title:
        "Index: " +
        index +
        " | Fit RMSE:" +
        (Math.round(pixelTimeSeriesData.rmse * 100) / 100).toString(),
      hAxis: {
        format: "####",
      },
      vAxis: {
        maxValue: 1000,
        minValue: -1000,
      },
    },
    { columns: [0, 1, 2] }
  );
};

// RETURN LT RESULTS FOR A SINGLE PIXEL AS AN OBJECT
var ltPixelTimeSeries = function (img, pixel, scale) {
  return img
    .reduceRegion({
      reducer: "first",
      geometry: pixel,
      scale: scale,
    })
    .getInfo();
};

// PARSE OBJECT RETURNED FROM 'getPoint' TO ARRAY OF SOURCE AND FITTED
function ltPixelTimeSeriesArray(lt, pixel, indexFlip, scale) {
  var pixelTS = ltPixelTimeSeries(lt, pixel, scale);
  if (pixelTS.LandTrendr === null) {
    pixelTS.LandTrendr = [
      [0, 0],
      [0, 0],
      [0, 0],
    ];
  }
  var data = [["Year", "Original", "Fitted"]];
  var len = pixelTS.LandTrendr[0].length;
  for (var i = 0; i < len; i++) {
    data = data.concat([
      [
        pixelTS.LandTrendr[0][i],
        pixelTS.LandTrendr[1][i] * indexFlip,
        pixelTS.LandTrendr[2][i] * indexFlip,
      ],
    ]);
  }
  return { ts: data, rmse: pixelTS.rmse };
}

// ===================== Add UI Components to Root =====================

ui.root.add(controlPanel);
ui.root.add(map);
ui.root.add(plotPanel);

// -------------------------------------------

/**
 * Creates a vertical control panel with optional widgets and style.
 * @param {Array} [widgets] - Optional array of ui.Widget objects to add to the panel.
 * @param {Object} [panelStyle] - Optional style overrides for the panel.
 * @returns {ui.Panel} The constructed control panel.
 */
function addCtrlPanel(widgets, panelStyle, hide) {
  var style = panelStyle || { width: "320px" };
  var panel = ui.Panel({
    layout: ui.Panel.Layout.flow("vertical"),
    style: style
  });
    panel.style().set('shown', false);
  if (Array.isArray(widgets)) {
    widgets.forEach(function(widget) {
      panel.add(widget);
    });
  }
  return panel;
}