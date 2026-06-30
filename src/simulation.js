import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { discardWithNormals, discardAddDepth } from './modules/customshader.js';
import { euclideanDistance2D, computeIQR, createHistogram, otsuThreshold, calculateBins, getThreshold, getAverage, getRMSE } from './modules/utility.js';

import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { parseMPD } from './modules/MPDParser.js';
import { deltaE } from './modules/LabSpace.js';


// For rendering
let isPlaying = false, loop = 0;
let currentPlaybackFrame = 0, currentAngle = 0;
let currentPoints, totalFrames = 0, frameHoldDuration = 0, frameHoldCounter = 1;
let maxLoop = 0;

//For Initilization
let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;
let dracoloader;
let pixels;
let camera, scene, renderer;
const canvas = document.getElementById("webglCanvas");


//For post processing
let isRunning = false, isRebuffering = false;
let screen_coords = [];
let holeArray = [];
let scale = 0;
let modifiedMesh = null;
let minScreenX = Number.MAX_SAFE_INTEGER, minScreenY = Number.MAX_SAFE_INTEGER;
let maxScreenX = 0, maxScreenY = 0;

//For time measuring
let startTime, endTime, previous = 0;
let targetFrameRate = 30, then = 0;
let desiredInterval = (1 / targetFrameRate);


//For network objective function
let bitrateInfo = new Map();
let temporalLODs = [];
let spatialLODs = [];
let simulationTemporal = [15, 15, 30, 15, 15, 15, 30, 15, 30, 15, 30, 15, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 15, 10, 15, 15, 10]
let simulationSpatial =   [10, 11, 5, 8, 9, 9, 0,   3, 0,   3, 0,   3, 3, 8, 8, 7, 7, 7, 9, 9, 9, 11, 1, 9, 10, 7, 11, 7, 7, 10]
let simulationPointSize = [4,  4,  4, 4, 4, 4, 8.5, 5, 8.5, 5, 8.5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4,  7, 4, 4,  4, 4,  4, 4, 4]


//For Buffers

let segmentDuration = 1;
let GOFQueue = [];              // A queue of complete, sorted GOFs. E.g., [[GOF 1], [GOF 2], ...]
let	currentPlayingGOF = [];     // The GOF being rendered right now. E.g., [frame 0, frame 1, ...]


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function wait() {
  console.log("Loading Draco Decoder");
  sleep(3000).then(() => loadFrames());
}

init();
animate();

const targetOptions = {
	format: THREE.RGBAFormat, 
	type: THREE.UnsignedByteType
};

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, targetOptions);


