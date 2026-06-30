import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

import { KDTree } from './modules/KDTree.js'
import { deltaE } from './modules/LabSpace.js';
import { euclideanDistance3D, euclideanDistance2D, median, getAverage, computeIQR, dot, normalize, ORMatrices, checkMatrices, standard_deviation, getModelViewMatrix, createHistogram, calculateBins, otsuThreshold, getThreshold } from './modules/utility.js';
import { remove_pointsNormalBased, remove_pointsSignBased, getSigns} from './modules/removePoints3D.js';
import { concave } from './modules/hull.js';
import { saveFile , readZipFromArrayBuffer, loadSigns} from './modules/io.js';
import { discardAddDepth, discardWithNormals, addDepth } from './modules/customshader.js';


let camera, scene, renderer, currentAngle;
let targetFPS = 30, then = 0;
let desiredInterval = (1 / targetFPS);

let level = 0;
let isRunning = false;
let pointSize = 4;
let targetLOD = 0;

let screen_coords = [];
let scale = 0;
var pixels;



let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let holeArray = new Uint8Array(windowWidth * windowHeight);


let minScreenX = windowWidth, minScreenY = windowHeight;
let maxScreenX = 0, maxScreenY = 0;

let modifiedMesh;

const tree = new KDTree();
const canvas = document.getElementById("webglCanvas");
const POINTS = [];

const longdress_10 = [
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level0.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level1.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level2.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level3.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level4.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level5.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level6.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level7.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level8.pcd',
	'http://192.168.125.132/dataset/longdress/testSingleFrame/with_normals/10_levels/level9.pcd'
];


const framebyframe = [
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0096/level0.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0096/level1.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level2.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level3.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level4.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level5.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level6.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level7.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level8.drc',
	'http://192.168.125.132/dataset/longdress/drcNormalSequences/frame0086/level9.drc'
];

const singleFrame = [
	'http://141.223.65.28/dataset/longdress/singleFrame/LOD9.drc'
];



let dracoLoader;


init();

const targetOptions = {
    format: THREE.RGBAFormat, // Store Red, Green, Blue, and Alpha
    type: THREE.UnsignedByteType
};

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, targetOptions);


async function init() {

	//antialis makes the rendered scene look smoother and more visually apealing by reducing the jagged edges
	renderer = new THREE.WebGLRenderer({ antialias: false, canvas, premultipliedAlpha: false});
	renderer.setPixelRatio(window.devicePixelRatio);
	// console.log(window.devicePixelRatio)
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
	controls.addEventListener('change', render); // use if there is no animation loop
	controls.minDistance = 0.01;
	controls.maxDistance = 10000;

	const radius = 1700; // Distance from center
	currentAngle = 0;    // 0 = front, 90 = right, 180 = back, etc.
	const angle = THREE.MathUtils.degToRad(currentAngle);

	const x = radius * Math.sin(angle);
	const z = radius * Math.cos(angle);
	const y = 700; 

	camera.position.set(x, y, z);
	camera.lookAt(300, 490, 0); 

	scene.add(camera);
	window.addEventListener('resize', onWindowResize);
	
	dracoLoader = new DRACOLoader();
	
	dracoLoader.setDecoderPath('./draco/');
	dracoLoader.setDecoderConfig({ type: 'js' });
	dracoLoader.setWorkerLimit(4);
	dracoLoader.preload();

	
	targetLOD = 0;

	let longdress_LOD =  'http://141.223.65.28/dataset/longdress/LOD15/frame0220/LOD' + targetLOD + '.drc'; 
	let longdress_Full =  'http://141.223.65.28/dataset/longdress/LOD15/frame0220/LOD14.drc'; 

	let redandblack_LOD =  'http://141.223.65.28/dataset/redandblack/sequence/frame0230/LOD' + targetLOD + '.drc'; 
	let redandblack_Full =  'http://141.223.65.28/dataset/redandblack/sequence/frame0230/LOD14.drc'; 

	let loot_LOD =  'http://141.223.65.28/dataset/loot/sequence/frame0120/LOD' + targetLOD + '.drc'; 
	let loot_Full =  'http://141.223.65.28/dataset/loot/sequence/frame0120/LOD14.drc';

	let soldier_LOD =  'http://141.223.65.28/dataset/soldier/sequence/frame0175/LOD' + targetLOD + '.drc'; 
	let soldier_Full =  'http://141.223.65.28/dataset/soldier/sequence/frame0175/LOD14.drc';


	let defenseProgressive =  'http://141.223.65.28/dataset/loot/defense/level' + targetLOD + '.ply';
	let defense =  'http://141.223.65.28/dataset/loot/defense/full.ply'; 
 

	// loadDrcLOD(loot_Full);
	loadPly(defenseProgressive)	
	
}

