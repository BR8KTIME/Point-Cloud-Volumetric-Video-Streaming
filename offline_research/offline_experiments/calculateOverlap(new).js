import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import {euclideanDistance2D, median, getAverage, computeIQR, calculateBins, otsuThreshold, getThreshold, createHistogram } from './modules/utility.js';
import { saveFile } from './modules/io.js';
import { discardAddDepth } from './modules/customshader.js';
import { deltaE } from './modules/LabSpace.js';

let camera, scene, renderer, currentAngle;

let isRunning = false;
let screen_coords = [];
let scale = 0;
let point_info_array = [];
let overlapped_array = [];
let pixelArray = [];
let pixels_on_screen = [];
let occupied_pixels_arr = [];
var pixels;
let pointSize = 0;
let overlapArea = 0;

let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let modifiedMesh;
let dataRecord = [];

const canvas = document.getElementById("webglCanvas");
let currentPoints;


let dracoLoader;


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function wait() {
  console.log("before");
  sleep(10).then(() => init());
  console.log("done!");
}

wait();

const targetOptions = {
	format: THREE.RGBAFormat, // Store Red, Green, Blue, and Alpha
	type: THREE.UnsignedByteType
};

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, targetOptions);

async function init() {

	//antialis makes the rendered scene look smoother and more visually apealing by reducing the jagged edges
	renderer = new THREE.WebGLRenderer({ antialias: false, canvas, alpha: true, premultipliedAlpha: false});
	renderer.setPixelRatio(window.devicePixelRatio);
	console.log(window.devicePixelRatio)
	renderer.setSize(window.innerWidth, window.innerHeight);
	console.log(`Canvas Size: ${window.innerWidth}, ${window.innerHeight}\n`);
	scale = window.innerHeight * window.devicePixelRatio / 2;
	console.log(`Scale: ${scale}\n`);
	
	//set the background image
	// renderer.setClearColor(0xffffff);
	// renderer.setClearColor(0x000000);
	renderer.setClearColor(0xffffff);
	renderer.setClearAlpha(0);

	// document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();

	// camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 40);
	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 5000);
	
	//longdress
	// camera.position.set(44.63, 518.86, 1505.91);
	//soldier
	// camera.position.set(44.63, 518.86, 1575.91);
	//redandblack
	// camera.position.set(644.63, 518.86, 1505.91);
	//loot
	// camera.position.set(44.63, 518.86, 1575.91);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.addEventListener('change', render); // use if there is no animation loop
	controls.minDistance = 0.01;
	controls.maxDistance = 10000;

	const radius = 1700;  // Distance from center
	currentAngle = 0;    // 0 = front, 90 = right, 180 = back, etc.
	const angle = THREE.MathUtils.degToRad(currentAngle);

	// Set camera position relative to front
	const x = radius * Math.sin(angle);
	const z = radius * Math.cos(angle);
	const y = 550 // maintain current Y (or set as needed) 700

	camera.position.set(x, y, z);
	camera.lookAt(300, 490, 0);
	// camera.lookAt(250, 690, 0);	

	scene.add(camera);

	window.addEventListener('resize', onWindowResize);

	dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('./draco/');
	dracoLoader.setDecoderConfig({ type: 'js' });
	dracoLoader.setWorkerLimit(4);
	dracoLoader.preload();
	
	start();
}

async function start() {
	let baseURL = 'http://141.223.65.28/dataset/redandblack/sequence/'
    let format = '.drc';

    const totalFrames = 1; // Let's say you want to loop through frames 0 to 9
    const frameNumberPadding = 4; // '0000' has 4 digits
	let actualFrameIdx = 230;
	
	for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
		const frameNumStr = actualFrameIdx.toString();
        const paddedFrameNum = frameNumStr.padStart(frameNumberPadding, '0');

		for(let k = 4; k <= 12; k+=0.5)
		{
			pointSize = k;
			for (let LODIdx = 0; LODIdx < 15; LODIdx++) {
				const url = `${baseURL}frame${paddedFrameNum}/LOD${LODIdx}${format}`;
	
				await loadModel(url, frameIdx, LODIdx);		
				clearCanvas();
			}
		}
	}
	console.log(dataRecord);
	saveFile(dataRecord, "Overlap_Area");	
}

