/*
===============================================================================
 GEOG 4/581 Final Project - Sentinel Analysis Script
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

 Study Areas (from data.js):
   - Chyulu Hills National Park, Kenya
   - Amboseli National Park, Kenya
   - Bale Mountains National Park, Ethiopia
   - Leroghi Forest Reserve, Kenya
   - Marsabit National Park, Kenya
   - Lower Zambezi National Park, Zambia
   - Munyeta Forest Reserve, Zambia

 Script Purpose:
   - Generate results for the final project deliverable, following the project plan.
   - Implements both NDRE1 and SAR Analysis & Sentinel-2 Analysis.

 Usage:
   - This script is intended for use in the Google Earth Engine Code Editor.
   - Data modules can be swapped by changing the require() path near the top.
   - Outputs include map layers and summary charts for each study area.

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
// var data = require("users/elpbatista/GEOG4581:data-Chyulu_Amboseli.js");
// var data = require("users/elpbatista/GEOG4581:data-Bale_Leroghi_Marsabit.js");
// var data = require("users/elpbatista/GEOG4581:data-LowerZambezi_Munyeta.js");
var data = require("users/elpbatista/GEOG4581:test_data.js");

var locations = data.locations;

var panel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: { width: "200px" },
});
panel.add(ui.Label("Click to center map"));

// Add the panel to the UI
ui.root.insert(0, panel);

// Create ee.Feature for each location
var features = locations.map(function (location) {
  return ee.Feature(ee.Geometry(location.geometry), location.properties);
});

// Combine all features into a single FeatureCollection
var allFeatures = ee.FeatureCollection(features);

// Center the map to show all features
Map.centerObject(allFeatures, 9);

// Example ColorBrewer palette (Set1, 8 colors)
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

var years = [2019, 2024];
var v1_years = [2020, 2021];
var v2_years = [2020, 2024];
var start = "04-15";
var end = "06-15";

// Initialize dictionaries to store NDRE1 and SAR composites for each year
// var ndre1 = {};
// var vv = {};

// Add a layer for each feature in the FeatureCollection with a unique color outline

locations.forEach(function (feature, idx) {
  print("Location: " + feature.properties.name);
  do_something_else();
  print("----------------------");
  // var fc = ee.FeatureCollection([ee.Feature(feature)]);
  var label = feature.properties.name;
  var color = colorBrewer[idx % colorBrewer.length]; // Cycle through palette if more features than colors
  var study_area = ee.Geometry(feature.geometry);
  var outline = ee.FeatureCollection([ee.Feature(study_area)]).style({
    color: color,
    fillColor: "00000000", // transparent fill
    width: 2,
  });
  Map.addLayer(outline, {}, label + " Study Area");

  var button = ui.Button({
    label: label,
    onClick: function () {
      Map.centerObject(study_area, 11);
    },
  });

  panel.add(button);

  // Run Version 1 analysis
  // runVersion1(study_area, label, v1_years, start, end);

  // Run Version 2 analysis
  // runVersion2(study_area, label, v2_years, start, end);

  // Run Validation analysis (if needed)
  runValidation(study_area, label, v2_years, start, end);

});

// Function for exemplary purposes
function do_something_else() {
  // This function is just a placeholder for future code
  print("Coming soon...");
}

/**
 * Returns a cloud-free Sentinel-2 composite clipped to the given feature.
 * @param {ee.Geometry|ee.Feature} study_area - The study area geometry or feature.
 * @param {string} startDate - Start date (e.g., '2022-01-01').
 * @param {string} endDate - End date (e.g., '2022-12-31').
 * @return {ee.Image} Cloud-free composite image clipped to area.
 */
function getS2Composite(study_area, startDate, endDate) {
  // Cloud mask function using QA60 band
  function maskS2clouds(image) {
    var qa = image.select("QA60");
    // Bits 10 and 11 are clouds and cirrus, respectively.
    var cloudBitMask = 1 << 10;
    var cirrusBitMask = 1 << 11;
    var mask = qa
      .bitwiseAnd(cloudBitMask)
      .eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
    return image.updateMask(mask).divide(10000);
  }

  function maskS2cloudSCL(image) {
    var scl = image.select("SCL");
    // Mask cloud, cloud shadows, etc.
    var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
    return image.updateMask(mask);
  }

  // Load and filter the collection
  var collection = ee
    .ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(study_area)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
    .map(maskS2cloudSCL);

  var composite = collection
    .select(["B4", "B5", "B8"])
    // .copyProperties(image, ["system:time_start"])
    .median()
    .clip(study_area);

  return composite;
}

/**
 * Returns a Sentinel-1 SAR composite (VV and VH) clipped to the given feature.
 * @param {ee.Geometry|ee.Feature} study_area - The study area geometry or feature.
 * @param {string} startDate - Start date (e.g., '2022-01-01').
 * @param {string} endDate - End date (e.g., '2022-12-31').
 * @return {ee.Image} Median composite image (VV, VH) clipped to area.
 */