function loadDrcLOD(url) {
	for(let i = 0; i < POINTS.length; i++)
	{
		let previousLod = POINTS[i];
		previousLod.material.size = pointSize;
		previousLod.material.needsUpdate = true;
	}
	
	dracoLoader.load(url, function (geometry) {

		const material = new THREE.PointsMaterial({size: pointSize, vertexColors: true});
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
		console.log(`Number of Points: ${points.geometry.attributes.position.array.length / 3}`);
		
		// discardWithNormals(points.material);

		const visualMaterial = points.material;
		visualMaterial.vertexColors = true;
		visualMaterial.size = pointSize;

		const dataMaterial = visualMaterial.clone();

		dataMaterial.blending = THREE.NoBlending;
		dataMaterial.transparent = true;

		points.visualMaterial = visualMaterial;
		points.dataMaterial = dataMaterial;

		addDepth(dataMaterial, camera.near, camera.far);
		// discardWithNormals(visualMaterial);

		scene.add(points);
		POINTS.push(points);
		let screenshotLevel = 0;
		screenshotLevel = level;
		render(screenshotLevel);
	});	
}

function determinePointSize(level)
{
	if(level == 0)
		pointSize = 8.5;
	else if(level == 1)
		pointSize = 8;
	else if(level == 2)
		pointSize = 7.0;
	else if(level == 3)
		pointSize = 6.0;
	else if(level == 4)
		pointSize = 5.5;
	else if(level == 5)
		pointSize = 5.0;
	else if(level == 6)
		pointSize = 4.5;
	else if(level > 5)
		pointSize = 4;
}

function loadDrcLEVEL(url) {
	if (level >= 15)
		return;
	
	determinePointSize(level);
	for(let i = 0; i < POINTS.length; i++)
	{
		let previousLod = POINTS[i];
		previousLod.material.size = pointSize;
		previousLod.material.needsUpdate = true;
	}
	
	dracoLoader.load(url, function (geometry) {

		const material = new THREE.PointsMaterial({size: pointSize, vertexColors: true});
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

		// Point Size and Point Color
		console.log(`Number of points for each LoD ${points.geometry.attributes.position.array.length / 3}`);
		// console.log(`Current Level ${level}`);
		
		
		// discardWithNormals(points.material);
		
		const visualMaterial = points.material;
		visualMaterial.vertexColors = true;
		visualMaterial.size = pointSize;

		const dataMaterial = visualMaterial.clone();

		dataMaterial.blending = THREE.NoBlending;
		dataMaterial.transparent = true;

		points.visualMaterial = visualMaterial;
		points.dataMaterial = dataMaterial;

		// discardAddDepth(dataMaterial, camera.near, camera.far);
		addDepth(dataMaterial, camera.near, camera.far);
		// discardWithNormals(visualMaterial);

		scene.add(points);
		
		POINTS.push(points);
		render(level);
		
		level = level + 1;
		let nextURL =  'http://141.223.65.28/dataset/loot/sequence/frame0120/LOD' + level + '.drc';
		
		loadDrcLEVEL(nextURL);
	});	
}

