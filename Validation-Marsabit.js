/*
===============================================================================
 GEOG 4/581 Final Project - Validation for NDRE1 Change Detection in Marsabit
 Team: "Kuhisi Kwa Mbali"

 Team Members:
   - Brenda Schuster (schusteb@oregonstate.edu)
   - Dan Parker (parkerd4@oregonstate.edu)
   - PB Echevarría (batistaj@oregonstate.edu)

  This script loads CEO sample points, computes NDRE1 change from Sentinel-2 composites,
  classifies change, samples the classified image at CEO points, and computes a confusion matrix.
  Visualization includes NDRE1 change, classified map, legend, and histogram.
 
   License:
   Copyright (c) 2025 Brenda Schuster, Dan Parker, PB Echevarría
   Licensed under the MIT License: https://opensource.org/licenses/MIT

 If you use this script in a publication or project, please cite the authors.
===============================================================================
*/

print("=== Kuhisi Kwa Mbali ===");

// ---------------------- Load CEO Samples ----------------------

var samples = require("users/elpbatista/GEOG4581:samples-Marsabit.js");
var samplesMarsabit = samples.samples;

// creat FeatureCollection from samples
var ceoSamples = ee.FeatureCollection(samplesMarsabit);

// Uncomment the line below to load CEO sample points from an asset
// var ceoSamples = ee.FeatureCollection("users/elpbatista/ceo_samples_Marsabit");
// print("CEO Samples:", ceoSamples.limit(5));

// ---------------------- Load Study Areas ----------------------
var data = require("users/elpbatista/GEOG4581:data-Bale_Leroghi_Marsabit.js");
var locations = data.locations;

// ---------------------- Visualization Palette ----------------------
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

// ---------------------- Analysis Parameters ----------------------
var years = [2019, 2024];
var start = "04-15";
var end = "06-15";

// ---------------------- Main Loop for Locations ----------------------
locations.forEach(function (feature, idx) {
  var name = feature.properties.name;
  print("Processing location: " + name);

  if (name === "Marsabit") {
    var label = name;
    var color = colorBrewer[idx % colorBrewer.length];
    var study_area = ee.Geometry(feature.geometry);

    // Visualize study area outline
    var outline = ee.FeatureCollection([ee.Feature(study_area)]).style({
      color: color,
      fillColor: "00000000",
      width: 2,
    });
    Map.addLayer(outline, {}, label + " Study Area");
    Map.centerObject(study_area, 12);

    // Run NDRE1 change detection and validation for Marsabit
    runVersion2(study_area, label, years, start, end);

    // Add CEO samples for Marsabit to the map
    var ceoSamplesMarsabit = ceoSamples.filterBounds(study_area);
    Map.addLayer(
      ceoSamplesMarsabit,
      { color: "orange" },
      "CEO Samples - " + name
    );
  }
  print("----------------------");
});

// ======================= Version 2: Sentinel-2 NDRE1 Change & Validation =======================
function runVersion2(study_area, label, years, start, end) {
  var ndre1 = {};

  // ---- Compute NDRE1 for each year ----
  years.forEach(function (year) {
    var startDate = year + "-" + start;
    var endDate = year + "-" + end;
    var s2Composite = getS2Composite(study_area, startDate, endDate);
    ndre1[year] = addNDRE1(s2Composite);
  });

  // ---- NDRE1 Change Detection ----
  if (ndre1[years[0]] && ndre1[years[1]]) {
    var ndre1Change = ndre1[years[1]]
      .select("NDRE1")
      .subtract(ndre1[years[0]].select("NDRE1"))
      .rename("NDRE1_Change");
    Map.addLayer(
      ndre1Change,
      { min: -0.5, max: 0.5, palette: ["red", "white", "green"] },
      label + " NDRE1 Change " + years[0] + "-" + years[1]
    );

    // ---- Classification of NDRE1 Change ----
    var decreaseThresh = -0.1;
    var increaseThresh = 0.1;
    // 0 = Decrease, 1 = No Change, 2 = Increase
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

    Map.addLayer(
      classified,
      { min: 0, max: 2, palette: ["red", "white", "green"] },
      "NDRE1 Change Class"
    );

    // ---- Sample Classified Image at CEO Points ----
    var ceoSamplesClassified = classified.reduceRegions({
      collection: ceoSamples,
      reducer: ee.Reducer.first(),
      scale: 30,
    });

    // ---- Map Reference and Prediction to Numeric Codes ----
    var labelToNumber = ee.Dictionary({
      decrease: 0,
      "no change": 1,
      increase: 2,
    });

    var ceoSamplesClassNum = ceoSamplesClassified.map(function (f) {
      var refNum = labelToNumber.get(f.get("change"));
      var predNum = f.get("first"); // already a number from reduceRegions
      return f.set("ref_num", refNum).set("pred_num", predNum);
    });

    // ---- Filter Out Nulls and Compute Confusion Matrix ----
    var filteredNum = ceoSamplesClassNum.filter(
      ee.Filter.notNull(["ref_num", "pred_num"])
    );
    print("Number of points processed:", filteredNum.size());
    var confusionMatrix = filteredNum.errorMatrix("ref_num", "pred_num");
    print("Confusion Matrix:", confusionMatrix);
    print("Overall Accuracy:", confusionMatrix.accuracy());
    print("Kappa:", confusionMatrix.kappa());
    print("Producer's Accuracy (per class):", confusionMatrix.producersAccuracy());
    print("User's Accuracy (per class):", confusionMatrix.consumersAccuracy());

    // ---- NDRE1 Change Histogram ----
    var histogram = ndre1Change.reduceRegion({
      reducer: ee.Reducer.histogram(),
      geometry: study_area,
      scale: 30,
      maxPixels: 1e13,
    });
    print(
      label + " NDRE1 Change Histogram " + years[0] + "-" + years[1],
      histogram
    );

    // ---- NDRE1 Change Histogram Chart ----
    var histogramVis = ui.Chart.image.histogram({
      image: ndre1Change,
      region: study_area,
      scale: 30,
      minBucketWidth: 0.01,
      maxBuckets: 100,
    });
    histogramVis.setOptions({
      title: label + " NDRE1 Change Histogram " + years[0] + "-" + years[1],
      hAxis: { title: "NDRE1 Change" },
      vAxis: { title: "Frequency" },
      lineWidth: 1,
      pointSize: 3,
    });
    print(histogramVis);
  }

  // ---- Add Legend for NDRE1 Change ----
  var legend = ui.Panel({
    style: {
      position: "bottom-left",
      padding: "8px 15px",
    },
  });

  legend.add(
    ui.Label({
      value: "NDRE1 Change",
      style: { fontWeight: "bold", fontSize: "14px", margin: "0 0 4px 0" },
    })
  );

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
  Map.add(legend);
}

// ---------------------- NDRE1 Calculation ----------------------
function addNDRE1(image) {
  var ndre1 = image.normalizedDifference(["B8", "B5"]).rename("NDRE1");
  return image.addBands(ndre1);
}

// ---------------------- Sentinel-2 Composite Function ----------------------
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
    .median()
    .clip(study_area);

  return composite;
}
