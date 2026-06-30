import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { discardWithNormals, modifyShader } from '../modules/customshader.js';
import { loadSigns } from '../modules/io.js';
import { concave } from '../modules/hull.js';
import { euclideanDistance2D } from '../modules/utility.js';
import { AsyncPCDLoader } from '../asyncPCDLoader/AsyncPCDLoader.js';
import { parseMPD } from '../modules/MPDParser.js'


const totalFrames = 100;
const pointCloudQueue = [];
const frameData = new Map();

let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let isRunning = false;
let screen_coords = [];
let holeArray = [];

let loader;
let pixels;
let camera, scene, renderer, currentPoints, currentFrame = 0;
let scale = 0;
let distance = 0;

let modifiedMesh = null;
let currentAngle = 0;
let startTime, endTime, previous;

const canvas = document.getElementById("webglCanvas");

init();
animate();

async function init() {

	//antialis makes the rendered scene look smoother and more visually appealing by reducing the jagged edges.
	renderer = new THREE.WebGLRenderer({ antialias: false, canvas });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	scale = window.innerHeight * window.devicePixelRatio / 2;

	//set the background image
	renderer.setClearColor(0xffffff);
	document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 3000);
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

	loader = new PCDLoader();
	
	window.addEventListener('resize', onWindowResize);
	loadFrames();
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


// function selectRepresentation(representations, currentBandwidth) {
//     // Find all quality levels that the network can support.
//     const eligibleReps = representations.filter(r => r.bandwidth <= currentBandwidth);

//     // If any are eligible, choose the one with the highest quality (bandwidth).
//     if (eligibleReps.length > 0) {
//         return eligibleReps.reduce((max, r) => r.bandwidth > max.bandwidth ? r : max);
//     } else {
//         // If bandwidth is too low for even the worst quality, fallback to the absolute lowest.
//         return representations.reduce((min, r) => r.bandwidth < min.bandwidth ? r : min);
//     }
// }

// async function playSequence(scene, baseUrl, template, allRepresentations) {
//     const loader = new PCDLoader();
//     let currentFrame = template.startNumber;
//     let currentPointsObject = null;
//     let currentRepresentation = allRepresentations[0]; // Start with a default

//     // --- MANIFEST-DRIVEN TIMING ---
//     const segmentDurationSeconds = template.duration / template.timescale;
//     const frameIntervalMs = segmentDurationSeconds * 1000;
//     const totalFrames = 120; // Simplified total frames based on our manifest concept

//     console.log(`Starting playback. Frame interval: ${frameIntervalMs.toFixed(2)}ms.`);

//     function loadNextFrame() {
//         if (!animationState.isPlaying) return;

//         if (currentFrame > totalFrames) {
//             currentFrame = 1; // Loop animation
//         }

//         // ===================================================================
//         // ✅ DYNAMIC ABR LOGIC - THIS IS THE QUALITY SWITCHING PART
//         // ===================================================================
//         // In a real player, this value comes from a bandwidth measurement utility.
//         // Here, we simulate a fluctuating network to demonstrate the switching.
//         const simulatedBandwidth = Math.random() * 200_000_000; // Fluctuates between 0 and 200 Mbps
//         const newRepresentation = selectRepresentation(allRepresentations, simulatedBandwidth);

//         if (currentRepresentation.id !== newRepresentation.id) {
//             console.log(`ABR SWITCH! Bandwidth: ${(simulatedBandwidth / 1e6).toFixed(1)} Mbps -> New quality: ${newRepresentation.id}`);
//             currentRepresentation = newRepresentation;
//         }

//         const url = baseUrl + template.media
//             .replace('$RepresentationID$', currentRepresentation.id)
//             .replace('$Number%04d$', currentFrame.toString().padStart(4, '0'));
        
//         loader.load(url, points => {
//             if (!animationState.isPlaying) return;

//             // --- PROFESSIONAL MEMORY MANAGEMENT ---
//             if (currentPointsObject) {
//                 scene.remove(currentPointsObject);
//                 currentPointsObject.geometry.dispose();
//                 currentPointsObject.material.dispose();
//             }

//             scene.add(points);
//             currentPointsObject = points;
//             currentFrame++;

