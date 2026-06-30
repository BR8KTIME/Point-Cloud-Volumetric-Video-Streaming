import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { concave } from './modules/hull.js';

import { euclideanDistance2D, euclideanDistance3D, median, computeIQR, calculateBins, createHistogram, otsuThreshold, getThreshold, getAverage  } from './modules/utility.js';
import { deltaE } from './modules/LabSpace.js';
import { saveFile } from './modules/io.js';
import { discardAddDepth } from './modules/customshader.js';

let camera, scene, renderer, currentAngle;

let isRunning = false;
let screen_coords = [];
let scale = 0;
let depthHoleArray = [];
let concaveHoleArray = [];
var pixels;
let pointSize = 0;

let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let modifiedMesh, postMesh;
let dataRecord = [];
let postRecord = [];

let dracoLoader;

const canvas = document.getElementById("webglCanvas");
let currentPoints;
let minScreenX = Number.MAX_SAFE_INTEGER, minScreenY = Number.MAX_SAFE_INTEGER;
let maxScreenX = 0, maxScreenY = 0;


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
	// console.log(`Canvas Size: ${window.innerWidth}, ${window.innerHeight}\n`);
	scale = window.innerHeight * window.devicePixelRatio / 2;
	// console.log(`Scale: ${scale}\n`);
	
	//set the background image
	renderer.setClearColor(0xffffff);
	renderer.setClearAlpha(0);

	// renderer.setClearColor(0x000000);

	// document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();

	// camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 40);
	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 500, 5000);
	
	//longdress
	// camera.position.set(44.63, 518.86, 1505.91);
	//soldier
	// camera.position.set(44.63, 518.86, 1575.91);
	//redandblack
	// camera.position.set(644.63, 518.86, 1505.91);
	//loot
	// camera.position.set(44.63, 518.86, 1575.91);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.addEventListener('change', renderT); // use if there is no animation loop
	controls.minDistance = 0.01;
	controls.maxDistance = 10000;
	
	const radius = 1700; // Distance from center 1700 700 1700 2750
	currentAngle = 0;    // 0 = front, 90 = right, 180 = back, etc.
	const angle = THREE.MathUtils.degToRad(currentAngle);

	const x = radius * Math.sin(angle);
	const z = radius * Math.cos(angle);
	const y = 700; 

	camera.position.set(x, y, z);
	camera.lookAt(300, 490, 0); 
	
	scene.add(camera);

	dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath('./draco/');
	dracoLoader.setDecoderConfig({ type: 'js' });
	dracoLoader.setWorkerLimit(4);
	dracoLoader.preload();
	

	window.addEventListener('resize', onWindowResize);
	start();
}

async function start() {
	let baseURL = 'http://141.223.65.28/dataset/loot/sequence/'

    let format = '.drc';

    const totalFrames = 1; 
    const frameNumberPadding = 4; // '0000' has 4 digits

	let actualFrameIdx = 120;
    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
        const frameNumStr = actualFrameIdx.toString();
        const paddedFrameNum = frameNumStr.padStart(frameNumberPadding, '0');

		for(let k = 4; k <= 14; k += 0.5)
		{
			pointSize = k;
			for (let LODIdx = 1; LODIdx < 2; LODIdx++) {
				const url = `${baseURL}frame${paddedFrameNum}/LOD${LODIdx}${format}`;
				await loadModel(url, frameIdx, LODIdx);		
				clearCanvas();
				clearMesh();
			}
		}
	}
	console.log(dataRecord);
	console.log(postRecord);
	saveFile(dataRecord, "Hole_Area");
	saveFile(postRecord, "Post_Hole_Area");
}
function clearCanvas()
{
	scene.remove(currentPoints);
	disposeObject(currentPoints);
}

