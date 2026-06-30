import JSZip from "jszip";
import fs from "fs/promises"
import * as THREE from 'three';


export function saveFile(content, filename) {
	console.log(`Successfully Saved File ${filename}`);
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}


// This function no longer attempts to auto-download.
// It prepares the data for later download.
export function prepareFileForDownload(content, filename) {
    // console.log(`Prepared file data for ${filename}`); // No need to log 'Successfully Saved' yet
    const blob = new Blob([content], { type: 'text/plain' });
    // Instead of clicking, return an object that contains the necessary info
    return {
        filename: filename,
        blobUrl: URL.createObjectURL(blob),
        blob: blob // Keep blob reference if you need to revoke URL later
    };
}

export async function readZipFromArrayBuffer() {
    const response = await fetch("./Loot/LoD 1/windows.zip"); // URL of the ZIP file
    const arrayBuffer = await response.arrayBuffer(); 
    
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = [];

    for (const [name, file] of Object.entries(zip.files)) {
        if (!file.dir) {
            const content = await file.async("uint8array");
            files.push({ name, content });
        }
    }
    return files;
}

function loadFile(filePath) {
	
	let fileLoader = new THREE.FileLoader();
	return new Promise((resolve, reject) => {
		fileLoader.load(
			filePath,
			function(text) {
				const values = text
					.trim()
					.split(',')
					.map(v => Number(v.trim()));
				resolve(values);
			},
			undefined,
			function(error) {
				console.error(`Error loading ${filePath}:`, error);
				reject(error);
			}
		);
	});
}

export async function loadSigns(startFrame, endFrame, targetLoD) {
	const promises = [];
    let arr = [];

	for(let f = startFrame; f < endFrame; f++)
	{
		for(let l = 0; l < targetLoD; l++)
		{
			for (let a = 0; a <= 0; a += 30) 
			{
				// const filePath = `./LongDress/testAngle/visibilityStatus/F${f}L${l}A${a}.txt`;
				const filePath = `./LongDress/Angle ${a}/F${f}L${l}A${a}.txt`;
				promises.push(loadFile(filePath));
			}
		}	
	}
	// const filePath = `./LongDress/frame0000/frame 0 level 0 Angle 0.txt`;
	// promises.push(loadFile(filePath));
	try {
		const results = await Promise.all(promises);
		results.forEach(values => arr.push(values));
        return arr;
	} catch (e) {
		console.error("Some files failed to load", e);
	}
}



/**
 * Fetches the CSV file from a URL and parses it.
 * @param {string} filePath The URL of the .txt file.
 * @returns {object | null} The parsed data object or null on failure.
 */
export async function getPointSizes(filePath) {
    try {
        const response = await fetch(filePath);
        
        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
		
        // Get the raw text content of the file
        const rawData = await response.text();
        // Parse the raw text using the function from before
        const parsedData = parseRawPointSizeData(rawData);
        
        return parsedData;
        
    } catch (error) {
        console.error("Failed to fetch or parse data:", error);
        return null;
    }
}

/**
 * Parses the raw CSV text data into an object containing unique,
 * sorted point sizes for each LOD.
 *
 * @param {string} csvData The raw string data from your .txt file.
 * @returns {object} An object like { 0: [3.0, 3.4, ...], 1: [3.0, 3.1, ...], ... }
 */
function parseRawPointSizeData(csvData) {
    const lines = csvData.trim().split('\n');
    const numLODs = 15; // Based on your file
    
    // Create an object to hold an array for each LOD
    // { 0: [], 1: [], ..., 9: [] }
    const lodPointSizes = {};
    for (let i = 0; i < numLODs; i++) {
        lodPointSizes[i] = [];
    }

    // Iterate through data lines (skip header)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',');
        
        // Populate the arrays
        for (let lodIdx = 0; lodIdx < numLODs; lodIdx++) {
            // values[0] is Alpha, values[lodIdx + 1] is the data for lodIdx
            const pointSize = parseFloat(values[lodIdx + 1]);
            lodPointSizes[lodIdx].push(pointSize);
        }
    }
    
    // Now, create the final object with *unique* values
    const uniqueLodPointSizes = {};
    for (let lodIdx = 0; lodIdx < numLODs; lodIdx++) {
        // Use a Set to get only unique values
        const uniqueSizes = new Set(lodPointSizes[lodIdx]);
        
        // Convert back to an array and sort it
        uniqueLodPointSizes[lodIdx] = Array.from(uniqueSizes).sort((a, b) => a - b);
    }
    
    return uniqueLodPointSizes;
}