//             // Schedule the next frame according to the manifest's timing
//             animationState.timeoutId = setTimeout(loadNextFrame, frameIntervalMs);
//         }, undefined, (err) => {
//             console.error(`Failed to load frame ${currentFrame} from ${url}:`, err);
//             // In a real player, you might retry or switch to a lower quality upon error.
//             if (animationState.isPlaying) {
//                  animationState.timeoutId = setTimeout(loadNextFrame, frameIntervalMs); // Try next frame
//             }
//         });
//     }

//     loadNextFrame(); // Kick off the animation loop
// }
// async function loadPCDSequence(manifestUrl, scene, desiredFpsId) {
//     console.log(`🚀 Controller: Received request for FPS track: ${desiredFpsId}`);

//     // ✅ STATE MANAGEMENT: Cleanly stop any currently running animation.
//     // This is critical for preventing multiple animation loops from running simultaneously
//     // when the user rapidly clicks different FPS buttons.
//     if (animationState.isPlaying) {
//         console.log("⏹️ Controller: Stopping previous animation.");
//         animationState.isPlaying = false; // Set the master switch to OFF.
//         clearTimeout(animationState.timeoutId); // Cancel the pending next frame load.
//     }

//     try {
//         const manifest = await parseMPD(manifestUrl);
//         const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
//         const period = manifest.periods[0];
//         const adaptationSet = period.adaptationSets.find(set => set.id === desiredFpsId);
//         if (!adaptationSet) throw new Error(`AdaptationSet with ID "${desiredFpsId}" not found.`);
//         const template = adaptationSet.SegmentTemplate;
//         const allRepresentations = adaptationSet.representations;

//         // ✅ STATE MANAGEMENT: Set the master switch to ON and start the engine.
//         animationState.isPlaying = true;
//         await playSequence(scene, baseUrl, template, allRepresentations);

//     } catch (error) {
//         console.error("Failed to load or play point cloud sequence:", error);
//         // Ensure state is reset on failure.
//         animationState.isPlaying = false;
//     }
// }

async function loadFrames(batchSize = 1) {

	const MPDURL = '/metafile.mpd';

	const {period, adaption, template, allRepresentations} = await loadMPD(MPDURL, "No Post Processing", "longdress");
	
	const baseUrl = 'http://192.168.125.132/dataset/' + period.id + '/sequences/';
	console.log(period);

    let GOF = template.GOF;
	let totalFrames = template.totalFrame;

    let currentRepresentation = allRepresentations[0]; // Start with a default

	// const batches = Math.ceil(totalFrames / batchSize);
	const batches = Math.ceil(totalFrames / GOF);

	startTime = performance.now();

	for (let batch = 0; batch < batches; batch++) {
        const promises = [];
		// Start index of the batch
        const start = batch * GOF;
        // End index of the batch
        const end = Math.min(start + GOF, totalFrames);
		
		// let visibilityStatus = [];
		// console.log(visibilityStatus);
		const simulatedBandwidth = Math.random() * 200_000_000; // Fluctuates between 0 and 200 Mbps
		const newRepresentation = selectRepresentation(allRepresentations, simulatedBandwidth);
		
		if (currentRepresentation.id !== newRepresentation.id) {
			console.log(`LoD Switch! -> New LoD: ${newRepresentation.id}`);
			currentRepresentation = newRepresentation;
		}

		const getNumber = currentRepresentation.id.replace(/\D/g, '');
		let targetLoD = parseInt(getNumber, 10);
		let pointSize = currentRepresentation.pointSize;
		console.log(targetLoD, pointSize);
		
		let visibilityStatus = await loadSigns(start, end, targetLoD);


		for (let i = start; i < end; i++) {
			frameData.set(i, []);
			for(let level = 0; level < targetLoD; level++)
			{
				const timeLabel = `Frame ${i}, LoD ${level}`;
				const url = baseUrl + `frame${i.toString().padStart(4, '0')}/level${level}.pcd`;				

				console.time(`Total Time ${timeLabel}`);
				console.time(`Downloading Delay ${timeLabel}`);

				const promise = fetch(url)
					.then(res => res.arrayBuffer())
					.then(buffer => {
						// console.log(`Starting decode for frame #${i}`);
						console.timeEnd(`Downloading Delay ${timeLabel}`);
						loadModel(buffer, i, targetLoD, level, visibilityStatus, pointSize, timeLabel);
					})
					.catch(error => {
						console.error(`Error fetching or decoding frame #${i}:`, error);
					});
				promises.push(promise);
			}
		}
        // Wait for the current batch to complete before moving on to the next
        await Promise.all(promises);
        // console.log(`Batch ${batch + 1} of ${batches} completed.`);
    }
}

