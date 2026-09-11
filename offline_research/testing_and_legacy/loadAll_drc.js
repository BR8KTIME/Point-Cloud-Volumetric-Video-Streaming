import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { discardWithNormals, discardAddDepth } from '../modules/customshader.js';
import { loadSigns } from '../modules/io.js';
import { concave } from '../modules/hull.js';
import { euclideanDistance2D, computeIQR, standard_deviation } from '../modules/utility.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { parseMPD } from '../modules/MPDParser.js';


const totalFrames = 100;
const pointCloudQueue = [];
let playbackBuffer = [];
const frameData = new Map();
// State flags and variables for rendering
let isPlaying = false;
let currentPlaybackFrame = 0;


let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let isRunning = false;
let screen_coords = [];
let holeArray = [];

let dracoloader;
let pixels;
let camera, scene, renderer, currentPoints, currentFrame = 0;
let scale = 0;
let modifiedMesh = null;
let currentAngle = 0;
let startTime, endTime, previous;

let minScreenX = Number.MAX_SAFE_INTEGER, minScreenY = Number.MAX_SAFE_INTEGER;
let maxScreenX = 0, maxScreenY = 0;

const canvas = document.getElementById("webglCanvas");

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
	renderer = new THREE.WebGLRenderer({ antialias: false, canvas, alpha: true, premultipliedAlpha: false });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	scale = window.innerHeight * window.devicePixelRatio / 2;

	//set the background image
	renderer.setClearColor(0xffffff);
	renderer.setClearAlpha(0);
	document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2500);
	// console.log(`Aspect Ratio: ${window.innerWidth / window.innerHeight}`)
	// camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 3, 2000);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    // controls.addEventListener('change', render); // use if there is no animation loop

	controls.minDistance = 0.01;
    controls.maxDistance = 10000;

    const radius = 1900;  // Distance from center
    currentAngle = 0;    // 0 = front, 90 = right, 180 = back, etc.
    const angle = THREE.MathUtils.degToRad(currentAngle);

    // Set camera position relative to front
    const x = radius * Math.sin(angle);
    const z = radius * Math.cos(angle);
    const y = 700 // maintain current Y (or set as needed) 700

    camera.position.set(x, y, z);
    camera.lookAt(300, 490, 0);
	window.addEventListener('resize', onWindowResize);


	dracoloader = new DRACOLoader();
	dracoloader.setDecoderPath('./draco/');
	dracoloader.setDecoderConfig({ type: 'js' });
	dracoloader.setWorkerLimit(4);
	dracoloader.preload();
	wait();
}

function selectRepresentation(representations, currentBandwidth) {
    // Find all quality levels that the network can support.
    const eligibleReps = representations.filter(r => r.bandwidth <= currentBandwidth);

    // If any are eligible, choose the one with the highest quality (bandwidth).
    if (eligibleReps.length > 0) {
        return eligibleReps.reduce((max, r) => r.bandwidth > max.bandwidth ? r : max);
    } else {
        // If bandwidth is too low for even the worst quality, fallback to the absolute lowest.
        return representations.reduce((min, r) => r.bandwidth < min.bandwidth ? r : min);
    }
}

async function loadMPD(manifestUrl, renderID, periodId) {
	try {
		const manifest = await parseMPD(manifestUrl);

		const period = manifest.periods.find(p => p.id === periodId);
		const adaptationSet = period.adaptationSets.find(set => set.id === renderID);
		if (!adaptationSet) throw new Error(`AdaptationSet with ID "${renderID}" not found.`);

		const template = adaptationSet.SegmentTemplate;
		if (!template) throw new Error("Selected AdaptationSet does not contain a SegmentTemplate.");
		
		const allRepresentations = adaptationSet.representations;
		if (allRepresentations.length === 0) throw new Error("No representations found in AdaptationSet.");

		let manifestInfo = {period: period, adaption: adaptationSet, template: template, allRepresentations: allRepresentations};
		return manifestInfo;
	} catch (error) {
		console.error("Failed to load MPD File:", error);
	}
}