function clearCanvas()
{
	
	scene.remove(currentPoints);
	disposeObject(currentPoints);
	
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
	renderer.render(scene, camera);
}

function disposeObject(obj) {
	if (obj.geometry) obj.geometry.dispose();
	if (obj.material) {
		if (obj.material.map) obj.material.map.dispose();
		obj.material.dispose();
	}
}

async function loadModel(url, frameIdx, LODIdx) {
	// Return a new Promise that encapsulates the asynchronous loading process
	return new Promise(async (resolve, reject) => {
		dracoLoader.load(url, function (geometry) {
		try{
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

			scene.add(points);
			currentPoints = points;
			let totalPoints = 0;
			
			totalPoints += currentPoints.geometry.attributes.position.array.length / 3;
		
			scene.traverse((object) => {
				if (object.isPoints && object.dataMaterial) {
					object.material = object.dataMaterial;
				}
			});

			renderer.setRenderTarget(renderTarget);
			renderer.clear();
			renderer.render(scene, camera);			
			calculateOverlap();
			console.log(`Total Points: ${totalPoints}, Frame: ${frameIdx}, LoD: ${LODIdx}, Point Size: ${pointSize}`);
			resolve();
		} catch (error){
			console.error(`Error processing point cloud for ${URL}:`, error);
			reject(error); // Reject the Promise if any error occurs during processing
		}});
	}); 	
}

function pixel_position(width, screen_x, screen_y)
{
	return (width * screen_y + screen_x) * 4;
}


function log_coord(worldPosition, width, height, index) {
	
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

	let idx = pixel_position(width, Math.floor(x), Math.floor(y));
	
	// if(pixels[idx] == 0 && pixels[idx + 1] == 0 && pixels[idx + 2] == 0)
	// 	return;
	// if(index == 0)
	// {
	// 	console.log(y, x, occupied_pixels, pixels[idx], pixels[idx + 1], pixels[idx + 2])
	// }

	screen_coords.push([[x, y], occupied_pixels]);

	return;
}

function calculate_boundingbox(width, height)	
{
	//Bounding Box for each points
	let arr = [];
	for(let j = 0; j < screen_coords.length; j++)
	{
		let point_info = {};
		const screen_x = screen_coords[j][0][0];
		const screen_y = screen_coords[j][0][1];
		const sizePixels = screen_coords[j][1];

		// const upper_corners_x = Math.round((screen_x - sizePixels / 2) * 100) / 100;
		// const upper_corners_y = Math.round((screen_y + sizePixels / 2) * 100) / 100;
		// const lower_corners_x = Math.round((screen_x + sizePixels / 2) * 100) / 100;
		// const lower_corners_y = Math.round((screen_y - sizePixels / 2) * 100) / 100;

		const upper_corners_x = Math.floor((screen_x - sizePixels / 2));
		const upper_corners_y = Math.floor((screen_y + sizePixels / 2));
		const lower_corners_x = Math.floor((screen_x + sizePixels / 2));
		const lower_corners_y = Math.floor((screen_y - sizePixels / 2));

		// if(j == 6000)
		// {
		// 	console.log(`Size in pixels ${sizePixels}`);
		// 	console.log(`Actual Value:  ${screen_x - sizePixels / 2}, ${screen_y + sizePixels / 2}, ${screen_x + sizePixels / 2}, ${screen_y - sizePixels / 2}`);
		// 	console.log(`Rounded Value:  ${upper_corners_x}, ${upper_corners_y}, ${lower_corners_x}, ${lower_corners_y}`);
		// }

		if(lower_corners_x < 0 || upper_corners_x >= width)
			continue;
		if(upper_corners_y < 0 || lower_corners_y >= height)
			continue;

		point_info = {
					  Upper_x: upper_corners_x, 
					  Upper_y: upper_corners_y,
					  Lower_x: lower_corners_x,
					  Lower_y: lower_corners_y};

		// if(point_info.Lower_x < 0 || point_info.Upper_x >= width)
		// 	continue;
		// if(point_info.Upper_y < 0 || point_info.Lower_y >= height)
		// 	continue;

		arr.push(point_info);
	}
	return arr;
}

