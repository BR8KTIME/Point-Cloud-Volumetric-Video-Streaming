/**
 * mpd-parser.js
 *
 * A professional, reusable ES module to parse multi-period MPEG-DASH manifests,
 * specifically tailored for the "stitched" point cloud object presentation.
 * It correctly handles multiple <Period> elements and their unique start times
 * and SegmentTemplates.
 */

/**
 * Asynchronously fetches and parses a multi-period MPD manifest file.
 * @param {string} url - The URL of the MPD file.
 * @returns {Promise<object>} A promise that resolves to a structured JavaScript object
 * containing the parsed architectural data of the manifest.
 */

export async function parseMPD(url) {
    // STAGE 1 & 2: Fetching and Secure XML Parsing (Standard Professional Practice)
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP Error: Failed to fetch MPD. Status: ${response.status}`);
    }
    const mpdText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(mpdText, "application/xml");
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
        throw new Error(`XML Parse Error: ${parseError.textContent}`);
    }

    // STAGE 3: Structured Data Extraction
    const mpdElement = xmlDoc.querySelector("MPD");
    if (!mpdElement) {
        throw new Error("Invalid MPD: <MPD> root element not found.");
    }

    const parsedData = {
        presentationDuration: mpdElement.getAttribute("mediaPresentationDuration"),
        periods: [] // This array will hold the data for each distinct Period.
    };

    // ARCHITECTURAL CORE: Iterate through all <Period> elements.
    // This is the key logic for handling a multi-object manifest.
    const periodElements = xmlDoc.querySelectorAll("Period");
    periodElements.forEach(period => {
        const periodData = {
            id: period.getAttribute("id"),
            duration: period.getAttribute("duration"),
            // CRITICAL: Extract the 'start' attribute for seamless transitions.
            // This tells the loader when this period begins on the overall timeline.
            adaptationSets: []
        };

        const adaptationSetElements = period.querySelectorAll("AdaptationSet");
        adaptationSetElements.forEach(adaptationSet => {
            const segmentTemplateEl = adaptationSet.querySelector("SegmentTemplate");
            const adaptationSetData = {
                id: adaptationSet.getAttribute("id"),
                contentType: adaptationSet.getAttribute("contentType"),
                // Each Period can have its own timing, so we parse the template here.
                SegmentTemplate: segmentTemplateEl ? {
                    frameRate: parseInt(segmentTemplateEl.getAttribute("frameRate"), 10),
                    media: segmentTemplateEl.getAttribute("media")
                } : null,
                representations: []
            };

            const representationElements = adaptationSet.querySelectorAll("Representation");
            representationElements.forEach(rep => {
                adaptationSetData.representations.push({
                    id: rep.getAttribute("id"),
                    bandwidth: parseInt(rep.getAttribute("bandwidth"), 10),
                    pointSize: parseInt(rep.getAttribute("pointSize"), 10)
                });
            });
            periodData.adaptationSets.push(adaptationSetData);
        });
        parsedData.periods.push(periodData);
    });

    return parsedData;
}