async function loadFrames() {

	// const batches = Math.ceil(totalFrames / batchSize);

	startTime = performance.now();

	const MPDURL = '/metafileGOF.mpd';

	const {period, adaption, template, allRepresentations} = await loadMPD(MPDURL, "Post Processing", "longdress");
	
	const baseUrl = 'http://192.168.125.132/dataset/' + period.id + '/';
	console.log(period);

    let GOFSize = template.GOFSize;
	let totalFrames = template.totalFrame;
	// let totalFrames = 10;


    let currentRepresentation = allRepresentations[0]; // Start with a default

	// const batches = Math.ceil(totalFrames / batchSize);
	const numGOFs = Math.ceil(totalFrames / GOFSize);

	for (let gofIndex = 0; gofIndex < numGOFs; gofIndex++) {
        const promises = [];
		// Start index of the batch
        const start = gofIndex * GOFSize;
        // End index of the batch
        const end = Math.min(start + GOFSize, totalFrames);

		const simulatedBandwidth = Math.random() * 200_000_000; // Fluctuates between 0 and 100 Mbps
		const newRepresentation = selectRepresentation(allRepresentations, simulatedBandwidth);
		
		if (currentRepresentation.id !== newRepresentation.id) {
			console.log(`LoD Switch! -> New LoD: ${newRepresentation.id}`);
			currentRepresentation = newRepresentation;
		}

		// const getNumber = currentRepresentation.id.replace(/\D/g, '');
		// let targetLoD = parseInt(getNumber, 10);
		// let pointSize = currentRepresentation.pointSize;

		let targetLoD = 5;
		let pointSize = 5.9;
		// console.log(targetLoD, pointSize);
 
		for (let idx = start; idx < end; idx++) {
			frameData.set(idx, []);
			for(let level = 0; level < targetLoD; level++)
			{	
				const timeLabel = `Frame ${idx}, Level ${level}`;
				const url = baseUrl + template.media.replace('$Number%04d$', `${idx.toString().padStart(4, '0')}`).replace('$RepresentationID$', `level${level}`);
				console.log(url);
				// console.time(`Total Time ${timeLabel}`);
				// console.time(`Downloading Delay ${timeLabel}`);
				const promise = fetch(url)
					.then(res => res.arrayBuffer())
					.then(buffer => {
						// console.log(`Starting decode for frame #${i}`);
						// console.timeEnd(`Downloading Delay ${timeLabel}`);
						return loadModel(buffer, idx, targetLoD, pointSize, timeLabel);
					})
					.catch(error => {
						console.error(`Error fetching or decoding frame #${idx}:`, error);
					});
				promises.push(promise);
			}
		}
        // Wait for the current batch to complete before moving on to the next
        await Promise.all(promises);
		startPlaybackOfGOF();	
    }
}

function startPlaybackOfGOF() {
    // If we are already playing, just wait. The new GOF will be played after the current one finishes.
    // This creates a backlog, which is a simple form of a larger playback buffer.
    if (isPlaying) {
        console.log("Buffering next GOF. It will play after the current one finishes.");
        return;
    }

    // Ensure frames are in the correct order before moving them to the playback buffer
    pointCloudQueue.sort((a, b) => a.index - b.index);
    // Move the processed frames to the active playback buffer
    playbackBuffer = [...pointCloudQueue];
    pointCloudQueue.length = 0; // Clear the queue for the next GOF

    if (playbackBuffer.length > 0) {
        console.log(`▶️ Starting playback of ${playbackBuffer.length} frames.`);
		console.log(playbackBuffer);
        currentPlaybackFrame = 0;
        isPlaying = true; // Set the flag to start rendering
    }
}