function calculateOverlappingRegion(point_info_array, width, height)
{
	let arr = [];
	let overlapped_region = {};
	let type = 0;
	let overlapping_counts = 0;
	let type_1 = 0, type_2 = 0, type_3 = 0, type_4 = 0, type_5 = 0, type_6 = 0, type_7 = 0, type_8 = 0;
	for(let k = 0; k < point_info_array.length; k++)
	{
		if(k == 0)
			continue;
		for(let l = k - 1; l >= 0; l--)
		{
			overlapped_region = {}
			if(point_info_array[k].Upper_x > point_info_array[l].Lower_x)
				break;
			else
			{
				type = 0;
				let top_left = {}, top_right = {}, bot_left = {}, bot_right = {};
				if(point_info_array[k].Upper_y <= point_info_array[l].Upper_y)
				{
					if(point_info_array[k].Upper_y <= point_info_array[l].Lower_y)
						continue;

					if(point_info_array[k].Lower_x > point_info_array[l].Lower_x)
					{
						if(point_info_array[k].Lower_y <= point_info_array[l].Lower_y)
						{
							top_left = {x: point_info_array[k].Upper_x, y: point_info_array[k].Upper_y};
							top_right = {x: point_info_array[l].Lower_x, y: point_info_array[k].Upper_y};
							bot_left = {x: point_info_array[k].Upper_x, y: point_info_array[l].Lower_y};
							bot_right = {x: point_info_array[l].Lower_x, y: point_info_array[l].Lower_y};
							type = 1;
							// console.log("Overlapping occurs Case 1");
						}
						else
						{
							top_left = {x: point_info_array[k].Upper_x, y: point_info_array[k].Upper_y};
							top_right = {x: point_info_array[l].Lower_x, y: point_info_array[k].Upper_y};
							bot_left = {x: point_info_array[k].Upper_x, y: point_info_array[k].Lower_y};
							bot_right = {x: point_info_array[l].Lower_x, y: point_info_array[k].Lower_y};
							type = 5;
							// console.log("Overlapping occurs Case 5");
						}
					}
					else
					{
						top_left = {x: point_info_array[k].Upper_x, y: point_info_array[k].Upper_y};
						top_right = {x: point_info_array[k].Lower_x, y: point_info_array[k].Upper_y};
						bot_left = {x: point_info_array[k].Upper_x, y: point_info_array[l].Lower_y};
						bot_right = {x: point_info_array[k].Lower_x, y: point_info_array[l].Lower_y};
						type = 3;
						// console.log("Overlapping occurs Case 3");
					}	
				}
				else
				{
					if(point_info_array[l].Upper_y <= point_info_array[k].Lower_y)
						continue;
						
					if(point_info_array[l].Lower_x < point_info_array[k].Lower_x)
					{
						if(point_info_array[l].Lower_y < point_info_array[k].Lower_y)
						{
							top_left = {x: point_info_array[k].Upper_x, y: point_info_array[l].Upper_y};
							top_right = {x: point_info_array[l].Lower_x, y: point_info_array[l].Upper_y};
							bot_left = {x: point_info_array[k].Upper_x, y: point_info_array[k].Lower_y};
							bot_right = {x: point_info_array[l].Lower_x, y: point_info_array[k].Lower_y};
							type = 2;
							// console.log("Overlapping occurs Case 2");
						}
						else
						{
							top_left = {x: point_info_array[k].Upper_x, y: point_info_array[l].Upper_y};
							top_right = {x: point_info_array[l].Lower_x, y: point_info_array[l].Upper_y};
							bot_left = {x: point_info_array[k].Upper_x, y: point_info_array[l].Lower_y};
							bot_right = {x: point_info_array[l].Lower_x, y: point_info_array[l].Lower_y};
							type = 6;
							// console.log("Overlapping occurs Case 6");
						}
					}
					else
					{
						top_left = {x: point_info_array[k].Upper_x, y: point_info_array[l].Upper_y};
						top_right = {x: point_info_array[k].Lower_x, y: point_info_array[l].Upper_y};
						bot_left = {x: point_info_array[k].Upper_x, y: point_info_array[k].Lower_y};
						bot_right = {x: point_info_array[k].Lower_x, y: point_info_array[k].Lower_y};
						type = 4;
						// console.log("Overlapping occurs Case 4");
					}
				}

				// console.log(`Top-Left Corner: ${top_left.x}, ${top_left.y}`);
				// console.log(`Top-Right Corner: ${top_right.x}, ${top_right.y}`);
				// console.log(`Bottom-Left Corner: ${bot_left.x}, ${bot_left.y}`);
				// console.log(`Bottom-Right Corner: ${bot_right.x}, ${bot_right.y}`);

				if(point_info_array[k].Upper_y == point_info_array[l].Upper_y)
				{
					// console.log("Overlapping Occurs Case 7");
					type = 7;
				}
				if(point_info_array[k].Upper_x == point_info_array[l].Upper_x)
				{
					// console.log("Overlapping Occurs Case 8");
					type = 8;
				}

				if(top_left.x > width || top_right.x < 0)
					continue;
				if(bot_left.y > height || top_left.y < 0)
					continue;
					
				overlapped_region = {start_x: top_left.x, end_x: top_right.x,
										start_y: bot_left.y, end_y: top_left.y,
										type: type};

				if(overlapped_region.start_x < 0)
					overlapped_region.start_x = 0;
				if(overlapped_region.end_x >= width)
					overlapped_region.end_x = width - 1;
				if(overlapped_region.start_y < 0)
					overlapped_region.start_y = 0;
				if(overlapped_region.end_y >= height)
					overlapped_region.end_y = height - 1;
				if(overlapped_region.start_x == overlapped_region.end_x)
					continue;
				if(overlapped_region.start_y == overlapped_region.end_y)
					continue;

				process_overlap_pixels(overlapped_region, width, height);
			}
		}
	}
	return arr;	
}