// async function loadFrames(batchSize = 1) {
//     const batches = Math.ceil(totalFrames / batchSize);
// 	startTime = performance.now();
//     for (let batch = 0; batch < batches; batch++) {
//         const promises = [];
//         let targetLoD = 2;
// 		// Start index of the batch
//         const start = batch * batchSize;
//         // End index of the batch
//         const end = Math.min(start + batchSize, totalFrames);
		
		
// 		let visibilityStatus = await loadSigns(start, end, targetLoD);
		
// 		// let visibilityStatus = [];
// 		// console.log(visibilityStatus);

// 		for (let i = start; i < end; i++) {
// 			frameData.set(i, []);
// 			for(let level = 0; level < targetLoD; level++)
// 			{
// 				const url = `http://192.168.125.132/dataset/longdress/sequences/frame${i.toString().padStart(4, '0')}/level${level}.pcd`;
// 				console.time("Downloading Delay");
// 				console.time("Total Time");
// 				const promise = fetch(url)
// 					.then(res => res.arrayBuffer())
// 					.then(buffer => {
// 						// console.log(`Starting decode for frame #${i}`);
// 						console.timeEnd("Downloading Delay");
// 						loadModel(buffer, i, targetLoD, level, visibilityStatus);
// 					})
// 					.catch(error => {
// 						console.error(`Error fetching or decoding frame #${i}:`, error);
// 					});
// 				promises.push(promise);
// 			}
// 		}
//         // Wait for the current batch to complete before moving on to the next
//         await Promise.all(promises);
//         // console.log(`Batch ${batch + 1} of ${batches} completed.`);
//     }
// }

async function loadModel(buffer, index, targetLoD, currentLevel, visibilityStatus, pointSize, timeLabel) {
 try {
		console.time(`Loading Delay ${timeLabel}`);
		// const asyncLoader = new AsyncPCDLoader();
		// const points = await asyncLoader.parse(buffer);
		const points = loader.parse(buffer);

        points.material.vertexColors = true;
        points.material.size = pointSize;
		console.log(`Number of points ${points.geometry.attributes.position.array.length / 3}`);
		
		let sampledAngleLength = visibilityStatus.length / targetLoD;
		// modifyShader(points.material, currentAngle, sampledAngleLength);
		// discardWithNormals(points.material);

		let startIdx = 0; let endIdx = 0;
		startIdx = currentLevel * sampledAngleLength;
		endIdx = sampledAngleLength * (currentLevel + 1);
		let name = 0;
		for(let i = startIdx; i < endIdx; i++)
		{
			points.geometry.setAttribute(`Angle_${name * 30}`, new THREE.Float32BufferAttribute(visibilityStatus[i], 1));
			name += 1;
		}
		
		// Get the array of levels for the current frame index
        const frameLevels = frameData.get(index);
		frameLevels.push(points);
        // Check if all levels for this frame have been loaded
        if (frameLevels.length === targetLoD) {
            // All levels are here, so create a group
            const singleObject = new THREE.Group();
            for (const p of frameLevels){
                singleObject.add(p);
            }

            // Now, add the SINGLE combined group to the render queue
            pointCloudQueue.push({ points: singleObject, index: index });
            
            // Clean up memory
            // frameData.delete(index); 
            // console.log(`<Frame #${index} is complete and queued for rendering>`);
			// visibilityStatus.splice(0, visibilityStatus.length);
			console.timeEnd(`Loading Delay ${timeLabel}`);
			console.timeEnd(`Total Time ${timeLabel}`);
        }
    } catch (error) {
        console.error(`Error parsing PCD data for frame #${index}:`, error);
    }   
}