function loadModel(buffer, index, targetLoD, pointSize, timeLabel) {
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
			
			// points.material.vertexColors = true;
			// points.material.size = pointSize;
			// console.log(points.geometry.attributes.position.array);

			// console.log(`Frame Index: ${index}, Number of points ${points.geometry.attributes.position.array.length / 3}`);
			
			// discardWithNormals(points.material);
			// discardAddDepth(dataMaterial, camera.near, camera.far);
			// discardWithNormals(visualMaterial);
			
			// Get the array of levels for the current frame index
			const frameLevels = frameData.get(index);
			frameLevels.push(points);
			resolve();

			// Check if all levels for this frame have been loaded
			if (frameLevels.length === targetLoD) {
				// All levels are here, so create a group
				const singleObject = new THREE.Group();
				for (const p of frameLevels){
					singleObject.add(p);
				}

				// Now, add the SINGLE combined group to the render queue
				pointCloudQueue.push({ points: singleObject, index: index + 1 });
				// console.timeEnd(`Loading Delay ${timeLabel}`);
				// console.timeEnd(`Total Time ${timeLabel}`);
			}
		};
		const onError = (error) => {
            console.error(`DracoLoader error for frame #${index}:`, error);
            // Reject the promise on loader error
            reject(error);
        };
		dracoloader.parse(buffer, onLoad, onError);
	});
}



// function loadModel(buffer, index, targetLoD, pointSize, timeLabel) {
//  try {
// 	// console.time(`Loading Delay ${timeLabel}`);	
// 	dracoloader.parse(buffer, geometry => {
// 		if (!geometry) {
// 			console.error(`Decoding failed, no geometry returned for frame #${index}`);
// 			reject(new Error(`No geometry returned for frame #${index}`));
// 			return;
// 		}
// 		const material = new THREE.PointsMaterial();
// 		const points = new THREE.Points(geometry, material);	
		
// 		const visualMaterial = points.material;
// 		visualMaterial.vertexColors = true;
// 		visualMaterial.size = pointSize;

// 		const dataMaterial = visualMaterial.clone(); 

// 		dataMaterial.blending = THREE.NoBlending;
// 		dataMaterial.transparent = true;

// 		points.visualMaterial = visualMaterial;
// 		points.dataMaterial = dataMaterial;
		
// 		// points.material.vertexColors = true;
//         // points.material.size = pointSize;
// 		// console.log(points.geometry.attributes.position.array);

// 		// console.log(`Frame Index: ${index}, Number of points ${points.geometry.attributes.position.array.length / 3}`);
		
// 		// discardWithNormals(points.material);
// 		discardAddDepth(dataMaterial, camera.near, camera.far);
// 		discardWithNormals(visualMaterial);
		
// 		// Get the array of levels for the current frame index
//         const frameLevels = frameData.get(index);
// 		frameLevels.push(points);
//         // Check if all levels for this frame have been loaded
//         if (frameLevels.length === targetLoD) {
//             // All levels are here, so create a group
//             const singleObject = new THREE.Group();
//             for (const p of frameLevels){
//                 singleObject.add(p);
//             }

//             // Now, add the SINGLE combined group to the render queue
//             pointCloudQueue.push({ points: singleObject, index: index + 1 });
// 			// console.timeEnd(`Loading Delay ${timeLabel}`);
// 			// console.timeEnd(`Total Time ${timeLabel}`);
//         }
// 		}); 
// 	}
// 	catch (error) {
//         console.error(`Error parsing PCD data for frame #${index}:`, error);
//     }  
// }