// function check_if_occupied(overlapped_region)
// {
// 	let x_start = 0, x_end = 0, y_start = 0, y_end = 0;
// 	x_start = overlapped_region.start_x;
// 	x_end = overlapped_region.end_x;
// 	y_start = overlapped_region.start_y;
// 	y_end = overlapped_region.end_y;

// 	let flag = 0;
// 	let occupied_pixels = 0;
	
// 	let area = 0;
// 	let count = 0;

// 	for(let i = y_start; i < y_end; i++)
// 	{
// 		for(let j = x_start; j < x_end; j++)
// 		{	
// 			if(pixels_on_screen[i][j] == 1)
// 				occupied_pixels += 1;
// 			else
// 				area += 1;
// 			count += 1;
// 		}
// 	}

// 	// Checks whether the current region is already occupied by the other overlap region
// 	if(count == occupied_pixels)
// 	{
// 		flag = 1;
// 	}

// 	// If not fill the region
// 	if(flag == 0)
// 	{
// 		for(let i = y_start; i < y_end; i++)
// 		{
// 			for(let j = x_start; j < x_end; j++)
// 			{
// 				pixels_on_screen[i][j] = 1;
// 			}
// 		}
// 	}

// 	return flag;
// }

// function calculateOverlappingRegion(point_info_array, width, height) {
//     for (let k = 1; k < point_info_array.length; k++) {
//         for (let l = k - 1; l >= 0; l--) {            
//             // You can use Math.max/min to find intersections faster than the if-else chains
//             let start_x = Math.max(point_info_array[k].Upper_x, point_info_array[l].Upper_x); // Assuming Upper is Left? Check your coords
//             let end_x   = Math.min(point_info_array[k].Lower_x, point_info_array[l].Lower_x); // Assuming Lower is Right?
//             let start_y = Math.max(point_info_array[k].Upper_y, point_info_array[l].Upper_y);
//             let end_y   = Math.min(point_info_array[k].Lower_y, point_info_array[l].Lower_y);