function loadPly(url) {
	if (level >= 3)
		return;

	const loader = new PLYLoader();

	determinePointSize(level);
	for(let i = 0; i < POINTS.length; i++)
	{
		let previousLod = POINTS[i];
		previousLod.material.size = pointSize;
		previousLod.material.needsUpdate = true;
	}
	pointSize = 4;
	loader.load(url, function (geometry) {

		const material = new THREE.PointsMaterial({size: pointSize, vertexColors: true});
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

		console.log(`🐉 Number of points for each LoD ${points.geometry.attributes.position.array.length / 3}`);
			
		const visualMaterial = points.material;
		visualMaterial.vertexColors = true;
		visualMaterial.size = pointSize;

		const dataMaterial = visualMaterial.clone();

		dataMaterial.blending = THREE.NoBlending;
		dataMaterial.transparent = true;

		points.visualMaterial = visualMaterial;
		points.dataMaterial = dataMaterial;

		addDepth(dataMaterial, camera.near, camera.far);

		scene.add(points);
		
		POINTS.push(points);
		render(level);
		
		level = level + 1;
		let nextURL =  'http://141.223.65.28/dataset/loot/defense/level' + level + '.ply';
		loadPly(nextURL);
	});	
}


function loadPCD(url) {
	if (level >= 1)
		return;

	for(let i = 0; i < POINTS.length; i++)
	{
		let previousLod = POINTS[i];
		previousLod.material.size = pointSize;
		previousLod.material.needsUpdate = true;
	}
	
	const loader = new PCDLoader();
	loader.load(url, function (points) {
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

		// Point Size and Point Color
		console.log(`Number of points ${points.geometry.attributes.position.array.length / 3}`);
		console.log(`Current Level ${level}`);

		// points.material.vertexColors = true;
		// points.material.size = pointSize;
		// points.material.blending = THREE.CustomBlending;
		// points.material.blendEquation = THREE.AddEquation;
		// points.material.blendSrc = THREE.ZeroFactor; 
		// points.material.blendDst = THREE.OneFactor;  


		// let normals = []; // Estimate Normals
		// normals = estimate_normal_vector(points.geometry.attributes, objectcentroid);
		// points.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
		// display_normals(points.geometry.attributes.position, points.geometry.attributes.normal);	

		// let new_positions = [];
		// let new_color = [];
		// let signs = [];
		// let normalMatrix = getModelViewMatrix(points, camera);

		// if(level == 0)
		// {
		// 	signs = getSigns(points.geometry.attributes, camera, normalMatrix);
		// 	// saveFile(signs, `${currentAngle}`);
		// }

		// console.log(signs);

		// console.log(points);

		const visualMaterial = points.material;
		visualMaterial.vertexColors = true;
		visualMaterial.size = pointSize;

		const dataMaterial = visualMaterial.clone();

		dataMaterial.blending = THREE.NoBlending;
		dataMaterial.transparent = true;

		points.visualMaterial = visualMaterial;
		points.dataMaterial = dataMaterial;

		// modifyShader(points.material, currentAngle, signsAngle.length / (level + 1));
		// console.log(camera);
		console.log(points);

		discardAddDepth(dataMaterial, camera.near, camera.far);
		// discardWithNormals(visualMaterial);
		
		// let startIdx = 0; let endIdx = 0;
		// startIdx = level * 12;
		// endIdx = 12 * (level + 1);
		// let name = 0;
		// for(let j = startIdx; j < endIdx; j++)
		// {
		// 	points.geometry.setAttribute(`Angle_${name * 30}`, new THREE.Float32BufferAttribute(signsAngle[j], 1));
		// 	name += 1;
		// }

		scene.add(points);
		
		POINTS.push(points);
		let screenshotLevel = 0;
		screenshotLevel = level;
		render(screenshotLevel);
		
		level = level + 1;
		// loadPointCloud(longdress_20[level]);
	});	
}


function pixel_position(width, screen_x, screen_y)
{
	return (width * screen_y + screen_x) * 4;
}