function modify_pixels(frameIdx) {
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
		
		for(const child of currentPoints.children)
		{
			let childGeometry = child.geometry.attributes.position.array;
			for (let i = 0; i < childGeometry.length; i += 3)
			{
				// Get the x, y, z coordinates of the point
				const x = childGeometry[i];
				const y = childGeometry[i + 1];
				const z = childGeometry[i + 2];
				worldPosition.set(x, y, z);
				log_coord(pixels, worldPosition, width, height);
			}
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
		
		detect_holesDepth(width, height);

		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(holeArray[y][x] == 1)
				{
					// let idx = pixel_position(width, x, y);
					// pixels[idx] = 0;
					// pixels[idx + 1] = 255;
					// pixels[idx + 2] = 0;
					inverseDistanceWeightingInterpolation(y, x, width, height, 7);
				}
			}		
		}		
		
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
		scene.traverse((object) => {
        	if (object.isPoints && object.visualMaterial) {
            	object.material = object.visualMaterial;
			}
		});
		
   		renderer.clear();		
		renderer.render(scene, textureCamera);

		// if(frameIdx == 85)
		// 	takeScreenshot(frameIdx);
		console.timeEnd(`👓Post-Processing Delay ${frameIdx}`);
	}
	finally{
		isRunning = false;
	}		
}

function screenshot(width, height, rowSize, frameIdx)
{
	const flipped = new Uint8ClampedArray(pixels.length);

	for (let y = 0; y < height; y++) {
		const srcStart = y * rowSize;
		const destStart = (height - y - 1) * rowSize;
		flipped.set(pixels.subarray(srcStart, srcStart + rowSize), destStart);
	}

	// Create ImageData from the modified pixels

	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = width;
	tempCanvas.height = height;
	const tempContext = tempCanvas.getContext('2d');

	const imageData = new ImageData(flipped, width, height);
	tempContext.putImageData(imageData, 0, 0);

	// Save the canvas content as an image
	tempCanvas.toBlob((blob) => {0 
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		// a.download = `alpha_${pointSize}.png`;
		a.download = `LOD${frameIdx + 1}_${pointSize}.png`;
		// a.download = `Proposed_LOD${screenshotLevel + 1}_${pointSize}.png`;
		// a.download = `Proposed_LOD${screenshotLevel + 1}.png`;

		a.click();
		URL.revokeObjectURL(url);
	});
}

function takeScreenshot(frameIdx) {
  // Access the renderer you created for your scene
  // For example: const renderer = new THREE.WebGLRenderer();

  // Get the data URL of the current frame
  const dataURL = renderer.domElement.toDataURL('image/png');

  // Create a temporary link element
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `LOD${frameIdx}_${pointSize}.png`; 

  // Programmatically click the link to trigger the download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function render() {
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
	if (isPlaying && playbackBuffer.length > 0) {
        
        // 1. Remove the previous frame's object from the scene
        if (currentPoints) {
            scene.remove(currentPoints);
			disposeObject(currentPoints);
        }

        // 2. Get the new frame object from our buffer
        currentPoints = playbackBuffer[currentPlaybackFrame].points;
        const frameIndex = playbackBuffer[currentPlaybackFrame].index;
        // 3. Add the new frame object to the scene
        scene.add(currentPoints);
		console.log(`🖼️ ${frameIndex}`);
        frameDisplay.innerHTML = `Frame: ${frameIndex}`;

		console.log(`🪭Current frame: ${frameIndex}, Interval: ${performance.now()-previous} ms`);
		previous = performance.now();
		
		scene.traverse((object) => {
			if (object.isPoints && object.dataMaterial) {
				object.material = object.dataMaterial;
			}
		});
	
		renderer.setRenderTarget(renderTarget);
		renderer.clear();
		renderer.render(scene, camera);
		
		// modify_pixels(frameIndex);

		scene.traverse((object) => {
			if (object.isPoints && object.visualMaterial) {
				object.material = object.visualMaterial;
			}
		});

		renderer.setRenderTarget(null); // Set renderer back to the canvas
		renderer.clear();
		renderer.render(scene, camera);

        // 4. Advance to the next frame
        currentPlaybackFrame++;

        // 5. Check if the GOF playback has finished
        if (currentPlaybackFrame >= playbackBuffer.length) {
            console.log("⏹️ Finished playing GOF.");
            isPlaying = false; // Stop playback
            playbackBuffer = []; // Clear the buffer
            
            // This is a good place to check if another GOF is ready in the pointCloudQueue
            // If so, we can immediately start the next one for continuous playback.
            if (pointCloudQueue.length > 0) {
                // console.log("Seamlessly starting next GOF from buffer...");
                startPlaybackOfGOF();
            }
        }

		if (frameIndex >= totalFrames) {
			endTime = performance.now(); // Record the end time
			const totalTime = (endTime - startTime) / 1000; // Total time in seconds
			const fps = totalFrames / totalTime; // Calculate FPS
			console.log(`Total time to render ${totalFrames} frames: ${totalTime.toFixed(2)} seconds`);
			console.log(`FPS: ${fps.toFixed(2)}`);
			return;
		}
    }

	scene.traverse( function (child)
	{
		if(child.isPoints)
		{
			const shader = child.material.userData.shader;
			if(shader)
			{
				shader.uniforms.angle.value = getCameraAzimuthFromPosition(camera);	
			}
		}
	});
	currentAngle = getCameraAzimuthFromPosition(camera);	
	// renderer.render(scene, camera);
}