function getS1Composite(study_area, startDate, endDate) {
  // Load and filter the collection
  var collection = ee
    .ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(study_area)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
    // .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"));

  var composite = collection
    // .select(['VV', 'VH'])
    .select("VV")
    .median()
    .clip(study_area);

  return composite;
}

// Calculate NDRE1 from Sentinel-2 composite
function addNDRE1(image) {
  var ndre1 = image.normalizedDifference(["B8", "B5"]).rename("NDRE1");
  return image.addBands(ndre1);
}

// Calculate NDVI from Sentinel-2 composite
function addNDVI(image) {
  var ndvi = image.normalizedDifference(["B8", "B4"])
    .multiply(1000)
    .toInt()
    .rename("NDVI");
  return image.addBands(ndvi);
}

// ======================= Version 1: NDRE1 and SAR Analysis =======================
function runVersion1(study_area, label, years, start, end) {
  var ndre1 = {};
  var vv = {};

  years.forEach(function (year) {
    var startDate = year + "-" + start;
    var endDate = year + "-" + end;

    // Sentinel-1 composite (VV)
    vv[year] = getS1Composite(study_area, startDate, endDate);

    // Sentinel-2 composite
    var s2Composite = getS2Composite(study_area, startDate, endDate);

    // S2 + S1 composite for visualization
    var composite = s2Composite.addBands(vv[year].rename("VV"));
    print("Composite Image: ", composite);
    Map.addLayer(
      composite,
      { bands: ["B8", "B5", "VV"], min: 0, max: [3000, 3000, 0.05] },
      label + " S2 + S1 " + year
    );

    // Calculate and store NDRE1
    ndre1[year] = addNDRE1(s2Composite);
    Map.addLayer(
      ndre1[year].select("NDRE1"),
      { min: 0, max: 1, palette: ["blue", "white", "green"] },
      label + " NDRE1 " + year
    );
  });

  // Change detection for NDRE1
  if (ndre1[v1_years[0]] && ndre1[v1_years[1]]) {
    var ndre1Change = ndre1[v1_years[1]]
      .select("NDRE1")
      .subtract(ndre1[v1_years[0]].select("NDRE1"))
      .rename("NDRE1_Change");
    Map.addLayer(
      ndre1Change,
      { min: -0.5, max: 0.5, palette: ["red", "white", "green"] },
      label + " NDRE1 Change " + v1_years[0] + "-" + v1_years[1]
    );
  }

  // Change detection for SAR VV
  if (vv[v1_years[0]] && vv[v1_years[1]]) {
    var vvChange = vv[v1_years[1]]
      .select("VV")
      .subtract(vv[v1_years[0]].select("VV"))
      .rename("VV_Change");
    Map.addLayer(
      vvChange,
      { min: -3, max: 3, palette: ["purple", "white", "orange"] },
      label + " SAR VV Change " + v1_years[0] + "-" + v1_years[1]
    );
  }
}

// ======================= Version 2: Sentinel-2 =======================
function runVersion2(study_area, label, years, start, end) {
  var ndre1 = {};

  years.forEach(function (year) {
    var startDate = year + "-" + start;
    var endDate = year + "-" + end;

    // Sentinel-2 composite
    var s2Composite = getS2Composite(study_area, startDate, endDate);
    print(study_area + " S2 Composite " + year, s2Composite);
    // Calculate and store NDRE1
    ndre1[year] = addNDRE1(s2Composite);
  });

  // Change detection for NDRE1
  if (ndre1[v2_years[0]] && ndre1[v2_years[1]]) {
    var ndre1Change = ndre1[v2_years[1]]
      .select("NDRE1")
      .subtract(ndre1[v2_years[0]].select("NDRE1"))
      .rename("NDRE1_Change");
    Map.addLayer(
      ndre1Change,
      { min: -0.5, max: 0.5, palette: ["red", "white", "green"] },
      label + " NDRE1 Change " + v2_years[0] + "-" + v2_years[1]
    );
    // show histogram
    var histogram = ndre1Change.reduceRegion({
      reducer: ee.Reducer.histogram(),
      geometry: study_area,
      scale: 30,
      maxPixels: 1e13,
    });
    print(
      label + " NDRE1 Change Histogram " + v2_years[0] + "-" + v2_years[1],
      histogram
    );

    // visualize histogram
    var histogramVis = ui.Chart.image.histogram({
      image: ndre1Change,
      region: study_area,
      scale: 30,
      minBucketWidth: 0.01,
      maxBuckets: 100,
    });
    histogramVis.setOptions({
      title:
        label + " NDRE1 Change Histogram " + v2_years[0] + "-" + v2_years[1],
      hAxis: { title: "NDRE1 Change" },
      vAxis: { title: "Frequency" },
      lineWidth: 1,
      pointSize: 3,
    });
    print(histogramVis);
  }

  // Create a legend panel
  var legend = ui.Panel({
    style: {
      position: "bottom-left",
      padding: "8px 15px",
    },
  });

  // Add a title to the legend
  legend.add(
    ui.Label({
      value: "NDRE1 Change",
      style: { fontWeight: "bold", fontSize: "14px", margin: "0 0 4px 0" },
    })
  );

  // Add color swatches and labels for NDRE1 Change
  var makeRow = function (color, name) {
    var colorBox = ui.Label("", {
      backgroundColor: color,
      padding: "8px",
      margin: "0 0 4px 0",
    });
    var description = ui.Label(name, { margin: "0 0 4px 6px" });
    return ui.Panel(
      [colorBox, description],
      ui.Panel.Layout.Flow("horizontal")
    );
  };

  // Add rows for your palette (adjust as needed)
  legend.add(makeRow("red", "Decrease"));
  legend.add(makeRow("white", "No Change"));
  legend.add(makeRow("green", "Increase"));

  // Add the legend to the map
  Map.add(legend);
}