async function modify_pixels() {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
	isRunning = true;	
	try
	{
		console.time("Post-Processing Delay");
		// const canvas = renderer.domElement;
		// const canvas = document.getElementById('webglCanvas');
		const gl = canvas.getContext('webgl2');

		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

		screen_coords.splice(0, screen_coords.length);
		holeArray.splice(0, holeArray.length);
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
		// console.log(pixels);

		// console.time("Coordinate Transform Time");
		let worldPosition = new THREE.Vector3();	

		let childIdx = 0;
		let hullPoints = 0;

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
			if(childIdx == 0)
			{
				// console.log(`Screen Coordinate Length ${screen_coords.length}`);
				
				// // console.time("Sort Time");
				// screen_coords.sort((a, b) => {
				// 	// First, try to sort by the x-coordinate (a[0] vs b[0])
				// 	if (a[0] !== b[0]) {
				// 		return a[0] - b[0];
				// 	}
				// 	// If x-coordinates are the same, sort by the y-coordinate (a[1] vs b[1])
				// 	else {
				// 		return a[1] - b[1];
				// 	}
				// });
				// // console.timeEnd("Sort Time");
				
				// const sampled_coords = [];
				// for (let j = 0; j < screen_coords.length; j += 3) 
				// {
				// 	sampled_coords.push(screen_coords[j]);
				// }

				// console.log(`Sampled Coordinate Length: ${sampled_coords.length}`);

				// console.time("Calculate ConcaveHull Time");
				hullPoints = concave(screen_coords);
				// console.timeEnd("Calculate ConcaveHull Time");
			}
			childIdx += 1;
		}

		// console.time("Make Set Time");
		// let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		// screen_coords.splice(0, screen_coords.length);
		// // Convert back to arrays if needed
		// screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		// console.log(`Screen Coordinate Length ${screen_coords.length}`);
		// console.timeEnd("Make Set Time");

		// console.timeEnd("Coordinate Transform Time");
	
		detect_holesConcave(hullPoints, width, height);

		// console.time("Interpolation Time");
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
		// console.timeEnd("Interpolation Time");
		
		// console.time("Upload Mesh Time");

		const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
		texture.colorSpace = THREE.SRGBColorSpace;

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
		scene.add(modifiedMesh);
		renderer.render(scene, textureCamera);
		// console.timeEnd("Upload Mesh Time");
		
		console.timeEnd("Post-Processing Delay");
		console.timeEnd("Total Time"); 
	}
	finally{
		isRunning = false;
	}		
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
	
	if (pointCloudQueue.length > 0) {
		pointCloudQueue.sort((a, b) => a.index - b.index); // Ensure frames are added in order
		
		// console.log(`current frame: ${currentFrame}, first value: ${pointCloudQueue[0].index}`);

		if(currentFrame == pointCloudQueue[0].index)
		{
			const frame = pointCloudQueue.shift();
			if (currentPoints) {
				scene.remove(currentPoints);
				disposeObject(currentPoints);
			}
			currentPoints = frame.points;
			scene.add(currentPoints);
			frameDisplay.innerHTML = `Frame: ${frame.index}`;
			console.log(`Current frame: ${currentFrame}, Interval: ${performance.now()-previous}`);
			previous = performance.now();
			currentFrame++;
			renderer.render(scene, camera);
			// modify_pixels();
		}

		if (currentFrame >= totalFrames) {
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
function pixel_position(width, screen_x, screen_y)
{
	return (width * screen_y + screen_x) * 4;
}
function log_coord(pixels, worldPosition, width, height) {
	
	// Step 1: World to Camera (View) Coordinates
	const cameraPosition = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse);
	let occupied_pixels = 0;
	occupied_pixels = (pointSize * scale) / -cameraPosition.z;
	// Step 2: Camera to NDC
	const ndcPosition = cameraPosition.clone().applyMatrix4(camera.projectionMatrix);

	// // Step 3: NDC to Screen Coordinates
	const x = (ndcPosition.x + 1) * windowWidth / 2 * devicePixelRatio;
	const y = (ndcPosition.y + 1) * windowHeight / 2 * devicePixelRatio;

	if(x < 0 || x > width - 1)
		return;
	if(y < 0 || y > height - 1)
		return;
	
	let index = pixel_position(width, Math.floor(x), Math.floor(y));
	if(pixels[index] == 255 && pixels[index + 1] == 255 && pixels[index + 2] == 255)
		return;
	
	screen_coords.push([Math.floor(x), Math.floor(y)]);
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