function getCameraAzimuthFromPosition(camera) {
	const direction = camera.position.clone();
	direction.y = 0;
	direction.normalize();
	const front = new THREE.Vector3(0, 0, 1);
	let angleRad = Math.acos(front.dot(direction));
  
	const cross = new THREE.Vector3().crossVectors(front, direction); //Cross product calculates a vector perpendicular to both vectors.
	if (cross.y < 0) angleRad = -angleRad; //This function is to negate the angle if the camera is at the left compared to the front direction
  
	let angleDeg = THREE.MathUtils.radToDeg(angleRad);
	angleDeg = (angleDeg + 360) % 360;
	return angleDeg;
}
function detect_holesConcave(hullPoints, width, height){
	
	// for(let i = 0; i < hullPoints.length; i++)
	// {
	// 		let px = hullPoints[i][0];
	// 		let py = hullPoints[i][1];

	// 		let idx = pixel_position(width, px, py);
	// 		pixels[idx] = 255;
	// 		pixels[idx + 1] = 0;
	// 		pixels[idx + 2] = 0;
	// }
	
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = width;
	tempCanvas.height = height;
	const tempContext = tempCanvas.getContext('2d');

	tempContext.beginPath();
	tempContext.moveTo(hullPoints[0][0], hullPoints[0][1]);

	for (let i = 1; i < hullPoints.length; i++) {
		tempContext.lineTo(hullPoints[i][0], hullPoints[i][1]);
	}

	tempContext.closePath();
	tempContext.fillStyle = "white";
	tempContext.fill();

	const imageData = tempContext.getImageData(0, 0, width, height).data;
	const concaveInside = [];

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const alpha = imageData[i + 3]; // check alpha channel
			if (alpha > 0) {
				concaveInside.push([x, y]); // pixel is inside the polygon
			}
		}
	}
	
	
	for(let i = 0; i < concaveInside.length; i++)
	{
		let px = concaveInside[i][0];
		let py = concaveInside[i][1];

		let idx = pixel_position(width, px, py);
		let r = pixels[idx];
		let g = pixels[idx + 1];
		let b = pixels[idx + 2];

		if(r >= 220 && g >= 220 && b >= 220)
		{
			holeArray[py][px] = 1;
			continue;
		}
		// else
		// {
		// 	let avg_r = 0, avg_g = 0, avg_b = 0;
		// 	let interval = 3; 
		// 	let count = 0;
		// 	for(let idx_y = -interval; idx_y <= interval; idx_y++)
		// 	{
		// 		if(py + idx_y < 0 || py + idx_y > height - 1)
		// 			continue;

		// 		for(let idx_x = -interval; idx_x <= interval; idx_x++)
		// 		{	
		// 			if(px + idx_x < 0 || px + idx_x > width - 1)
		// 				continue;
		// 			if(idx_y == 0 && idx_x == 0)
		// 				continue;
					
		// 			let neighborR = 0, neighborG = 0, neighborB = 0;
		// 			let neighborIdx = pixel_position(width, px + idx_x, py + idx_y);
		// 			neighborR = pixels[neighborIdx];
		// 			neighborG = pixels[neighborIdx + 1];
		// 			neighborB = pixels[neighborIdx + 2];

		// 			avg_r += neighborR;
		// 			avg_g += neighborG;
		// 			avg_b += neighborB;

		// 			count += 1;
		// 		}
		// 	}
		// 	avg_r = avg_r / count;
		// 	avg_g = avg_g / count;
		// 	avg_b = avg_b / count;

		// 	if(Math.abs(r - avg_r) > 70 && Math.abs(g - avg_g) > 70 && Math.abs(b - avg_b) > 70)
		// 		holeArray[py][px] = 1;
		// }
		// if(r <= 30 && g <= 30 && b <= 30)
		// {
		// 	holeArray[py][px] = 1;
		// }
	}
}
function detect_holesDepth(width, height)
{
	let window = 10;
	let localValues = [];
	for(let y = 0; y < height; y += window)
	{
		for(let x = 0; x < width; x += window)
		{
			for(let k = 0; k < window; k++) //Find the local average here
			{
				if(y + k >= minScreenY && y + k <= maxScreenY)
				{
					for(let l = 0; l < window; l++)
					{
						if(x + l >= minScreenX && x + l <= maxScreenX)
						{
							let idx = pixel_position(width, x + l, y + k);
							if(pixels[idx + 3] != 0)
							{
								localValues.push(pixels[idx + 3]);
							}
							else if(pixels[idx + 3] == 0)
							{
								holeArray[y + k][x + l] = 1;
							}
						}
					}
				}
			}

			let IQR = computeIQR(localValues);			
			
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

							if(depth > IQR.q3)
							{	
								holeArray[y + k][x + l] = 1;
							}
						}
					}
				}
			}
			localValues.splice(0, localValues.length);
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
function animate() {
	requestAnimationFrame(animate);
	render();
}

