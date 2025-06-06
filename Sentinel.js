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
   - Generate spatial and statistical results for the final project deliverable, following the project plan.
   - Implements NDRE1 and SAR Analysis, as well as Sentinel-2 change detection, stratified sampling, and validation workflows.
   - Produces map layers, summary charts, and exportable validation samples for each study area.

 License:
   Copyright (c) 2025 Brenda Schuster, Dan Parker, PB Echevarría
   Licensed under the MIT License: https://opensource.org/licenses/MIT

 If you use this script in a publication or project, please cite the authors.
===============================================================================
*/

print("=== Kuhisi Kwa Mbali ===");

// -----------------------------------------------------------------------------
// Load study area data (choose the appropriate dataset by uncommenting)
// -----------------------------------------------------------------------------

// var data = require("users/elpbatista/GEOG4581:data.js");
// var data = require("users/elpbatista/GEOG4581:data-Chyulu_Amboseli.js");
var data = require("users/elpbatista/GEOG4581:data-Bale_Leroghi_Marsabit.js");
// var data = require("users/elpbatista/GEOG4581:data-LowerZambezi_Munyeta.js");
// var data = require("users/elpbatista/GEOG4581:test_data.js");

var locations = data.locations;

// -----------------------------------------------------------------------------
// Set up UI panel for map navigation
// -----------------------------------------------------------------------------

var panel = ui.Panel({
  layout: ui.Panel.Layout.flow("vertical"),
  style: { width: "200px" },
});
panel.add(ui.Label("Click to center map"));
ui.root.insert(0, panel);

// -----------------------------------------------------------------------------
// Prepare FeatureCollection of all study areas and center map
// -----------------------------------------------------------------------------

var features = locations.map(function (location) {
  return ee.Feature(ee.Geometry(location.geometry), location.properties);
});
var allFeatures = ee.FeatureCollection(features);
Map.centerObject(allFeatures, 6);

// -----------------------------------------------------------------------------
// Define color palette for study area outlines
// -----------------------------------------------------------------------------

var colorBrewer = [
  "#e41a1c", "#377eb8", "#4daf4a", "#984ea3",
  "#ff7f00", "#ffff33", "#a65628", "#f781bf",
];

// Define year ranges and date window for analysis
var v1_years = [2020, 2021];
var v2_years = [2020, 2024];
var start = "04-15";
var end = "06-15";

// -----------------------------------------------------------------------------
// Add study area outlines, navigation buttons, and run analyses
// -----------------------------------------------------------------------------

locations.forEach(function (feature, idx) {
  print("Location: " + feature.properties.name);
  print("----------------------");
  var label = feature.properties.name;
  var color = colorBrewer[idx % colorBrewer.length];
  var study_area = ee.Geometry(feature.geometry);

  // Add study area outline to the map
  var outline = ee.FeatureCollection([ee.Feature(study_area)]).style({
    color: color,
    fillColor: "00000000",
    width: 2,
  });
  Map.addLayer(outline, {}, label + " Study Area");

  // Add navigation button for this study area
  var button = ui.Button({
    label: label,
    onClick: function () {
      Map.centerObject(study_area, 11);
    },
  });
  panel.add(button);

  // Run NDRE1 and SAR analysis (Version 1)
  // runVersion1(study_area, label, v1_years, start, end);

  // Run NDRE1 change and validation analysis (Version 2)
  runVersion2(study_area, label, v2_years, start, end);

  // Run Sentinel-2 NDVI validation (Version 3, optional)
  // runVersion3(study_area, label, v2_years, start, end);
});

// -----------------------------------------------------------------------------
// Sentinel-2 Composite Function with Cloud Masking
// -----------------------------------------------------------------------------

/**
 * Returns a cloud-free Sentinel-2 composite clipped to the given feature.
 * @param {ee.Geometry|ee.Feature} study_area - The study area geometry or feature.
 * @param {string} startDate - Start date (e.g., '2022-01-01').
 * @param {string} endDate - End date (e.g., '2022-12-31').
 * @return {ee.Image} Cloud-free composite image clipped to area.
 */
