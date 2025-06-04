/*
===============================================================================
 GEOG 4/581 Final Project - LandTrendr Analysis Script
 Team: "Kuhisi Kwa Mbali"

 Team Members:
   - Brenda Schuster (schusteb@oregonstate.edu)
   - Dan Parker (parkerd4@oregonstate.edu)
   - PB Echevarría (batistaj@oregonstate.edu)

 Project Title:
   Remote Sensing Change Detection of Above-Ground Biomass (AGB) in Dryland
   Protected Forests of East Africa

 Project Description:
   We hypothesize that remote sensing change detection will show a difference
   in Above-Ground Biomass (AGB) trends between:
     (a) Protected forests
     (b) Protected forests enrolled in a carbon offset scheme
   in the drylands of East Africa.

 Methodology:
   - Acquire Landsat imagery for multiple study locations.
   - Use the LandTrendr algorithm to detect and quantify AGB change.
   - Analyze NDVI and other indices over a ten-year period.
   - Compare trends between protected areas and those with carbon offset schemes.

 Study Areas (from data.js):
   - Chyulu Hills National Park, Kenya
   - Amboseli National Park, Kenya
   - Bale Mountains National Park, Ethiopia
   - Leroghi Forest Reserve, Kenya
   - Marsabit National Park, Kenya
   - Lower Zambezi National Park, Zambia
   - Munyeta Forest Reserve, Zambia

 Script Purpose:
   - Run LandTrendr change detection for each study area.
   - Visualize change magnitude, year of detection, duration, and prevalence.

 Usage:
   - This script is intended for use in the Google Earth Engine Code Editor.
   - Data modules can be swapped by changing the require() path near the top.
   - Outputs include map layers and interactive controls for each study area.

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

var locations = data.locations; // Load study area locations from the data module

// Load the LandTrendr.js module
var ltgee = require("users/emaprlab/public:Modules/LandTrendr.js");

// ===================== Set Up UI Panel =====================

// Create a vertical panel for map controls
var panel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: { width: "200px" },
});
panel.add(ui.Label("Click to center map"));

// Add the panel to the Earth Engine UI
ui.root.insert(0, panel);

// ===================== Visualization and Analysis Parameters =====================

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

// LandTrendr temporal and index parameters
var startYear = 2014;
var endYear = 2024;
var startDay = "04-15";
var endDay = "06-15";
var index = "NBR"; // Normalized Burn Ratio Index
var maskThese = ["cloud", "shadow", "snow", "water"];

// LandTrendr run parameters
var runParams = {
  maxSegments: 6,
  spikeThreshold: 0.9,
  vertexCountOvershoot: 3,
  preventOneYearRecovery: true,
  recoveryThreshold: 0.25,
  pvalThreshold: 0.05,
  bestModelProportion: 0.75,
  minObservationsNeeded: 6,
};

// Change detection parameters
var changeParams = {
  delta: "gain",
  sort: "greatest",
  year: { checked: true, start: startYear, end: endYear },
  mag: { checked: true, value: 300, operator: ">" },
  dur: { checked: false, value: 4, operator: "<" },
  preval: { checked: false, value: 300, operator: ">" },
  mmu: { checked: false, value: 11 },
  index: index, // Add index to changeParams
};

// Visualization palettes for LandTrendr output layers
var palette = [
  "#9400D3",
  "#4B0082",
  "#0000FF",
  "#00FF00",
  "#FFFF00",
  "#FF7F00",
  "#FF0000",
];
var yodVizParms = { min: startYear, max: endYear, palette: palette };
var magVizParms = { min: 200, max: 800, palette: palette };
var durVizParms = { min: 0, max: 10, palette: palette };
var prevalVizParms = { min: 0, max: 100, palette: palette };

// ===================== Run LandTrendr for Each Study Area =====================

// Convert locations to ee.FeatureCollection for map centering
var features = locations.map(function (location) {
  return ee.Feature(ee.Geometry(location.geometry), location.properties);
});
var allFeatures = ee.FeatureCollection(features);

// Center the map to show all study areas
Map.centerObject(allFeatures, 9);

locations.forEach(function (location, idx) {
  // Extract label and color for this study area
  var label = location.properties.name;
  var color = colorBrewer[idx % colorBrewer.length]; // Cycle colors if needed
  var study_area = ee.Geometry(location.geometry);

  var outline = ee.FeatureCollection([ee.Feature(study_area)]).style({
    color: color,
    fillColor: "00000000", // transparent fill
    width: 2,
  });
  Map.addLayer(outline, {}, label + " Study Area");

  // Add a button to center the map on this study area
  var button = ui.Button({
    label: label,
    onClick: function () {
      Map.centerObject(study_area, 11);
    },
  });
  panel.add(button);

  // Run LandTrendr for this study area
  var lt = ltgee.runLT(
    startYear,
    endYear,
    startDay,
    endDay,
    study_area,
    index,
    [],
    runParams,
    maskThese
  );

  // Get LandTrendr change map and display key bands
  var changeImg = ltgee.getChangeMap(lt, changeParams).clip(study_area);
  Map.addLayer(changeImg.select("mag"), magVizParms, "Magnitude of Change");
  Map.addLayer(changeImg.select("yod"), yodVizParms, "Year of Detection");
  Map.addLayer(changeImg.select("dur"), durVizParms, "Duration of Change");
  Map.addLayer(changeImg.select("preval"),prevalVizParms,"Prevalence of Change");

});