/**
 * The main entry point to start the streaming process.
 */
// async function loadFrames() {
//     // Stop any previously running stream
//     if (animationState.isPlaying) {
//         animationState.isPlaying = false;
//         clearTimeout(animationState.timeoutId);
//     }
    
//     console.log("🚀 Initializing stream...");
    
//     try {
//         const MPDURL = '/metafileGOF.mpd';
//         const manifest = await loadMPD(MPDURL, "No Post Processing", "longdress");
        
//         // Extract necessary info from the manifest
//         const { period, adaptationSet, template, allRepresentations } = manifest;
//         const baseUrl = 'http://192.168.125.132/dataset/' + period.id + '/';
//         const totalGOFs = Math.ceil(template.totalFrame / template.GOF);
//         const GOFSize = template.GOF;
//         animationState.isPlaying = true;
        
//         startTime = performance.now();
// 		// ARCHITECTURAL SHIFT: Kick off the sequential, recursive fetcher instead of a for-loop.
//         await fetchAndPlayGOF(0, totalGOFs, GOFSize, baseUrl, template, allRepresentations);

//     } catch (error) {
//         console.error("Stream initialization failed:", error);
//         animationState.isPlaying = false;
//     }
// }

// /**
//  * A recursive function that fetches and plays a SINGLE Group of Frames (GOF),
//  * then schedules the next one. This is the core of the sequential engine.
//  */
// async function fetchAndPlayGOF(GOFIdx, totalGOFs, GOFSize, baseUrl, template, allRepresentations) {
//     // Base case: If the entire sequence is finished, stop.
//     if (GOFIdx >= totalGOFs || !animationState.isPlaying) {
//         console.log("✅ Stream finished or stopped.");
//         return;
//     }