function getS2Composite(study_area, startDate, endDate) {
  // Cloud mask using SCL band
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
    .median()
    .clip(study_area);

  return composite;
}

// -----------------------------------------------------------------------------
// Sentinel-1 SAR Composite Function
// -----------------------------------------------------------------------------

/**
 * Returns a Sentinel-1 SAR composite (VV) clipped to the given feature.
 * @param {ee.Geometry|ee.Feature} study_area - The study area geometry or feature.
 * @param {string} startDate - Start date (e.g., '2022-01-01').
 * @param {string} endDate - End date (e.g., '2022-12-31').
 * @return {ee.Image} Median composite image (VV) clipped to area.
 */
function getS1Composite(study_area, startDate, endDate) {
  var collection = ee
    .ImageCollection("COPERNICUS/S1_GRD")
    .filterBounds(study_area)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
    .filter(ee.Filter.eq("orbitProperties_pass", "DESCENDING"));

  var composite = collection
    .select("VV")
    .median()
    .clip(study_area);

  return composite;
}

// -----------------------------------------------------------------------------
// NDRE1 and NDVI Calculation Functions
// -----------------------------------------------------------------------------

/**
 * Adds NDRE1 band to a Sentinel-2 image.
 * @param {ee.Image} image - Sentinel-2 image.
 * @return {ee.Image} Image with NDRE1 band.
 */
function addNDRE1(image) {
  var ndre1 = image.normalizedDifference(["B8", "B5"]).rename("NDRE1");
  return image.addBands(ndre1);
}

/**
 * Adds NDVI band to a Sentinel-2 image.
 * @param {ee.Image} image - Sentinel-2 image.
 * @return {ee.Image} Image with NDVI band.
 */
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

    // Compute Sentinel-1 SAR composite (VV)
    vv[year] = getS1Composite(study_area, startDate, endDate);

    // Compute Sentinel-2 composite
    var s2Composite = getS2Composite(study_area, startDate, endDate);

    // Visualize S2 + S1 composite
    var composite = s2Composite.addBands(vv[year].rename("VV"));
    print("Composite Image: ", composite);
    Map.addLayer(
      composite,
      { bands: ["B8", "B5", "VV"], min: 0, max: [3000, 3000, 0.05] },
      label + " S2 + S1 " + year
    );

    // Calculate and store NDRE1 for this year
    ndre1[year] = addNDRE1(s2Composite);
    Map.addLayer(
      ndre1[year].select("NDRE1"),
      { min: 0, max: 1, palette: ["blue", "white", "green"] },
      label + " NDRE1 " + year
    );
  });

  // NDRE1 change detection and visualization
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

  // SAR VV change detection and visualization
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

// ======================= Version 2: Sentinel-2 NDRE1 Change & Pre-Validation =======================