function clearMesh()
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

	if (postMesh) {
		scene.remove(postMesh);
		// 2. Dispose geometry and material
		postMesh.geometry.dispose();
		postMesh.material.dispose();

		// 3. Dispose texture
		if (postMesh.material.map) {
			postMesh.material.map.dispose();
		}

		// 4. Null out references (optional, helps GC)
		postMesh.geometry = null;
		postMesh.material.map = null;	
		postMesh.material = null;
		postMesh = null;
	}
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
			
			let position = points.geometry.attributes.position.array;
			let objectcentroid = new THREE.Vector3();
			for(let i = 0; i < position.length; i += 3) 
			{
				objectcentroid.x += position[i];
				objectcentroid.y += position[i + 1];
				objectcentroid.z += position[i + 2];
			}
			objectcentroid.divideScalar(position.length / 3);	
			let distance = euclideanDistance3D(objectcentroid, camera.position);
			console.log(`Distance: ${distance}`);

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

			// if(level == 1)
			console.log(`🎆 Total Points: ${totalPoints}, Frame: ${frameIdx}, LoD: ${LODIdx}, Point Size: ${pointSize}`);
			modify_pixels();

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

function log_coord(pixels, worldPosition, width, height) {
	
	// Step 1: World to Camera (View) Coordinates
	const cameraPosition = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse);

	// let occupied_pixels = 0;
	// occupied_pixels = (pointSize * scale) / -cameraPosition.z;
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

async function modify_pixels() {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
	isRunning = true;	
	try
	{
		// console.time("🖼️ Total Time"); 
		const gl = renderer.getContext('webgl2');

		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

		screen_coords.splice(0, screen_coords.length);
		
		pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);

		gl.readPixels(
			0,
			0,
			gl.drawingBufferWidth,
			gl.drawingBufferHeight,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixels);		
		
		//Initialize hole array
		depthHoleArray = Array(height).fill().map(() => Array(width).fill(0));
		concaveHoleArray = Array(height).fill().map(() => Array(width).fill(0));

		minScreenX = Number.MAX_SAFE_INTEGER, minScreenY = Number.MAX_SAFE_INTEGER;
		maxScreenX = 0, maxScreenY = 0;

		// console.time("Coordinate Transform Time");
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
		
		detect_holesDepth(width, height);	
		
		let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		screen_coords.splice(0, screen_coords.length);
		// Convert back to arrays if needed
		screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		let hullPoints = concave(screen_coords);
	
		detect_holesConcave(hullPoints, width, height);

		let holeArea = 0;
		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(concaveHoleArray[y][x] == 1)
					holeArea += 1;
			}
		}
		console.log(`🥇Total Hole Area ${holeArea}`);
		dataRecord.push(holeArea);

		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(depthHoleArray[y][x] == 1)
				{
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
	
		renderer.clear();		
		renderer.render(scene, textureCamera);
		// console.timeEnd("🖼️ Total Time"); 
	}
	finally{
		isRunning = false;
		postHoleDetect();
	}		
}

async function postHoleDetect() {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
	isRunning = true;	
	try
	{
		// const canvas = renderer.domElement;
		// const canvas = document.getElementById('webglCanvas');
		const gl = canvas.getContext('webgl2');

		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

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
		concaveHoleArray = Array(height).fill().map(() => Array(width).fill(0));

		let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		screen_coords.splice(0, screen_coords.length);
		// Convert back to arrays if needed
		screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		let hullPoints = concave(screen_coords);
	
		detect_holesConcave(hullPoints, width, height);

		
		let holeArea = 0;
		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(concaveHoleArray[y][x] == 1)
					holeArea += 1;
			}
		}
		console.log(`🥈Total Hole Area ${holeArea}`);
		postRecord.push(holeArea);

		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(concaveHoleArray[y][x] == 1)
				{
					let idx = pixel_position(width, x, y);
					pixels[idx] = 0;
					pixels[idx + 1] = 255;
					pixels[idx + 2] = 0;
				}
			}		
		}		
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
		postMesh = new THREE.Mesh(geometry, material);

		// Set position to center of screen
		postMesh.position.set(width / 2, height / 2, 0);
		scene.add(postMesh);
		renderer.render(scene, textureCamera);
	}
	finally{
		isRunning = false;
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
			let localMax = 0, localMin = Number.MAX_SAFE_INTEGER;
			let localMaxColor = {}, localMinColor = {};
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
								depthHoleArray[y + k][x + l] = 1;
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
			{
				localValues.splice(0, localLength);
				continue;
			}
		
			let stats = computeIQR(localValues);
			let numberofBins = calculateBins(stats.iqr, localMax, localMin, localLength);
			let localHistogram = createHistogram(localValues, 2);
			let thresholdIdx = otsuThreshold(localHistogram);
			let threshold = getThreshold(thresholdIdx, localMin, localMax, 2);
			// console.log(localHistogram);

			let localAverage = getAverage(localValues);

			// let begin = getThreshold(0, localMin, localMax, 2);
			// let end = getThreshold(1, localMin, localMax, 2);
			// console.log(`Begin: ${begin.start}, ${begin.end}`);
			// console.log(`End: ${end.start}, ${end.end}`);
			// console.log(localMaxVector, localMinVector, colorDistance);
			
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
							if(depthHoleArray[y + k][x + l] == 1)
								continue;

							let idx = pixel_position(width, x + l, y + k);
							let depth = pixels[idx + 3];

							if(depth >= localAverage)
							{	
								depthHoleArray[y + k][x + l] = 1;
							}
						}
					}
				}
			}
			localValues.splice(0, localLength);
		}
	}
}