// ======================= Version 3: Sentinel-2 Validation =======================

// This section is for future validation work using Sentinel-2 data

function runValidation(study_area, label, years, start, end) {
  var ndvi = {};
  years.forEach(function (year) {
    var startDate = year + "-" + start;
    var endDate = year + "-" + end;
    // NDVI composite
    var s2Composite = getS2Composite(study_area, startDate, endDate);
    ndvi[year] = addNDVI(s2Composite);

    // --- Unsupervised classification ---

    // Develop a sample of points for use in unsupervised classification
    var training = s2Composite.sample({
      region: study_area, // 50 km buffer around point
      scale: 30,
      numPixels: 500,
      seed: 42,
    });

    // Use KMeans to build a model that clusters the sample of points
    var clusterer = ee.Clusterer.wekaKMeans(4).train(training);

    // Apply the kmeans clusterer to all of the pixels in the image
    var result = s2Composite.cluster(clusterer);

    // 5. Add it to the map!
    Map.addLayer(result.randomVisualizer(), {}, "KMeans Clusters " + year);
  });

  // Change detection for NDVI
  if (ndvi[v2_years[0]] && ndvi[v2_years[1]]) {
    var ndviChange = ndvi[v2_years[1]]
      .select("NDVI")
      .subtract(ndvi[v2_years[0]].select("NDVI"))
      .rename("NDVI_Change");
    // Uncomment to visualize NDVI change
    Map.addLayer(
      ndviChange,
      { min: -500, max: 500, palette: ["red", "white", "green"] },
      label + " NDVI Change " + v2_years[0] + "-" + v2_years[1]
    );

    // Threshold for NDVI change mask (adjust as needed)
    var NDVI_threshold = -200;
    var ndviChangeMask = ndviChange.lt(NDVI_threshold);
    var ndviChangeMasked = ndviChangeMask.updateMask(ndviChangeMask);

    // Visualization parameters for the mask
    var threshViz = { min: 0, max: 1, palette: ["000000", "990000"] };

    // Add masked NDVI change to the map, clipped to the study area
    Map.addLayer(
      ndviChangeMasked.clip(study_area),
      threshViz,
      label + " NDVI Change Mask " + v2_years[0] + "-" + v2_years[1]
    );

    // Stratified random sample from the masked NDVI change
    var sampleSize = 50; // Adjust sample size as needed

    var sample = ndviChangeMasked.stratifiedSample({
      numPoints: sampleSize,
      classBand: "NDVI_Change",
      region: study_area,
      scale: 30,
      geometries: true,
    });

    var seed = 42;
    var rand_st_points = sample.randomColumn("random", seed).sort("random");
    var numpoints = rand_st_points.size();
    print("Number of sample points: ", numpoints);

    var combined1 = rand_st_points
      .toList(numpoints)
      .zip(ee.List.sequence(0, numpoints))
      .map(function (list) {
        list = ee.List(list);
        return ee
          .Feature(list.get(0))
          .set("ID", ee.String(ee.Number(list.get(1)).toInt()));
      });

    var rand_st_points_comb = ee.FeatureCollection(combined1);

    // Add the stratified random sample points to the map
    Map.addLayer(
      rand_st_points_comb,
      { color: "orange" },
      label + " Sample Points"
    );

    // Export the masked NDVI change image
    Export.image.toDrive({
      image: ndviChangeMasked.clip(study_area),
      description: label + "_NDVI_Change",
      scale: 30,
      region: study_area,
      maxPixels: 1e13,
      folder: "GEE_Exports",
    });

    // Export the stratified random sample points to Drive
    Export.table.toDrive({
      collection: rand_st_points_comb,
      description: label + "_NDVI_Sample",
      fileFormat: "CSV",
      folder: "GEE_Exports",
    });
  }
}