async function init() {

	//antialis makes the rendered scene look smoother and more visually appealing by reducing the jagged edges.
	renderer = new THREE.WebGLRenderer({ antialias: false, canvas, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	scale = window.innerHeight * window.devicePixelRatio / 2;

	//set the background image
	renderer.setClearColor(0xffffff);
	renderer.setClearAlpha(0);
	document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();
	const axesHelper = new THREE.AxesHelper(300);
	// scene.add(axesHelper);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 200, 3000);
	// console.log(`Aspect Ratio: ${window.innerWidth / window.innerHeight}`)
	// camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 3, 2000);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    // controls.addEventListener('change', render); // use if there is no animation loop

	controls.minDistance = 100;
    controls.maxDistance = 10000;

	window.addEventListener('resize', onWindowResize);

	dracoloader = new DRACOLoader();
	dracoloader.setDecoderPath('./draco/');
	dracoloader.setDecoderConfig({ type: 'js' });
	dracoloader.setWorkerLimit(4);
	wait();
}

async function loadMPD(manifestUrl, periodId) {
	try {
		const manifest = await parseMPD(manifestUrl);

		const period = manifest.periods.find(p => p.id === periodId);
		const adaptationSets = period.adaptationSets;
		temporalLODs = adaptationSets
                .map(adpt => adpt.SegmentTemplate.frameRate)
                .sort((a, b) => a - b);
		
		spatialLODs = adaptationSets[0].representations
                .map((_, index) => index);
		
		adaptationSets.forEach(set => {
			const bws = set.representations
				.map(rep => rep.bandwidth)
				.sort((a, b) => a - b);
			bitrateInfo.set(set.SegmentTemplate.frameRate, bws); // Key: 'Post_Processing_10', Value: [...]
		});
		
		let manifestInfo = {period: period, adaptationSets: adaptationSets};
		return manifestInfo;
	} catch (error) {
		console.error("Failed to load MPD File:", error);
	}
}	

// async function loadFrames() { //Proposed

// 	startTime = performance.now();

// 	const MPDURL = '/metafile_v2.mpd';

// 	const {period, adaptationSets} = await loadMPD(MPDURL, "longdress");

// 	const baseUrl = 'http://141.223.65.28/dataset/' + period.id + '/';

// 	//Select 10 frame rate, LOD 0 to begin with
// 	let selectedAdaptation = adaptationSets[0];
// 	let template = selectedAdaptation.SegmentTemplate;
	
// 	totalFrames = 300;

// 	let segmentSize = targetFrameRate * segmentDuration;
	
// 	let frameIndex = 0;
// 	let spatialIdx = 0, temporalIdx = 0, pointIdx = 0;
// 	while(frameIndex < totalFrames) {
//         const promises = [];

// 		let frameRate = simulationTemporal[temporalIdx]
// 		let LOD = 'LOD' + simulationSpatial[spatialIdx];
// 		let pointSize = simulationPointSize[pointIdx];

		
// 		let segmentIndex = frameIndex;
// 		while(segmentIndex < frameIndex + segmentSize)
// 		{				
// 			const tempIndex = segmentIndex
// 			const label = `Frame ${tempIndex}, LOD ${LOD}`;
// 			const url = baseUrl + template.media.replace('$Number%04d$', `${tempIndex.toString().padStart(4, '0')}`).replace('$RepresentationID$', `${LOD}`);
// 			console.log(url);

// 			const promise = fetch(url)
// 				.then(res => res.arrayBuffer())
// 				.then(buffer => {
// 					return loadModel(buffer, tempIndex, pointSize, label);
// 				})
// 				.catch(error => {
// 					console.error(`Error fetching or decoding frame #${segmentIndex}:`, error);
// 				});
// 			promises.push(promise);

// 			if(frameRate == 10)
// 				segmentIndex += 3;
// 			else if(frameRate == 15)
// 				segmentIndex += 2;
// 			else
// 				segmentIndex += 1;
// 		}

// 		const downloadedFrames = await Promise.all(promises);
// 		downloadedFrames.sort((a, b) => a.index - b.index);				
		
// 		GOFQueue.push({frames: downloadedFrames, rate: frameRate});
		
// 		frameIndex += segmentSize;
// 		spatialIdx += 1;
// 		temporalIdx += 1;
// 		pointIdx += 1;
// 		maxLoop = 0;
// 		if(frameIndex >= totalFrames && loop < maxLoop)
// 		{
// 			frameIndex = 0;
// 			loop += 1;
// 		}
//     }
// 	startPlayback();
// }

async function loadFrames() { //Fixed

	startTime = performance.now();

	const MPDURL = '/metafile_v2.mpd';

	const {period, adaptationSets} = await loadMPD(MPDURL, "longdress");

	const baseUrl = 'http://141.223.65.28/dataset/' + period.id + '/';

	//Select 10 frame rate, LOD 0 to begin with
	let selectedAdaptation = adaptationSets[0];
	let template = selectedAdaptation.SegmentTemplate;

	let frameRate = 5;
	let LOD = 'LOD14';
	let pointSize = 4;

	totalFrames = 300;

	let segmentSize = targetFrameRate * segmentDuration;
	
	let frameIndex = 0;
	
	while(frameIndex < totalFrames) {
        const promises = [];

		let segmentIndex = frameIndex;
		while(segmentIndex < frameIndex + segmentSize)
		{				
			const tempIndex = segmentIndex
			const label = `Frame ${tempIndex}, LOD ${LOD}`;
			const url = baseUrl + template.media.replace('$Number%04d$', `${tempIndex.toString().padStart(4, '0')}`).replace('$RepresentationID$', `${LOD}`);
			console.log(url);

			const promise = fetch(url)
				.then(res => res.arrayBuffer())
				.then(buffer => {
					return loadModel(buffer, tempIndex, pointSize, label);
				})
				.catch(error => {
					console.error(`Error fetching or decoding frame #${segmentIndex}:`, error);
				});
			promises.push(promise);

			if(frameRate == 5)
				segmentIndex += 6;
			else if(frameRate == 10)
				segmentIndex += 3;
			else if(frameRate == 15)
				segmentIndex += 2;
			else
				segmentIndex += 1;
		}

		const downloadedFrames = await Promise.all(promises);
		downloadedFrames.sort((a, b) => a.index - b.index);				
		
		GOFQueue.push({frames: downloadedFrames, rate: frameRate});
		
		frameIndex += segmentSize;
		maxLoop = 0;
		if(frameIndex >= totalFrames && loop < maxLoop)
		{
			frameIndex = 0;
			loop += 1;
		}
    }
	startPlayback();
}

function startPlayback() {
    // If we are already playing, just wait. The new GOF will be played after the current one finishes.
    // This creates a backlog, which is a simple form of a larger playback buffer.
    if (isPlaying) {
        console.log("Buffering next GOF. It will play after the current one finishes.");
        return;
    }
    
	if (GOFQueue.length > 0) {
        console.log(`▶️ Starting playback of next GOF.`);
    	currentPlayingGOF = GOFQueue.shift(); // .shift() removes and returns the first element
		currentPlaybackFrame = 0;
        isPlaying = true; 
        frameHoldDuration = targetFrameRate / currentPlayingGOF.rate;
    }
}

function loadModel(buffer, index, pointSize, label) {
    // Return a new Promise
    return new Promise((resolve, reject) => {
        const onLoad = (geometry) => {
            if (!geometry) {
                console.error(`Decoding failed, no geometry returned for frame #${index}`);
                // Reject the promise if decoding fails
                reject(new Error(`No geometry returned for frame #${index}`));
                return;
            }
			const material = new THREE.PointsMaterial();
			const points = new THREE.Points(geometry, material);	
			const visualMaterial = points.material;
			visualMaterial.vertexColors = true;
			visualMaterial.size = pointSize;

			const dataMaterial = visualMaterial.clone(); 

			dataMaterial.blending = THREE.NoBlending;
			dataMaterial.transparent = true;

			points.visualMaterial = visualMaterial;
			points.dataMaterial = dataMaterial;
			
			discardAddDepth(dataMaterial, camera.near, camera.far);
			resolve({ points: points, index: index + 1 });
		};
		const onError = (error) => {
            console.error(`DracoLoader error for frame #${index}:`, error);
            // Reject the promise on loader error
            reject(error);
        };
		dracoloader.parse(buffer, onLoad, onError);
	});
}

function modify_pixels(frameIdx, frameRate) {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
	isRunning = true;	
	try
	{
		console.time(`👓Post-Processing Delay ${frameIdx}`);
		// const canvas = renderer.domElement;
		// const canvas = document.getElementById('webglCanvas');
		const gl = canvas.getContext('webgl2');

		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

		screen_coords.splice(0, screen_coords.length);
		holeArray.splice(0, holeArray.length);
		minScreenX = Number.MAX_SAFE_INTEGER, minScreenY = Number.MAX_SAFE_INTEGER;
		maxScreenX = 0, maxScreenY = 0;

		pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
		gl.readPixels(
			0,
			0,
			gl.drawingBufferWidth,
			gl.drawingBufferHeight,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixels);

		//Initialize pixels_on_screen array & hole array
		holeArray = Array(height).fill().map(() => Array(width).fill(0));
		
		// console.log(`Canvas: `, gl);	
		// console.log("Drawing Buffer Width:", gl.drawingBufferWidth);
		// console.log("Drawing Buffer Height:", gl.drawingBufferHeight);
		// console.log(`Pixels: ${pixels.length}`);

		let worldPosition = new THREE.Vector3();
		
	
		let points = currentPoints.geometry.attributes.position.array;
		for (let i = 0; i < points.length; i += 3)
		{
			// Get the x, y, z coordinates of the point
			const x = points[i];
			const y = points[i + 1];
			const z = points[i + 2];
			worldPosition.set(x, y, z);
			log_coord(pixels, worldPosition, width, height);
		}

		// let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		// screen_coords.splice(0, screen_coords.length);
		// // Convert back to arrays if needed
		// screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		// console.log(`Screen Coordinate Length ${screen_coords.length}`);

		// let hullPoints = concave(screen_coords);
		// detect_holesConcave(hullPoints, width, height);
			
		// for(let s = 0; s < screen_coords.length; s++)
		// {
		// 	const sx = screen_coords[s][0];
		// 	const sy = screen_coords[s][1];

		// 	let idx = pixel_position(width, sx, sy);
		// 	if(s < 1000 && pixels[idx + 3] != 255)
		// 	{
		// 		console.log(pixels[idx + 3]);
		// 	}
		// }
		
		// detect_holesDepth(width, height);

		// for(let y = 0; y < height; y++)
		// {
		// 	for(let x = 0; x < width; x++)
		// 	{
		// 		if(holeArray[y][x] == 1)
		// 		{
		// 			// let idx = pixel_position(width, x, y);
		// 			// pixels[idx] = 0;
		// 			// pixels[idx + 1] = 255;
		// 			// pixels[idx + 2] = 0;
		// 			inverseDistanceWeightingInterpolation(y, x, width, height, 7);
		// 		}
		// 	}		
		// }		
		
		const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
		texture.colorSpace = THREE.LinearSRGBColorSpace;

		texture.needsUpdate = true;
		
		let textureCamera = new THREE.OrthographicCamera(
			0, width,
			height, 0,
			-1, 1
		);
		
		// Match plane geometry to the window
		const geometry = new THREE.PlaneGeometry(width, height);
		const material = new THREE.MeshBasicMaterial({ map: texture });
		modifiedMesh = new THREE.Mesh(geometry, material);

		// Set position to center of screen
		modifiedMesh.position.set(width / 2, height / 2, 0);
		
		renderer.setRenderTarget(null); 
		scene.add(modifiedMesh);	
		renderer.render(scene, textureCamera);

		// if(frameIdx == 85)
		// takeScreenshot(frameIdx, frameRate);
		console.timeEnd(`👓Post-Processing Delay ${frameIdx}`);
	}
	finally{
		isRunning = false;
	}		
}

function takeScreenshot(frameIdx, frameRate, currentAngle) {
	// Get the data URL of the current frame
	const dataURL = renderer.domElement.toDataURL('image/png');

	// Create a temporary link element
	const link = document.createElement('a');
	link.href = dataURL;
	// link.download = `${frameRate}_${frameIdx}_${currentAngle}.png`; 
	link.download = `${currentAngle}.png`; 


	// Programmatically click the link to trigger the download
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

function removeMesh()
{
	if (modifiedMesh) {
		scene.remove(modifiedMesh);
		// 2. Dispose geometry and material
		modifiedMesh.geometry.dispose();
		modifiedMesh.material.dispose();

		// 3. Dispose texture
		if (modifiedMesh.material.map) {
			modifiedMesh.material.map.dispose();
		}

		// 4. Null out references (optional, helps GC)
		modifiedMesh.geometry = null;
		modifiedMesh.material.map = null;	
		modifiedMesh.material = null;
		modifiedMesh = null;
	}
}

let previousPlaybackFrame = 0;
let frameIndex = 0;

// function render() {
// 	if (modifiedMesh) {
// 		scene.remove(modifiedMesh);
// 		// 2. Dispose geometry and material
// 		modifiedMesh.geometry.dispose();
// 		modifiedMesh.material.dispose();

// 		// 3. Dispose texture
// 		if (modifiedMesh.material.map) {
// 			modifiedMesh.material.map.dispose();
// 		}

// 		// 4. Null out references (optional, helps GC)
// 		modifiedMesh.geometry = null;
// 		modifiedMesh.material.map = null;	
// 		modifiedMesh.material = null;
// 		modifiedMesh = null;
// 	}
	
// 	if (isPlaying && currentPlayingGOF.frames.length > 0) {
//         let current = performance.now();
// 		console.log(`🪭Frame Interval: ${(current - previous).toFixed(2)} ms, Current Frame ${frameIndex}, Current Angle ${currentAngle}`);
// 		previous = current;
// 		// console.log(frameHoldCounter, frameHoldDuration);
// 		if(frameIndex == 0 || currentPlaybackFrame != previousPlaybackFrame){ 
// 			previousPlaybackFrame = currentPlaybackFrame;
// 			// 1. Remove the previous frame's object from the scene
//         	if (currentPoints) {
//             	scene.remove(currentPoints);
// 				disposeObject(currentPoints);
//         	}

//         	// 2. Get the new frame object from our buffer
// 			currentPoints =	currentPlayingGOF.frames[currentPlaybackFrame].points;
// 			frameIndex = currentPlayingGOF.frames[currentPlaybackFrame].index;
// 			// 3. Add the new frame object to the scene
// 			scene.add(currentPoints);
// 			console.log(`🖼️ Displaying Frame# ${frameIndex} with Angle ${currentAngle}`);
// 			frameDisplay.innerHTML = `Frame: ${frameIndex}`;
			
// 			scene.traverse((object) => {
// 				if (object.isPoints && object.dataMaterial) {
// 					object.material = object.dataMaterial;
// 				}
// 			});
// 			renderer.setRenderTarget(renderTarget);
// 			renderer.clear();
// 			renderer.render(scene, camera);
		
// 			modify_pixels(frameIndex, currentPlayingGOF.rate);

// 			// scene.traverse((object) => {
// 			// 	if (object.isPoints && object.visualMaterial) {
// 			// 		object.material = object.visualMaterial;
// 			// 	}
// 			// });

// 			// renderer.setRenderTarget(null); // Set renderer back to the canvas
// 			// renderer.clear();
// 			// renderer.render(scene, camera);
// 		}
// 		currentAngle = currentAngle + 2; 

// 		if (frameHoldCounter >= frameHoldDuration) { // Move to the next frame
// 			// Reset the counter for the *next* frame
// 			frameHoldCounter = 1; 
// 			// NOW we advance to the next frame in the buffer
// 			currentPlaybackFrame++;
		
// 			// Check if the current GOF playback has finished
// 			let nextFrameIndex = 0;
// 			if(currentPlayingGOF.rate == 10)
// 				nextFrameIndex = frameIndex += 3;
// 			else if(currentPlayingGOF.rate == 15)
// 				nextFrameIndex = frameIndex += 2;
// 			else
// 				nextFrameIndex = frameIndex += 1;
			
// 			if (nextFrameIndex > totalFrames && loop == maxLoop) {
// 				endTime = performance.now(); // Record the end time
// 				const totalTime = (endTime - startTime) / 1000; // Total time in seconds
// 				const fps = totalFrames / totalTime; // Calculate FPS
// 				console.log(`Total time to render ${totalFrames} frames: ${totalTime.toFixed(2)} seconds`);
// 				console.log(`FPS: ${fps.toFixed(2)}`);
// 			}
			
// 			if (currentPlaybackFrame >=	currentPlayingGOF.frames.length) {
// 				console.log("⏹️ Finished playing GOF.");
// 				isPlaying = false; 
// 				currentPlayingGOF = []; 
// 				startPlayback();
// 			}
// 		}
// 		else
// 		{
// 			frameHoldCounter++;
// 		}
//     }	
// }

function render() {
	removeMesh();
	if (isPlaying && currentPlayingGOF.frames.length > 0) {
        let current = performance.now();
		console.log(`🪭Frame Interval: ${(current - previous).toFixed(2)} ms, Current Frame ${frameIndex}, Current Angle ${currentAngle}`);
		previous = current;
		// console.log(frameHoldCounter, frameHoldDuration);
		if(frameIndex == 0 || currentPlaybackFrame != previousPlaybackFrame){ 
			previousPlaybackFrame = currentPlaybackFrame;
			// 1. Remove the previous frame's object from the scene
        	if (currentPoints) {
            	scene.remove(currentPoints);
				disposeObject(currentPoints);
        	}

        	// 2. Get the new frame object from our buffer
			currentPoints =	currentPlayingGOF.frames[currentPlaybackFrame].points;
			frameIndex = currentPlayingGOF.frames[currentPlaybackFrame].index;

			// 3. Add the new frame object to the scene
			scene.add(currentPoints);
			console.log(`🖼️ Displaying Frame# ${frameIndex} with Angle ${currentAngle}`);
			frameDisplay.innerHTML = `Frame: ${frameIndex}`;
			
			scene.traverse((object) => {
				if (object.isPoints && object.dataMaterial) {
					object.material = object.dataMaterial;
				}
			});
		}

		currentAngle = currentAngle + 2; 
		renderer.setRenderTarget(renderTarget);
		renderer.clear();
		renderer.render(scene, camera);
			
		modify_pixels(frameIndex, currentPlayingGOF.rate);
		takeScreenshot(frameIndex, currentPlayingGOF.rate, currentAngle);
		
		if (frameHoldCounter >= frameHoldDuration) { // Move to the next frame
			// Reset the counter for the *next* frame
			frameHoldCounter = 1; 
			// NOW we advance to the next frame in the buffer
			currentPlaybackFrame++;
		
			// Check if the current GOF playback has finished
			let nextFrameIndex = 0;
			if(currentPlayingGOF.rate == 5)
				nextFrameIndex = frameIndex += 6;
			else if(currentPlayingGOF.rate == 10)
				nextFrameIndex = frameIndex += 3;
			else if(currentPlayingGOF.rate == 15)
				nextFrameIndex = frameIndex += 2;
			else
				nextFrameIndex = frameIndex += 1;
			
			if (nextFrameIndex > totalFrames && loop == maxLoop) {
				endTime = performance.now(); // Record the end time
				const totalTime = (endTime - startTime) / 1000; // Total time in seconds
				const fps = totalFrames / totalTime; // Calculate FPS
				console.log(`Total time to render ${totalFrames} frames: ${totalTime.toFixed(2)} seconds`);
				console.log(`FPS: ${fps.toFixed(2)}`);
			}
			
			if (currentPlaybackFrame >=	currentPlayingGOF.frames.length) {
				console.log("⏹️ Finished playing GOF.");
				isPlaying = false; 
				currentPlayingGOF = []; 
				startPlayback();
			}
		}
		else
		{
			frameHoldCounter++;
		}
    }	
}

function detect_holesDepth(width, height)
{
	let window = 10;
	for(let y = 0; y < height; y += window)
	{
		for(let x = 0; x < width; x += window)
		{
			let localMax = 0, localMin = Number.MAX_SAFE_INTEGER;
			let localMaxColor = {}, localMinColor = {};
			let localValues = [];
			for(let k = 0; k < window; k++) //Find the local average here
			{
				if(y + k >= minScreenY && y + k <= maxScreenY)
				{
					for(let l = 0; l < window; l++)
					{
						if(x + l >= minScreenX && x + l <= maxScreenX)
						{
							let idx = pixel_position(width, x + l, y + k);
							let pixelDepth = pixels[idx + 3];
							if(pixelDepth != 0)
							{
								localValues.push(pixels[idx + 3]);
								if(pixelDepth > localMax)
								{
									localMaxColor = {r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2]};
									localMax = pixelDepth;
								}
								if(pixelDepth < localMin)
								{
									localMin = pixelDepth;
									localMinColor = {r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2]};
								}
							}
							else if(pixels[idx + 3] == 0)
							{
								holeArray[y + k][x + l] = 1;
							}
						}
					}
				}
			}

			
			let localLength = localValues.length;
			if(localLength == 0)
				continue;

			let localMaxVector = new THREE.Vector3(localMaxColor.r, localMaxColor.g, localMaxColor.b);
			let localMinVector = new THREE.Vector3(localMinColor.r, localMinColor.g, localMinColor.b);
			let colorDistance = deltaE(localMaxVector, localMinVector);
			
			// console.log(`Color Distance : ${colorDistance}`);
			// console.log(localValues);

			if(colorDistance < 2)
				continue;
			// console.log(localMaxVector, localMinVector, colorDistance);

			// console.log(localValues);
		
			let stats = computeIQR(localValues);
			// let numberofBins = calculateBins(stats.iqr, localMax, localMin, localLength);
			let numberofBins = 3;
			let localHistogram = createHistogram(localValues, numberofBins);
			let thresholdIdx = otsuThreshold(localHistogram);
			let threshold = getThreshold(thresholdIdx, localMin, localMax, numberofBins);
			// console.log(localHistogram);

			let localAverage = getAverage(localValues);

			// let begin = getThreshold(0, localMin, localMax, 2);
			// let end = getThreshold(1, localMin, localMax, 2);
			// console.log(`Begin: ${begin.start}, ${begin.end}`);
			// console.log(`End: ${end.start}, ${end.end}`);
			
			// console.log(`Threshold Index: ${thresholdIdx}, threshold: ${threshold.end}`);
			// console.log(localValues);
			// console.log("🧨");
			
			

			for(let k = 0; k < window; k++) //Find the local average here
			{
				if(y + k >= minScreenY && y + k <= maxScreenY)
				{
					for(let l = 0; l < window; l++)
					{
						if(x + l >= minScreenX && x + l <= maxScreenX)
						{
							if(holeArray[y + k][x + l] == 1)
								continue;

							let idx = pixel_position(width, x + l, y + k);
							let depth = pixels[idx + 3];

							if(depth >= threshold.end)
							{	
								holeArray[y + k][x + l] = 1;
							}
						}
					}
				}
			}
		}
	}
}

function pixel_position(width, screen_x, screen_y)
{
	return (width * screen_y + screen_x) * 4;
}

function log_coord(pixels, worldPosition, width, height) {
	
	// Step 1: World to Camera (View) Coordinates
	const cameraPosition = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse);

	// Step 2: Camera to NDC
	const ndcPosition = cameraPosition.clone().applyMatrix4(camera.projectionMatrix);
	// // Step 3: NDC to Screen Coordinates
	const x = (ndcPosition.x + 1) * windowWidth / 2 * devicePixelRatio;
	const y = (ndcPosition.y + 1) * windowHeight / 2 * devicePixelRatio;

	// const x = (ndcPosition.x + 1) * windowWidth / 2;
	// const y = (ndcPosition.y + 1) * windowHeight / 2;

	if(x < 0 || x > width - 1)
		return;
	if(y < 0 || y > height - 1)
		return;

	let screenX = Math.floor(x);
	let screenY = Math.floor(y);
	
	let index = pixel_position(width, screenX, screenY);
	
	if(pixels[index] == 255 && pixels[index + 1] == 255 && pixels[index + 2] == 255)
		return;

	if(screenX < minScreenX)
		minScreenX = screenX;
	else if(screenX > maxScreenX)
		maxScreenX = screenX;

	if(screenY < minScreenY)
		minScreenY = screenY;
	else if(screenY > maxScreenY)
		maxScreenY = screenY;

	screen_coords.push([screenX, screenY]);
	return;
}