function detect_holesConcave(hullPoints, width, height){
	
	// for(let i = 0; i < hullPoints.length; i++)
	// {
	// 		let px = hullPoints[i][0];
	// 		let py = hullPoints[i][1];

	// 		let idx = pixel_position(width, px, py);
	// 		pixels[idx] = 0;
	// 		pixels[idx + 1] = 0;
	// 		pixels[idx + 2] = 255;
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

		// let avg_r = 0, avg_g = 0, avg_b = 0;
		// let interval = 5; 
		// for(let idx_y = -interval; idx_y <= interval; idx_y++)
		// {
		// 	if(y + idx_y < 0 || y + idx_y > height - 1)
		// 		continue;
		// 	for(let idx_x = -interval; idx_x <= interval; idx_x++)
		// 	{	
		// 		if(x + idx_x < 0 || x + idx_x > width - 1)
		// 			continue;
		// 		if(idx_y == 0 && idx_x == 0)
		// 			continue;
				
		// 		let nr = 0, ng = 0, nb = 0;
		// 		nr = pixelArray[y + idx_y][x + idx_x][0];
		// 		ng = pixelArray[y + idx_y][x + idx_x][1];
		// 		nb = pixelArray[y + idx_y][x + idx_x][2];
		// 		avg_r += nr;
		// 		avg_g += ng;
		// 		avg_b += nb;
		// 	}
		// }

		if(r >= 220 && g >= 220 && b >= 220)
		{
			concaveHoleArray[py][px] = 1;
		}
		// if(r <= 10 && g <= 10 && b <= 10)
		// {
		// 	holeArray[py][px] = 1;
		// }
	}
}

function renderT() {
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
	
	scene.traverse((object) => {
        if (object.isPoints && object.dataMaterial) {
            object.material = object.dataMaterial;
        }
    });
	
	renderer.setRenderTarget(renderTarget);
	renderer.clear();
	renderer.render(scene, camera);

	// if(level == 1)
	modify_pixels();

	// scene.traverse((object) => {
    //     if (object.isPoints && object.visualMaterial) {
    //         object.material = object.visualMaterial;
    //     }
    // });

    // renderer.setRenderTarget(null);
    // renderer.clear();
    // renderer.render(scene, camera);
}

function meanValueIntepolation(y, x, width, height, kernel_size){
	
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
	let idx = pixel_position(width, x, y);
	if(valid_count > kernel_size ** 2 * 0.3)
	{
		pixels[idx] = sum_r / valid_count;
		pixels[idx + 1]= sum_g / valid_count;
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

			if(depthHoleArray[y + idx_y][x + idx_x] != 1)
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

	let idx = pixel_position(width, x, y);
	if(valid_count > kernel_size ** 2 * 0.3)
	{
		pixels[idx] = sumWeightedValueR / sumDistanceWeight;
		pixels[idx + 1]= sumWeightedValueG / sumDistanceWeight;
		pixels[idx + 2] = sumWeightedValueB / sumDistanceWeight;
	}
	return;
}
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderT();
}