function hole_position(width, screen_x, screen_y)
{
	return (width * screen_y + screen_x);
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

function findBoundingBox(width, height)
{
	// -- Find Min Y (Top) --
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// Check Alpha channel (every 4th byte)
			if (pixels[(y * width + x) * 4 + 3] > 0) { 
				minScreenY = y;
				// Break out of both loops instantly. We found the top edge.
				x = width; y = height; 
			}
		}
	}

	// -- Find Max Y (Bottom) --
	// Scan backwards from the bottom
	for (let y = height - 1; y >= 0; y--) {
		for (let x = 0; x < width; x++) {
			if (pixels[(y * width + x) * 4 + 3] > 0) { 
				maxScreenY = y;
				x = width; y = -1; // Break
			}
		}
	}

	// -- Find Min X (Left) --
	// Loop X first, then Y, to scan columns
	for (let x = 0; x < width; x++) {
		for (let y = minScreenY; y <= maxScreenY; y++) { // Only scan within the Y range we found!
			if (pixels[(y * width + x) * 4 + 3] > 0) {
				minScreenX = x;
				x = width; y = maxScreenY + 1; // Break
			}
		}
	}

	// -- Find Max X (Right) --
	for (let x = width - 1; x >= 0; x--) {
		for (let y = minScreenY; y <= maxScreenY; y++) {
			if (pixels[(y * width + x) * 4 + 3] > 0) {
				maxScreenX = x;
				x = -1; y = maxScreenY + 1; // Break
			}
		}
	}
}

async function modify_pixels(level) {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
    isRunning = true;	
	try
	{
		// if(level >= 12)
		// {
		// 	// takeScreenshot(level);
		// 	return;
		// }

		console.time("🖼️ Total Time"); 
		console.time("Initialize Time");
		const gl = renderer.getContext('webgl2');

		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

		// screen_coords.splice(0, screen_coords.length);
		holeArray = new Uint8Array(width *  height * 4);
		holeArray.fill(0);
		pixels = new Uint8Array(width * height * 4);

		gl.readPixels(
			0,
			0,
			gl.drawingBufferWidth,
			gl.drawingBufferHeight,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixels);


		// console.log(`Canvas: `, gl);	
		// console.log("Drawing Buffer Width:", gl.drawingBufferWidth);
		// console.log("Drawing Buffer Height:", gl.drawingBufferHeight);
		// console.log("Target Renderer Width:", renderTarget.width);
		// console.log("Target Renderer Height:", renderTarget.height);
		
		
		//Initialize hole array
		
	    minScreenX = width, minScreenY = outerHeight;
		maxScreenX = 0, maxScreenY = 0;
		findBoundingBox(width, height);


		// console.time("Coordinate Transform Time");
		// let worldPosition = new THREE.Vector3();
		// for(let k = 0; k < POINTS.length; k++)
		// {
		// 	let points = POINTS[k].geometry.attributes.position.array;
		// 	for (let i = 0; i < points.length; i += 3)
		// 	{
		// 		// Get the x, y, z coordinates of the point
		// 		const x = points[i];
		// 		const y = points[i + 1];
		// 		const z = points[i + 2];
		// 		worldPosition.set(x, y, z);
		// 		log_coord(pixels, worldPosition, width, height);
		// 	}
		// }
		// console.timeEnd("Coordinate Transform Time");

		
		console.timeEnd("Initialize Time");

		// console.log(screen_coords);

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

		// console.time("Screen Set Time");
		// let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		// screen_coords.splice(0, screen_coords.length);
		// // Convert back to arrays if needed
		// screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		// console.log(`Screen Coordinate Length ${screen_coords.length}`);
		// console.timeEnd("Screen Set Time");

		// console.time("Calculate ConcaveHull Time");
		// let hullPoints = concave(screen_coords);
		// detect_holesConcave(hullPoints, width, height);
		// console.timeEnd("Calculate ConcaveHull Time");
		
		// let count = 0
		// for(let y = 0; y < height; y++)
		// {
		// 	for(let x = 0; x < width; x++)
		// 	{
		// 		let idx = pixel_position(width, x, y);
		// 		if(pixels[idx + 3] > 0)
		// 		{
		// 			// console.log(pixels[idx + 3]);
		// 			count += 1;
		// 		}
		// 	}		
		// }
		// console.log(count)


		console.time("Detection Time");
		detect_holesDepth(width, height);
		console.timeEnd("Detection Time");

		console.time("Interpolation Time");
		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				let holeIdx = hole_position(width, x, y);
				if(holeArray[holeIdx] == 1)
				{
					// let idx = pixel_position(width, x, y);
					// pixels[idx] = 255;
					// pixels[idx + 1] = 0;
					// pixels[idx + 2] = 0;
					inverseDistanceWeightingInterpolation(y, x, width, height, 7);
				}
		
			}		
		}
		console.timeEnd("Interpolation Time");

		
		
		console.time("Upload Mesh Time");
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
		console.timeEnd("Upload Mesh Time");
		
		// takeScreenshot(level);
		console.timeEnd("🖼️ Total Time"); 
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