//             // If coordinates are invalid, no overlap exists
//             if (start_x >= end_x || start_y >= end_y) continue;

//             let overlapped_region = {
//                 start_x: start_x,
//                 end_x: end_x,
//                 start_y: start_y,
//                 end_y: end_y
//             };
//             // 2. Instead of pushing to an array, process the pixels immediately
//             process_overlap_pixels(overlapped_region, width, height);
//         }
//     }
//     return;
// }

function process_overlap_pixels(region, width, height) {
    // Clamp coordinates to screen size to prevent errors
    let x_start = Math.max(0, Math.floor(region.start_x));
    let x_end = Math.min(width, Math.floor(region.end_x));
    let y_start = Math.max(0, Math.floor(region.start_y));
    let y_end = Math.min(height, Math.floor(region.end_y));

    for (let i = y_start; i < y_end; i++) {
        for (let j = x_start; j < x_end; j++) {
            // Only count the pixel if it hasn't been counted before
            if (pixels_on_screen[i][j] === 0) {
                pixels_on_screen[i][j] = 1; // Mark as occupied
                overlapArea++; // Add to total area
            }
            // If it is already 1, we just ignore it (preventing double counting)
        }
    }
}

async function calculateOverlap() {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
	isRunning = true;	
	try
	{
		const gl = canvas.getContext('webgl2')
		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;
		// console.log(gl);	

		pixelArray.splice(0, pixelArray.length);
		screen_coords.splice(0, screen_coords.length);
		occupied_pixels_arr.splice(0, occupied_pixels_arr.length);
		point_info_array.splice(0, point_info_array.length);
		overlapped_array.splice(0, overlapped_array.length);
		pixels_on_screen.splice(0, pixels_on_screen.length);
		// tree.clear();
		pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
		overlapArea = 0;

		gl.readPixels(
			0,
			0,
			gl.drawingBufferWidth,
			gl.drawingBufferHeight,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixels);

		pixels_on_screen = Array(height).fill().map(() => Array(width).fill(0));

		// console.log(`Screen Coordinate Length ${screen_coords.length}`);
		let worldPosition = new THREE.Vector3();
		
		let points = currentPoints.geometry.attributes.position.array;
		for (let i = 0; i < points.length; i += 3)
		{
			// Get the x, y, z coordinates of the point
			const x = points[i];
			const y = points[i + 1];
			const z = points[i + 2];
			worldPosition.set(x, y, z);
			log_coord(worldPosition, width, height, i);
		}
		

		let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		screen_coords.splice(0, screen_coords.length);

		// Convert back to arrays if needed
		screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		// console.log(`Screen Coordinate Length ${screen_coords.length}`);
		
		console.time("Bounding Box Time");
		// Find boundingbox's upper and lower corners of each point
		point_info_array = calculate_boundingbox(width, height);
		point_info_array.sort((a, b) => a.Upper_x - b.Upper_x);
		console.timeEnd("Bounding Box Time");

		// console.log(`Point Info Array: ${point_info_array.length}`);

		console.time("Overlap Time");
		//Using bounding box's corners find the overlapping regions' corners
		calculateOverlappingRegion(point_info_array, width, height);
		// console.log(`Overlap Area Length ${overlapped_array.length}`);
		console.timeEnd("Overlap Time");


		// for(let k = 0; k < overlapped_array.length; k++)
		// {
		// 	let area = 0, area_width = 0, area_height = 0;
		// 	area_width = overlapped_array[k].end_x - overlapped_array[k].start_x;
		// 	area_height = overlapped_array[k].end_y - overlapped_array[k].start_y;
		// 	area = area_width * area_height;
		// 	overlapArea += area;
		// }

		console.log(overlapArea);
		dataRecord.push(overlapArea);
	}
	finally{
		isRunning = false;
	}				
}


