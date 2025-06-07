# GEOG 4/581 Final Project

Oregon State University — Spring 2025

## Team: Kuhisi Kwa Mbali

- Brenda Schuster ([schusteb@oregonstate.edu](mailto:schusteb@oregonstate.edu))
- Dan Parker ([parkerd4@oregonstate.edu](mailto:parkerd4@oregonstate.edu))
- PB Echevarría ([batistaj@oregonstate.edu](mailto:batistaj@oregonstate.edu))

---

## Remote Sensing Change Detection of Above-Ground Biomass (AGB) in Dryland Protected Forests of East Africa

### Project Description

We hypothesize that remote sensing change detection will show a difference in Above-Ground Biomass (AGB) trends between:

- (a) Protected forests
- (b) Protected forests enrolled in a carbon offset scheme  
in the drylands of East Africa.

### Methodology

- Acquire Landsat and Sentinel imagery for multiple study locations.
- Use the LandTrendr algorithm and random forest classifiers to detect and quantify AGB change.
- Analyze NDVI, NDRE1, and SAR indices over a ten-year period.
- Compare trends between protected areas and those with carbon offset schemes.

### Study Areas

Defined in the data modules:

- Chyulu Hills National Park, Kenya
- Amboseli National Park, Kenya
- Bale Mountains National Park, Ethiopia
- Leroghi Forest Reserve, Kenya
- Marsabit National Park, Kenya
- Lower Zambezi National Park, Zambia
- Munyeta Forest Reserve, Zambia

---

## Repository Structure

```Text
GEOG4581/
├── LandTrendr.js                   # Main LandTrendr analysis script
├── LandTrendrGUI.js                # Interactive GUI for LandTrendr analysis
├── Sentinel.js                     # Sentinel-1/2 analysis script
├── Sentinel_D6.js                  # Sentinel analysis for Deliverable #6
├── Validation-Marsabit.js          # Validation for change detection in Marsabit
├── data.js                         # Study area definitions (all areas)
├── data-Chyulu_Amboseli.js         # Data for Chyulu Hills & Amboseli
├── data-Bale_Leroghi_Marsabit.js   # Data for Bale, Leroghi, Marsabit
├── data-LowerZambezi_Munyeta.js    # Data for Lower Zambezi & Munyeta
├── samples-Marsabit.js             # CEO validation points for Marsabit
├── (other scripts and modules as needed)
```

---

## Script Overviews

### LandTrendr.js

- Loads study area data from a selected data module.
- Loads the LandTrendr module (LandTrendr.js).
- Sets up a control panel with buttons to center the map on each study area.
- For each study area:
  - Adds an outline to the map.
  - Adds a button to center the map.
  - Runs LandTrendr and visualizes:
    - Magnitude of change
    - Year of detection
    - Duration of change
    - Prevalence of change

### LandTrendrGUI.js

- Provides an interactive GUI for LandTrendr analysis.
- Allows users to select study areas, indices, and parameters.
- Visualizes change maps and time series interactively.
- Uses LandTrendr and LandTrendr-UI modules.

### Sentinel.js & Sentinel_D6.js

- Analyze Sentinel-1 SAR and Sentinel-2 NDRE1 imagery for the study areas.
- Apply cloud and cloud-shadow masking to Sentinel-2 imagery.
- Compute and visualize the following indices:
  - **NDVI** (Normalized Difference Vegetation Index)
  - **NDRE1** (Normalized Difference Red Edge Index 1)
  - **SAR backscatter** (Sentinel-1, e.g., VV, VH polarizations)
- Perform change detection between years for all indices.
- Classify NDRE1 change into "decrease", "no change", and "increase" categories.
- Generate stratified random samples for validation.
- Export classified images and validation samples to Google Drive.
- Visualize results with map layers, histograms, and legends for each study area.
- Support unsupervised classification using KMeans clustering (optional).
- `Sentinel_D6.js` is tailored for Deliverable #6, focusing on Chyulu Hills and Amboseli.

### Validation-Marsabit.js

- Loads CEO validation points for Marsabit National Park.
- Computes NDRE1 change from Sentinel-2 composites for two years.
- Classifies NDRE1 change into "decrease", "no change", and "increase" categories using defined thresholds.
- Samples the classified NDRE1 change image at CEO validation points.
- Maps reference and predicted classes to numeric codes for confusion matrix calculation.
- Computes and prints the confusion matrix and accuracy metrics (overall, kappa, producer's, and user's accuracy).
- Visualizes NDRE1 change, classified map, sample points, and histograms.

### Data Modules

- Each `data-*.js` file defines a set of study areas as an array of objects with geometry and properties.
- `samples-Marsabit.js` provides CEO validation points for Marsabit National Park.
- You can swap the active data module by changing the `require()` path at the top of the analysis scripts.

---

## Usage

- [Add this repository to the Google Earth Engine Code Editor](https://code.earthengine.google.com/?accept_repo=users/elpbatista/GEOG4581)
- Open the desired script (e.g., LandTrendr.js, LandTrendrGUI.js, Sentinel.js, or Sentinel_D6.js).
- Select the desired data module by uncommenting the appropriate `require()` line.
- Run the script to visualize results for each study area.
- Use the control panel to center the map on each area and explore the results.

---

## Dependencies

- [Google Earth Engine](https://earthengine.google.com/)
- LandTrendr module: `users/emaprlab/public:Modules/LandTrendr.js`
- LandTrendr UI module: `users/emaprlab/public:Modules/LandTrendr-UI.js`

---

## License

Copyright (c) 2025 Brenda Schuster, Dan Parker, PB Echevarría  
Licensed under the [MIT License](https://opensource.org/licenses/MIT)

---

## Citation

If you use this project in a publication or project, please cite the authors using one of the following formats:

### APA

> Schuster, B., Parker, D., & Echevarría, P. B. (2025). *LandTrendr and Sentinel Analysis Scripts for Above-Ground Biomass Change Detection in East African Dryland Forests* [Computer software]. Oregon State University. <https://github.com/elpbatista/GEOG4581>

### MLA

> Schuster, Brenda, Dan Parker, and PB Echevarría. *LandTrendr and Sentinel Analysis Scripts for Above-Ground Biomass Change Detection in East African Dryland Forests*. Oregon State University, 2025. Computer software. <https://github.com/elpbatista/GEOG4581>

### Chicago

> Schuster, Brenda, Dan Parker, and PB Echevarría. 2025. *LandTrendr and Sentinel Analysis Scripts for Above-Ground Biomass Change Detection in East African Dryland Forests*. Oregon State University. Computer software. <https://github.com/elpbatista/GEOG4581>

### BibTeX

```bibtex
@misc{schuster2025landtrendr,
  author       = {Schuster, Brenda and Parker, Dan and Echevarría, PB},
  title        = {LandTrendr and Sentinel Analysis Scripts for Above-Ground Biomass Change Detection in East African Dryland Forests},
  year         = {2025},
  note         = {Oregon State University. Computer software.},
  url          = {https://github.com/elpbatista/GEOG4581}
}
```

---

## Contact

For questions or collaboration, contact any team member via email.

---

**End of documentation.**