function meanValueInterpolation(y, x, width, height, kernel_size){
	
	let interval = 0;
	interval = Math.floor(kernel_size / 2);

	let sum_r = 0, sum_g = 0, sum_b = 0;
	let valid_count = 0;
	for(let idx_y = -interval; idx_y <= interval; idx_y++)
	{
		if(y + idx_y < 0 || y + idx_y > height - 1)
		{
			continue;
		}
		for(let idx_x = -interval; idx_x <= interval; idx_x++)
		{	
			
			if(x + idx_x < 0 || x + idx_x > width - 1)
			{
				continue;
			}

			if(idx_y == 0 && idx_x == 0)
				continue;

			let r = 0, g = 0, b = 0;
			// r = pixelArray[y + idx_y][x + idx_x][0];
			// g = pixelArray[y + idx_y][x + idx_x][1];
			// b = pixelArray[y + idx_y][x + idx_x][2];

			let idx = pixel_position(width, x + idx_x, y + idx_y)
			r = pixels[idx];
			g = pixels[idx + 1];
			b = pixels[idx + 2];

			if(holeArray[y + idx_y][x + idx_x] != 1)
			{
				sum_r = sum_r + r;
				sum_g = sum_g + g;
				sum_b = sum_b + b;
				valid_count += 1;
			}
		}
	}
	
	if(valid_count > kernel_size ** 2 * 0.3)
	{
		let idx = pixel_position(width, x, y);
		pixels[idx] = sum_r / valid_count;
		pixels[idx + 1] = sum_g / valid_count;
		pixels[idx + 2] = sum_b / valid_count;
	}
	return;
}