function runVersion2(study_area, label, years, start, end) {
  var ndre1 = {};

  // Compute NDRE1 for each year in the analysis period
  years.forEach(function (year) {
    var startDate = year + "-" + start;
    var endDate = year + "-" + end;

    // Get cloud-masked Sentinel-2 composite for the study area and year
    var s2Composite = getS2Composite(study_area, startDate, endDate);

    // Calculate and store NDRE1 band for this year
    ndre1[year] = addNDRE1(s2Composite);
  });

  // Proceed if NDRE1 images for both years are available
  if (ndre1[years[0]] && ndre1[years[1]]) {
    // Calculate NDRE1 change image (difference between years)
    var ndre1Change = ndre1[years[1]]
      .select("NDRE1")
      .subtract(ndre1[years[0]].select("NDRE1"))
      .rename("NDRE1_Change");

    // Display NDRE1 change image on the map
    Map.addLayer(
      ndre1Change,
      { min: -0.5, max: 0.5, palette: ["red", "white", "green"] },
      label + " NDRE1 Change " + years[0] + "-" + years[1]
    );

    // Classification of NDRE1 Change: 0 = Decrease, 1 = No Change, 2 = Increase
    var decreaseThresh = -0.1;
    var increaseThresh = 0.1;
    var classified = ndre1Change
      .expression(
        "(b('NDRE1_Change') < decrease) ? 0" +
          " : (b('NDRE1_Change') > increase) ? 2" +
          " : 1",
        {
          NDRE1_Change: ndre1Change.select("NDRE1_Change"),
          decrease: decreaseThresh,
          increase: increaseThresh,
        }
      )
      .rename("change_class")
      .clip(study_area);

    // Display the classified NDRE1 change map
    Map.addLayer(
      classified,
      { min: 0, max: 2, palette: ["red", "white", "green"] },
      "NDRE1 Change Class"
    );

    // Export the classified NDRE1 change image to Google Drive
    Export.image.toDrive({
      image: classified.clip(study_area),
      description: label + "_NDRE1_Change_Class",
      scale: 30,
      region: study_area,
      maxPixels: 1e13,
      folder: "GEE_Exports",
    });

    // Stratified random sampling for validation
    var sampleSize = 50; // Number of points per class for sampling
    var sample = classified.stratifiedSample({
      numPoints: sampleSize,
      classBand: "change_class",
      region: study_area,
      scale: 30,
      geometries: true,
    });

    // Add a random column and sort for reproducibility
    var seed = 42;
    var rand_st_points = sample.randomColumn("random", seed).sort("random");
    var numpoints = rand_st_points.size();
    print("Number of sample points: ", numpoints);

    // Assign unique IDs to each sample point for tracking
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

    // Display the stratified random sample points on the map
    Map.addLayer(
      rand_st_points_comb,
      { color: "orange" },
      label + " Sample Points"
    );

    // Export the stratified random sample points to Google Drive
    Export.table.toDrive({
      collection: rand_st_points_comb,
      description: label + "_NDRE1_Sample",
      fileFormat: "CSV",
      folder: "GEE_Exports",
    });

    // Show NDRE1 change histogram (summary statistics)
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

    // Visualize NDRE1 change histogram as a chart
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
}

// ======================= Version 3: Sentinel-2 Validation =======================

// This section is for future validation work using Sentinel-2 data

function runVersion3(study_area, label, years, start, end) {
  var ndvi = {};
  years.forEach(function (year) {
    var startDate = year + "-" + start;
    var endDate = year + "-" + end;
    // Compute NDVI composite for each year
    var s2Composite = getS2Composite(study_area, startDate, endDate);
    ndvi[year] = addNDVI(s2Composite);

    // Unsupervised classification using KMeans clustering
    var training = s2Composite.sample({
      region: study_area,
      scale: 30,
      numPixels: 500,
      seed: 42,
    });

    var clusterer = ee.Clusterer.wekaKMeans(4).train(training);
    var result = s2Composite.cluster(clusterer);

    // Display KMeans clusters for this year
    Map.addLayer(result.randomVisualizer(), {}, "KMeans Clusters " + year);
  });

  // NDVI change detection and mask visualization
  if (ndvi[v2_years[0]] && ndvi[v2_years[1]]) {
    var ndviChange = ndvi[v2_years[1]]
      .select("NDVI")
      .subtract(ndvi[v2_years[0]].select("NDVI"))
      .rename("NDVI_Change");
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

    // Display masked NDVI change on the map, clipped to the study area
    Map.addLayer(
      ndviChangeMasked.clip(study_area),
      threshViz,
      label + " NDVI Change Mask " + v2_years[0] + "-" + v2_years[1]
    );

    // Stratified random sample from the masked NDVI change
    var sampleSize = 50; // Adjust sample size as needed

    var sample = ndviChangeMask.stratifiedSample({
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

    // Display the stratified random sample points on the map
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

    // Export the stratified random sample points to Google Drive
    Export.table.toDrive({
      collection: rand_st_points_comb,
      description: label + "_NDVI_Sample",
      fileFormat: "CSV",
      folder: "GEE_Exports",
    });
  }
}

// ======================= Legend for NDRE1 Change Visualization =======================

// Create a legend panel for NDRE1 change classes
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

legend.add(makeRow("red", "Decrease"));
legend.add(makeRow("white", "No Change"));
legend.add(makeRow("green", "Increase"));

// Add the legend to the map
Map.add(legend);