//     try {
//         // ===================================================================
//         // ✅ ABR LOGIC: Performed here, ONCE per GOF, as requested.
//         // ===================================================================
//         const simulatedBandwidth = Math.random() * 200_000_000;
//         const representation = selectRepresentation(allRepresentations, simulatedBandwidth);
//         console.log(`[GOF #${GOFIdx}] 🔄 ABR Decision: Bandwidth ${(simulatedBandwidth / 1e6).toFixed(1)} Mbps -> Selected LoD: ${representation.id}`);
// 		console.log(`[GOF #${GOFIdx}] 🎆 Selected Point Size: ${representation.pointSize}`);

//         // Construct the URL for the current chunk's metadata
//         const chunkMetaDataURL = baseUrl + template.media
//             .replace('$RepresentationID$', "LOD9")
//             .replace('$GOFIdx$', GOFIdx);
            
//         const metaResponse = await fetch(chunkMetaDataURL);
//         const chunkMetadata = await metaResponse.json();
// 		console.log(chunkMetadata);
//         const GOFBaseURL = chunkMetaDataURL.substring(0, chunkMetaDataURL.lastIndexOf('/') + 1);
//         const GOFURL = GOFBaseURL + chunkMetadata.GOF;
        
//         const GOFResponse = await fetch(GOFURL);
//         const GOFBuffer = await GOFResponse.arrayBuffer();

//         // Play the frames from the downloaded buffer. Crucially, we await this
//         // function's completion before proceeding to the next GOF.
//         await playFramesFromBuffer(chunkMetadata, GOFBuffer, GOFIdx, GOFSize, representation.pointSize);

//         // ✅ RECURSIVE CALL: Schedule the next GOF fetch.
// 		console.log(`🚀 Move to next GOF# ${GOFIdx + 1}`);
//         fetchAndPlayGOF(GOFIdx + 1, totalGOFs, GOFSize, baseUrl, template, allRepresentations);

//     } catch (error) {
//         console.error(`Failed to load or play GOF #${GOFIdx}:`, error);
//         // Implement retry logic or skip to the next GOF here.
//     }
// }

// /**
//  * Renders all frames from a single buffer sequentially.
//  * Returns a Promise that resolves when all frames in the buffer are processed.
//  */
// function playFramesFromBuffer(chunkMetadata, buffer, GOFIdx, GOFSize, pointSize) {
//     return new Promise((resolve) => {
// 		let localFrameIndex = 0;
//         const renderNextFrame = () => {
//             if (localFrameIndex >= chunkMetadata.totalFramesInGOF || !animationState.isPlaying) {
//                 resolve();
//                 return;
//             }

//             const frameInfo = chunkMetadata.frames[localFrameIndex];
//             const frameData = buffer.slice(frameInfo.offset, frameInfo.offset + frameInfo.size);
            
//             dracoloader.parse(frameData, geometry => {
//                 if (!geometry) {
//                     console.error(`Decoding failed for frame #${localFrameIndex}`);
//                     // In a real player, you might skip this frame
//                 } else {
//                     const material = new THREE.PointsMaterial({
//                         vertexColors: true,
//                         size: 3.5
//                     });
//                     // discardWithNormals(material);
//                     const points = new THREE.Points(geometry, material);
// 					console.log(`📢Frame #${GOFIdx * GOFSize + localFrameIndex} added to the queue`);
//                     pointCloudQueue.push({ points: points, index: GOFIdx * GOFSize + localFrameIndex });
//                 }

//                 localFrameIndex++;
//                 // ✅ CORRECT RECURSION: Schedule the next frame render *after* the current one is parsed.
//                 renderNextFrame();
//             });
//         };
//         renderNextFrame(); // Kick off the frame rendering loop for this GOF.
//     });
// }