function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	render();
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
	

    renderer.render(scene, camera);
}

// function removeBackPoints(width, height)
// {
// 	let window = 10;
// 	let localValues = [];
// 	for(let y = 0; y < height; y += window)
// 	{
// 		for(let x = 0; x < width; x += window)
// 		{
// 			let localMax = 0, localMin = Number.MAX_SAFE_INTEGER;
// 			let localMaxColor = {}, localMinColor = {};
// 			for(let k = 0; k < window; k++) //Find the local average here
// 			{
// 				if(y + k >= minScreenY && y + k <= maxScreenY)
// 				{
// 					for(let l = 0; l < window; l++)
// 					{
// 						if(x + l >= minScreenX && x + l <= maxScreenX)
// 						{
// 							let idx = pixel_position(width, x + l, y + k);
// 							let pixelDepth = pixels[idx + 3];
// 							if(pixelDepth != 0)
// 							{
// 								localValues.push(pixels[idx + 3]);
// 								if(pixelDepth > localMax)
// 								{
// 									localMaxColor = {r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2]};
// 									localMax = pixelDepth;
// 								}
// 								if(pixelDepth < localMin)
// 								{
// 									localMin = pixelDepth;
// 									localMinColor = {r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2]};
// 								}
// 							}
// 							else if(pixels[idx + 3] == 0)
// 							{
// 								// holeArray[y + k][x + l] = 1;
// 							}
// 						}
// 					}
// 				}
// 			}

			
// 			let localLength = localValues.length;
// 			if(localLength == 0)
// 				continue;

// 			let localMaxVector = new THREE.Vector3(localMaxColor.r, localMaxColor.g, localMaxColor.b);
// 			let localMinVector = new THREE.Vector3(localMinColor.r, localMinColor.g, localMinColor.b);
// 			let colorDistance = deltaE(localMaxVector, localMinVector);
			
// 			// console.log(`Color Distance : ${colorDistance}`);
// 			// console.log(localValues);

// 			if(colorDistance < 2)
// 			{
// 				localValues.splice(0, localLength);
// 				continue;
// 			}
		
// 			let stats = computeIQR(localValues);
// 			let numberofBins = calculateBins(stats.iqr, localMax, localMin, localLength);
// 			let localHistogram = createHistogram(localValues, 2);
// 			let thresholdIdx = otsuThreshold(localHistogram);
// 			let threshold = getThreshold(thresholdIdx, localMin, localMax, 2);
// 			// console.log(localHistogram);

// 			let localAverage = getAverage(localValues);

// 			// let begin = getThreshold(0, localMin, localMax, 2);
// 			// let end = getThreshold(1, localMin, localMax, 2);
// 			// console.log(`Begin: ${begin.start}, ${begin.end}`);
// 			// console.log(`End: ${end.start}, ${end.end}`);
// 			// console.log(localMaxVector, localMinVector, colorDistance);
			
// 			// console.log(`Threshold Index: ${thresholdIdx}, threshold: ${threshold.end}`);
// 			// console.log(localValues);
// 			// console.log("🧨");
			
			

// 			for(let k = 0; k < window; k++) //Find the local average here
// 			{
// 				if(y + k >= minScreenY && y + k <= maxScreenY)
// 				{
// 					for(let l = 0; l < window; l++)
// 					{
// 						if(x + l >= minScreenX && x + l <= maxScreenX)
// 						{
// 							if(holeArray[y + k][x + l] == 1)
// 								continue;

// 							let idx = pixel_position(width, x + l, y + k);
// 							let depth = pixels[idx + 3];