function takeScreenshot(level) {
  // Access the renderer you created for your scene
  // For example: const renderer = new THREE.WebGLRenderer();

  // Get the data URL of the current frame
  const dataURL = renderer.domElement.toDataURL('image/png');

  // Create a temporary link element
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `LOD${level}.png`; 
//   link.download = `LOD${targetLOD + 1}_${pointSize}.png`; 

  // Programmatically click the link to trigger the download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function render(level) {
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

	frameDisplay.innerHTML = `Full Point Cloud`;
	// frameDisplay.innerHTML = `LOD: ${level}`;
	modify_pixels(level);

	// scene.traverse((object) => {
    //     if (object.isPoints && object.visualMaterial) {
    //         object.material = object.visualMaterial;
    //     }
    // });

    // renderer.setRenderTarget(null); // Set renderer back to the canvas
    // renderer.clear();
    // renderer.render(scene, camera);

	// takeScreenshot(screenshotLevel);

	
	// scene.traverse( function (child)
	// {
	// 	if(child.isPoints)
	// 	{
	// 		const shader = child.material.userData.shader;
	// 		if(shader)
	// 		{
	// 			shader.uniforms.angle.value = getCameraAzimuthFromPosition(camera);	
	// 		}
	// 	}
	// });
	// currentAngle = getCameraAzimuthFromPosition(camera);

	
	// console.log(camera.position.x, camera.position.y, camera.position.z);
	// console.log(window.innerHeight * window.devicePixelRatio / 2);
	// console.log(currentAngle);
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
				let idx = pixel_position(width, x, y);
				// if(pixels[idx + 3] == 255)
				// 	console.log(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
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
			let holeIdx = hole_position(width, px, py);
			holeArray[holeIdx] = 1;
			continue;
		}
		// if(r <= 30 && g <= 30 && b <= 30)
		// {
		// 	holeArray[py][px] = 1;
		// }
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
								let holeIdx = hole_position(width, x + l, y + k);
								holeArray[holeIdx] = 1;
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
							let holeIdx = hole_position(width, x + l, y + k);
							if(holeArray[holeIdx] == 1)
								continue;

							let idx = pixel_position(width, x + l, y + k);
							let depth = pixels[idx + 3];

							if(depth >= threshold.end)
							{	
								holeArray[holeIdx] = 1;
							}
						}
					}
				}
			}
		}
	}
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

			let holeIdx = hole_position(width, x + idx_x, y + idx_y);

			if(holeArray[holeIdx] != 1)
			{
				let r = 0, g = 0, b = 0;

				let idx = pixel_position(width, x + idx_x, y + idx_y)
				r = pixels[idx];
				g = pixels[idx + 1];
				b = pixels[idx + 2];
				let distance = euclideanDistance2D([x + idx_x, y + idx_y], [x, y]);
				
				let weight = 1.0 / (distance * distance);
				
				sumDistanceWeight += weight;
				sumWeightedValueR = sumWeightedValueR + (r * weight);
				sumWeightedValueG = sumWeightedValueG + (g * weight);
				sumWeightedValueB = sumWeightedValueB + (b * weight);
		
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


	// let idx = pixel_position(width, x, y);
	// pixels[idx] = sumWeightedValueR / sumDistanceWeight;
	// pixels[idx + 1]= sumWeightedValueG / sumDistanceWeight;
	// pixels[idx + 2] = sumWeightedValueB / sumDistanceWeight;
	

	return;
}