function inverseDistanceWeightingInterpolation(y, x, width, height, kernel_size){
	
	let interval = 0;
	interval = Math.floor(kernel_size / 2);

	let sumDistanceWeight = 0;
	let sumWeightedValueR = 0, sumWeightedValueG = 0, sumWeightedValueB = 0;
	let valid_count = 0;
	for(let idx_y = -interval; idx_y <= interval; idx_y++)
	{
		if(y + idx_y < 0 || y + idx_y > height - 1)
		{
			continue;
		}
		for(let idx_x = -interval; idx_x <= interval; idx_x++)
		{	
			
			if(x + idx_x < 0 || x + idx_x > width - 1)
			{
				continue;
			}

			if(idx_y == 0 && idx_x == 0)
				continue;

			if(holeArray[y + idx_y][x + idx_x] != 1)
			{
				let r = 0, g = 0, b = 0;

				let idx = pixel_position(width, x + idx_x, y + idx_y)
				r = pixels[idx];
				g = pixels[idx + 1];
				b = pixels[idx + 2];
				let distance = euclideanDistance2D([x + idx_x, y + idx_y], [x, y]);
				
				sumDistanceWeight = sumDistanceWeight + (1 / (distance ** 2));
				sumWeightedValueR = sumWeightedValueR + (r / (distance ** 2));
				sumWeightedValueG = sumWeightedValueG + (g / (distance ** 2));
				sumWeightedValueB = sumWeightedValueB + (b / (distance ** 2));
		
				valid_count += 1;
			}
		}
	}
	
	if(valid_count > kernel_size ** 2 * 0.3)
	{
		let idx = pixel_position(width, x, y);
		pixels[idx] = sumWeightedValueR / sumDistanceWeight;
		pixels[idx + 1]= sumWeightedValueG / sumDistanceWeight;
		pixels[idx + 2] = sumWeightedValueB / sumDistanceWeight;
	}

	return;
}

function disposeObject(obj) {
	if (obj.geometry) obj.geometry.dispose();
	if (obj.material) {
		if (obj.material.map) obj.material.map.dispose();
		obj.material.dispose();
	}
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

	render();
}

function animate(timeNow) {
	requestAnimationFrame(animate);
	timeNow *= 0.001;
	const elapsed = timeNow - then;
	if(elapsed > desiredInterval)
	{
		then = timeNow - (elapsed % desiredInterval);
		
		const radius = 2100;  // Distance from center
		const angle = THREE.MathUtils.degToRad(currentAngle);
		
		// Set camera position relative to front
		const x = radius * Math.sin(angle);
		const z = radius * Math.cos(angle);
		const y = 700 
		
		camera.position.set(x, y, z);
		camera.lookAt(300, 490, 0);
		render();
	}
}