// 							if(depth >= localAverage)
// 							{	
// 								holeArray[y + k][x + l] = 1;
// 							}
// 						}
// 					}
// 				}
// 			}
// 			localValues.splice(0, localLength);
// 		}
// 	}
// }
// async function modify_pixels() {
// 	if (isRunning){
// 		console.log("Still Running");
// 		return;
// 	} 
// 	isRunning = true;	
// 	try
// 	{
// 		console.time("🖼️ Total Time"); 
// 		const gl = renderer.getContext('webgl2');

// 		const width = gl.drawingBufferWidth;
// 		const height = gl.drawingBufferHeight;

// 		screen_coords.splice(0, screen_coords.length);
// 		holeArray.splice(0, holeArray.length);
		
// 		pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);

// 		gl.readPixels(
// 			0,
// 			0,
// 			gl.drawingBufferWidth,
// 			gl.drawingBufferHeight,
// 			gl.RGBA,
// 			gl.UNSIGNED_BYTE,
// 			pixels);		
		
// 		//Initialize hole array
// 		holeArray = Array(height).fill().map(() => Array(width).fill(0));
// 		minScreenX = Number.MAX_SAFE_INTEGER, minScreenY = Number.MAX_SAFE_INTEGER;
// 		maxScreenX = 0, maxScreenY = 0;

// 		// console.time("Coordinate Transform Time");
// 		let worldPosition = new THREE.Vector3();
		
// 		let points = currentPoints.geometry.attributes.position.array;
// 		for (let i = 0; i < points.length; i += 3)
// 		{
// 			// Get the x, y, z coordinates of the point
// 			const x = points[i];
// 			const y = points[i + 1];
// 			const z = points[i + 2];
// 			worldPosition.set(x, y, z);
// 			log_coord1(worldPosition, width, height);
// 		}
		
// 		removeBackPoints(width, height);

// 		holeArea = 0;
// 		for(let y = 0; y < height; y++)
// 		{
// 			for(let x = 0; x < width; x++)
// 			{
// 				if(holeArray[y][x] == 1)
// 					holeArea += 1;
// 			}
// 		}
// 		console.log(`Total Hole Area ${holeArea}`);
// 	}
// 	finally{
// 		isRunning = false;
// 		calculateOverlap()
// 	}		
// }
// function log_coord1(worldPosition, width, height) {
	
// 	// Step 1: World to Camera (View) Coordinates
// 	const cameraPosition = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse);

// 	// let occupied_pixels = 0;
// 	// occupied_pixels = (pointSize * scale) / -cameraPosition.z;
// 	// Step 2: Camera to NDC
// 	const ndcPosition = cameraPosition.clone().applyMatrix4(camera.projectionMatrix);
// 	// // Step 3: NDC to Screen Coordinates
// 	const x = (ndcPosition.x + 1) * windowWidth / 2 * devicePixelRatio;
// 	const y = (ndcPosition.y + 1) * windowHeight / 2 * devicePixelRatio;

// 	// const x = (ndcPosition.x + 1) * windowWidth / 2;
// 	// const y = (ndcPosition.y + 1) * windowHeight / 2;

// 	if(x < 0 || x > width - 1)
// 		return;
// 	if(y < 0 || y > height - 1)
// 		return;

// 	let screenX = Math.floor(x);
// 	let screenY = Math.floor(y);
	
// 	let index = pixel_position(width, screenX, screenY);
	
// 	if(pixels[index] == 255 && pixels[index + 1] == 255 && pixels[index + 2] == 255)
// 		return;

// 	if(screenX < minScreenX)
// 		minScreenX = screenX;
// 	else if(screenX > maxScreenX)
// 		maxScreenX = screenX;

// 	if(screenY < minScreenY)
// 		minScreenY = screenY;
// 	else if(screenY > maxScreenY)
// 		maxScreenY = screenY;

// 	screen_coords.push([screenX, screenY]);
// 	return;
// }