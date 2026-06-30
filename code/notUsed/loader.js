import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

import { KDTree } from '../modules/KDTree.js';
import { deltaE } from '../modules/LabSpace.js';
import { euclideanDistance3D, euclideanDistance2D, median, average, computeIQR, dot, normalize, ORMatrices, checkMatrices, standard_deviation, getModelViewMatrix } from '../modules/utility.js';
import { remove_pointsNormalBased, remove_pointsSignBased, getSigns} from '../modules/removePoints3D.js';
import fs from "fs";
import { concave } from '../modules/hull.js';
import { saveFile , readZipFromArrayBuffer, loadSigns} from '../modules/io.js';
import { loadbodyPix, usebodyPix } from '../modules/bodyPix.js';
import { discardAddDepth, discardWithNormals, modifyShader } from '../modules/customshader.js';

import { load } from '@tensorflow-models/body-pix';


let camera, scene, renderer, currentAngle;

let level = 0;
let isRunning = false;
let pointSize = 8;
let screen_coords = [];
let scale = 0;
let pixelArray = [];
let pixels_on_screen = [];
let holeArray = [];
let signsAngle = [];
var pixels;

let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let modifiedMesh;

const tree = new KDTree();
const canvas = document.getElementById("webglCanvas");
const POINTS = [];

const full_URL = ['http://192.168.125.132/dataset/redandblack/visual/with_normals/LoD_full.pcd'];

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

const sequence = [
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level0.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level1.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level2.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level3.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level4.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level5.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level6.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level7.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level8.pcd',
	'http://192.168.125.132/dataset/longdress/normalSequencesBinary/frame0000/level9.pcd'
];


const soldier_10 = [
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level0.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level1.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level2.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level3.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level4.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level5.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level6.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level7.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level8.pcd',
	'http://192.168.125.132/dataset/soldier/visual/with_normals/10_levels/level9.pcd'
];

const redandblack_10 = [
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level0.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level1.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level2.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level3.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level4.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level5.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level6.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level7.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level8.pcd',
	'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/level9.pcd'
];

const loot_10 = [
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level0.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level1.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level2.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level3.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level4.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level5.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level6.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level7.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level8.pcd',
	'http://192.168.125.132/dataset/loot/visual/with_normals/10_levels/level9.pcd'
];

// loadbodyPix();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function wait() {
  console.log("before");
  sleep().then(() => init());
  console.log("done!");
}

wait();

let dracoLoader;

const targetOptions = {
    format: THREE.RGBAFormat, // Store Red, Green, Blue, and Alpha
    type: THREE.UnsignedByteType // Use FloatType for higher precision depth data
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
	renderer.setClearColor(0xffffff);
	// renderer.setClearAlpha(1);

	// renderer.setClearColor(0x000000);

	// document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();

	// camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 40);
	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 3000);
	
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

	const radius = 1900; // Distance from center
	currentAngle = 0;    // 0 = front, 90 = right, 180 = back, etc.
	const angle = THREE.MathUtils.degToRad(currentAngle);

	const x = radius * Math.sin(angle);
	const z = radius * Math.cos(angle);
	const y = 700; 

	camera.position.set(x, y, z);
	camera.lookAt(300, 490, 0); 

	scene.add(camera);
	signsAngle = await loadSigns(0, 1, 2);
	console.log(signsAngle);
	// readZipFromArrayBuffer();
	window.addEventListener('resize', onWindowResize);
	
	dracoLoader = new DRACOLoader();
	
	dracoLoader.setDecoderPath('./draco/');
	dracoLoader.setDecoderConfig({ type: 'js' });
	dracoLoader.setWorkerLimit(4);
	
	loadPointCloud(sequence[level]);
}

function determinePointSizeNoInterpolation(level)
{
	if(level == 0)
		pointSize = 9;
	else if(level == 1)
		pointSize = 7;
	else if(level == 2)
		pointSize = 6;
	else if(level == 3)
		pointSize = 5;
	else if(level == 4)
		pointSize = 4.5;
	else if(level == 5)
		pointSize = 4;
	else if(level == 6)
		pointSize = 3.8;
	else if(level == 7)
		pointSize = 3.7;
	else if(level == 8)
		pointSize = 3;
	else if(level == 9)
		pointSize = 3;
}

function determinePointSizeInterpolation(level)
{
	if(level == 0)
		pointSize = 7;
	else if(level == 1)
		pointSize = 6;
	else if(level == 2)
		pointSize = 5;
	else if(level == 3)
		pointSize = 5;
	else if(level == 4)
		pointSize = 5;
	else if(level == 5)
		pointSize = 4;
	else if(level == 6)
		pointSize = 3;
	else if(level == 7)
		pointSize = 3;
	else if(level == 8)
		pointSize = 3;
	else if(level == 9)
		pointSize = 3;
}

function loadDrc(url) {
	if (level >= 1)
		return;

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
		console.log(`Current Level ${level}`);
		
		discardWithNormals(points.material);
		// modifyShader(points.material, currentAngle, signsAngle.length / (level + 1));

		let startIdx = 0; let endIdx = 0;
		startIdx = level * 12;
		endIdx = 12 * (level + 1);
		let name = 0;
		for(let j = startIdx; j < endIdx; j++)
		{
			points.geometry.setAttribute(`Angle_${name * 30}`, new THREE.Float32BufferAttribute(signsAngle[j], 1));
			name += 1;
		}

		scene.add(points);
		
		POINTS.push(points);
		let screenshotLevel = 0;
		screenshotLevel = level;
		render(screenshotLevel);
		
		level = level + 1;
		loadDrc(sequence[level]);
	});	
}

function loadPly(url) {
	if (level >= 1)
		return;

	const loader = new PLYLoader();

	for(let i = 0; i < POINTS.length; i++)
	{
		let previousLod = POINTS[i];
		previousLod.material.size = pointSize;
		previousLod.material.needsUpdate = true;
	}
	
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

		// Point Size and Point Color
		console.log(`Number of points for each LoD ${points.geometry.attributes.position.array.length / 3}`);
		console.log(`Current Level ${level}`);
		
		// modifyShader(points.material, currentAngle, signsAngle.length / (level + 1));

		let startIdx = 0; let endIdx = 0;
		startIdx = level * 12;
		endIdx = 12 * (level + 1);
		let name = 0;
		for(let j = startIdx; j < endIdx; j++)
		{
			points.geometry.setAttribute(`Angle_${name * 30}`, new THREE.Float32BufferAttribute(signsAngle[j], 1));
			name += 1;
		}
		console.log(points.geometry);

		scene.add(points);
		
		POINTS.push(points);
		let screenshotLevel = 0;
		screenshotLevel = level;
		render(screenshotLevel);
		
		level = level + 1;
		loadPly(sequence[level]);
	});	
}

function loadPointCloud(url) {
	if (level >= 1)
		return;
	// determinePointSizeInterpolation(level);

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
		console.log(`Number of points for each LoD ${points.geometry.attributes.position.array.length / 3}`);
		console.log(`Current Level ${level}`);

		points.material.vertexColors = true;
		points.material.size = pointSize;
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

		// modifyShader(points.material, currentAngle, signsAngle.length / (level + 1));
		discardWithNormals(points.material);

		// [new_positions, new_color] = remove_pointsSignBased(points.geometry.attributes, signsAngle, currentAngle);
		// [new_positions, new_color] = remove_pointsNormalBased(points.geometry.attributes, camera, normalMatrix);
		
		// points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(new_positions, 3));
		// points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new_color, 3));
		// points.geometry.attributes.position.needsUpdate = true;
		// points.geometry.attributes.color.needsUpdate = true;
		
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
		loadPointCloud(sequence[level]);
	});	
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

	// const x = (ndcPosition.x + 1) * windowWidth / 2;
	// const y = (ndcPosition.y + 1) * windowHeight / 2;

	if(x < 0 || x > width - 1)
		return;
	if(y < 0 || y > height - 1)
		return;

	// let farDistance = camera.far;// Distance from the viewport to the far plane
	// let cameraDistance = cameraPosition.length();
	// let depth_distance = cameraDistance / farDistance;
	
	let screenX = Math.floor(x);
	let screenY = Math.floor(y)
	let index = pixel_position(width, screenX, screenY);
	if(pixels[index] == 255 && pixels[index + 1] == 255 && pixels[index + 2] == 255)
		return;
	
	// screen_coords.push([[x, y], occupied_pixels]);
	screen_coords.push([screenX, screenY]);

	// occupied_pixels_arr.push(occupied_pixels);
	// mvPosition_arr.push(-cameraPosition.z);
	// depthDistance_arr.push(depth_distance);
	return;
}

async function modify_pixels(screenshotLevel) {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
    isRunning = true;	
	try
	{
		console.time("Total Time");
		// const canvas = renderer.domElement;
		// const canvas = document.getElementById('webglCanvas');
		const gl = renderer.getContext('webgl2');

		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

		screen_coords.splice(0, screen_coords.length);
		holeArray.splice(0, holeArray.length);
		// tree.clear();

		pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);

		gl.readPixels(
			0,
			0,
			gl.drawingBufferWidth,
			gl.drawingBufferHeight,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixels);

		console.log(`Canvas: `, gl);	
		console.log("Drawing Buffer Width:", gl.drawingBufferWidth);
		console.log("Drawing Buffer Height:", gl.drawingBufferHeight);
		console.log("Target Renderer Width:", renderTarget.width);
		console.log("Target Renderer Height:", renderTarget.height);
	
		//Initialize pixels_on_screen array & hole array
		pixels_on_screen = Array(height).fill().map(() => Array(width).fill(0));
		holeArray = Array(height).fill().map(() => Array(width).fill(0));
		
		const flipped = new Uint8ClampedArray(pixels.length);
    	const rowSize = width * 4;

    	// for (let y = 0; y < height; y++) {
        // 	const srcStart = y * rowSize;
        // 	const destStart = (height - y - 1) * rowSize;
        // 	flipped.set(pixels.subarray(srcStart, srcStart + rowSize), destStart);
    	// }

		// const imageData = new ImageData(new Uint8ClampedArray(flipped), width, height);

		// let segmentation = await usebodyPix(imageData);
		
		// const flippedSegmentation = new Uint8Array(segmentation.data.length);
		// for (let y = 0; y < height; y++) {
        // 	const srcRowStart = y * width;
        // 	const dstRowStart = (height - y - 1) * width;
		// 	for (let x = 0; x < width; x++) {
        //     	flippedSegmentation[dstRowStart + x] = segmentation.data[srcRowStart + x];
        // 	}
    	// }

		// let segmentationIdx = 0;
		// for (let i = 0; i < height * width * 4; i += 4) {
		// 	if(flippedSegmentation[segmentationIdx] == 0)
		// 		pixels[i + 3] = 0;
		// 	else
		// 		pixels[i + 3] = 1;
		// 	segmentationIdx += 1;
		// }

		// console.log(pixels);

		console.time("Coordinate Transform Time");
		let worldPosition = new THREE.Vector3();
		for(let k = 0; k < POINTS.length; k++)
		{
			let points = POINTS[k].geometry.attributes.position.array;
			for (let i = 0; i < points.length; i += 3)
			{
				// Get the x, y, z coordinates of the point
				const x = points[i];
				const y = points[i + 1];
				const z = points[i + 2];
				worldPosition.set(x, y, z);
				log_coord(pixels, worldPosition, width, height);
			}
		}
		console.timeEnd("Coordinate Transform Time");
		// console.log(screen_coords);

		let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		screen_coords.splice(0, screen_coords.length);
		// Convert back to arrays if needed
		screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		console.log(`Screen Coordinate Length ${screen_coords.length}`);

		console.time("Calculate ConcaveHull Time");
		let hullPoints = concave(screen_coords);
	
		detect_holesConcave(hullPoints, width, height);
		console.timeEnd("Calculate ConcaveHull Time");
		
		// fill_in_rest();

		// initialize_tree();

		// calculate_distance_color_histogram();
		
		// console.log(screen_coords);
		// console.log('Point Info Array:');
		// console.log(point_info_array);

		// console.time("Detect Time");
		// for(let y = 0; y < height; y++)
		// {
		// 	for(let x = 0; x < width; x++)
		// 	{
		// 		let flag = detect_holesBodyPix(y, x, width, height);
		// 		if(flag == true)
		// 			holeArray[y][x] = 1;
		// 	}	
		// }
		// console.timeEnd("Detect Time");

		console.time("Interpolation Time");
		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(holeArray[y][x] == 1)
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
		const tempPixels = new Uint8Array(pixels.length);

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
		console.timeEnd("Upload Mesh Time");
		renderer.render(scene, textureCamera);

		// screenshot(width, height, rowSize, screenshotLevel);
		console.timeEnd("Total Time"); 
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
function screenshot(width, height, rowSize, screenshotLevel)
{
	// let flippedPixels = [];
	// for (let y = 0; y < height; y++) {
	// 	const sourceRow = height - y - 1; // Index of the row in the original array
	// 	const targetStart = y * rowSize; // Start index in the 1D flippedPixels array
	
	// 	for (let x = 0; x < width; x++) {
	// 		const pixel = pixelArray[sourceRow][x]; // Get the pixel [R, G, B, A] from the 2D array
	// 		const pixelStart = targetStart + x * 4;  // Start index for this pixel in flippedPixels
	
	// 		// Write RGBA components into the flippedPixels array
	// 		flippedPixels[pixelStart] = pixel[0];     // R
	// 		flippedPixels[pixelStart + 1] = pixel[1]; // G
	// 		flippedPixels[pixelStart + 2] = pixel[2]; // B
	// 		flippedPixels[pixelStart + 3] = 255; // A
	// 	}
	// }

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
		a.download = `LOD${screenshotLevel + 1}_${pointSize}.png`;
		// a.download = `Proposed_LOD${screenshotLevel + 1}_${pointSize}.png`;
		// a.download = `Proposed_LOD${screenshotLevel + 1}.png`;

		a.click();
		URL.revokeObjectURL(url);
	});
}

function render(screenshotLevel) {
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
	
	if(level == 0)
		modify_pixels(screenshotLevel);
	
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
	
	// console.log(camera.position.x, camera.position.y, camera.position.z);
	// console.log(window.innerHeight * window.devicePixelRatio / 2);
	// console.log(currentAngle);
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

		// if(j == 3001)
		// {
		// 	console.log(`Size in pixels ${sizePixels}`);
		// 	console.log(`Actual Value:  ${screen_x - sizePixels / 2}, ${screen_y + sizePixels / 2}, ${screen_x + sizePixels / 2}, ${screen_y - sizePixels / 2}`);
		// 	console.log(`Rounded Value:  ${upper_corners_x}, ${upper_corners_y}, ${lower_corners_x}, ${lower_corners_y}`);
		// 	console.log(`Just for Check:  ${Math.round(screen_x - sizePixels / 2)}, ${Math.round(screen_y + sizePixels / 2)}, ${Math.round(screen_x + sizePixels / 2)}, ${Math.round(screen_y - sizePixels / 2)}`);
		// }

		if(lower_corners_x < 0 || upper_corners_x >= width)
			continue;
		if(upper_corners_y < 0 || lower_corners_y >= height)
			continue;

		// tree.add_bbox([screen_coords[j][0][0], screen_coords[j][0][1]], [upper_corners_x, upper_corners_y, lower_corners_x, lower_corners_y]);
		
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
function remove_hidden_points(point_info_array)
{
	let index = 0;
	for(let i = 0; i < point_info_array.length; i++)
	{
		for(let j = 0; j < i; j++)
		{
			if(point_info_array[i].Upper_x > point_info_array[j].Upper_x)
			{
				if(point_info_array[i].Lower_x < point_info_array[j].Lower_x)
				{
					if(point_info_array[i].Upper_y < point_info_array[j].Upper_y)
					{
						if(point_info_array[i].Lower_y > point_info_array[j].Lower_y)
						{
							point_info_array.splice(index, 1);
							index -= 1;
						}
					}
				}
			}
		}
		index += 1;
	}
}
function check_if_occupied(overlapped_region)
{
	let x_start = 0, x_end = 0, y_start = 0, y_end = 0;
	x_start = overlapped_region.start_x;
	x_end = overlapped_region.end_x;
	y_start = overlapped_region.start_y;
	y_end = overlapped_region.end_y;

	let flag = 0;
	let occupied_pixels = 0;
	
	let area = 0;
	let count = 0;

	for(let i = y_start; i < y_end; i++)
	{
		for(let j = x_start; j < x_end; j++)
		{	
			if(pixels_on_screen[i][j] == 1)
				occupied_pixels += 1;
			else
				area += 1;
			count += 1;
		}
	}

	total_area_arr.push(area);
	// Checks whether the current region is already occupied by the other overlap region
	if(count == occupied_pixels)
	{
		flag = 1;
	}

	// If not fill the region
	if(flag == 0)
	{
		for(let i = y_start; i < y_end; i++)
		{
			for(let j = x_start; j < x_end; j++)
			{
				pixels_on_screen[i][j] = 1;
			}
		}
	}

	return flag;
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
		for(let l = 0; l < k; l++)
		{
			overlapped_region = {}
			if(point_info_array[k].Upper_x < point_info_array[l].Lower_x)
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

				let flag = 0;
				flag = check_if_occupied(overlapped_region);
				
				if(flag == 0)
				{
					arr.push(overlapped_region);
					// console.log(overlapped_region);
					overlapping_counts += 1;
					if(overlapped_region.type == 1)
						type_1 += 1;
					else if(overlapped_region.type == 2)
						type_2 += 1;
					else if(overlapped_region.type == 3)
						type_3 += 1;
					else if(overlapped_region.type == 4)
						type_4 += 1;
					else if(overlapped_region.type == 5)
						type_5 += 1;
					else if(overlapped_region.type == 6)
						type_6 += 1;
					else if(overlapped_region.type == 7)
						type_7 += 1;
					else if(overlapped_region.type == 8)
						type_8 += 1;
				}
			}
			// else
			// 	// console.log("Overlapping Does Not Occur");		
		}
	}
	// console.log(`Total Overlapping Counts ${overlapping_counts}`);
	// console.log(`Overlapping Counts By Types`);
	// console.log(`Type 1 ${type_1}`);
	// console.log(`Type 2 ${type_2}`);
	// console.log(`Type 3 ${type_3}`);
	// console.log(`Type 4 ${type_4}`);
	// console.log(`Type 5 ${type_5}`);
	// console.log(`Type 6 ${type_6}`);
	// console.log(`Type 7 ${type_7}`);
	// console.log(`Type 8 ${type_8}`);
	return arr;	
}
function calculateOverlappingRegionTree(width, height)
{
	let arr = [];
	let overlapped_region = {};
	let type = 0;
	let overlapping_counts = 0;
	let type_1 = 0, type_2 = 0, type_3 = 0, type_4 = 0, type_5 = 0, type_6 = 0, type_7 = 0, type_8 = 0;
	// console.log(screen_coords.length);
	for(let k = 0; k < screen_coords.length; k++)
	{
		let neighbors = tree.nearestNeighbors([screen_coords[k][0][0], screen_coords[k][0][1]], 21);
		let cur_pixel = neighbors[0];
		let cur_UpperX = cur_pixel.bbox[0];
		let cur_UpperY = cur_pixel.bbox[1];
		let cur_LowerX = cur_pixel.bbox[2];
		let cur_LowerY = cur_pixel.bbox[3];
		// console.log(neighbors);

		for(let l = 1; l < neighbors.length; l++)
		{
			overlapped_region = {}
			let n_UpperX = neighbors[l].bbox[0];
			let n_UpperY = neighbors[l].bbox[1];
			let n_LowerX = neighbors[l].bbox[2];
			let n_LowerY = neighbors[l].bbox[3];

			if((cur_UpperX >= n_UpperX) && (cur_UpperX < n_LowerX))
			{
				type = 0;
				let top_left = {}, top_right = {}, bot_left = {}, bot_right = {};
				if(cur_UpperY <= n_UpperY)
				{
					if(cur_UpperY < n_LowerY)
						continue;

					if(cur_LowerX > n_LowerX)
					{
						if(cur_LowerY <= n_LowerY)
						{
							top_left = {x: cur_UpperX, y: cur_UpperY};
							top_right = {x: n_LowerX, y: cur_UpperY};
							bot_left = {x: cur_UpperX, y: n_LowerY};
							bot_right = {x: n_LowerX, y: n_LowerY};
							type = 1;
							// console.log("Overlapping occurs Case 1");
						}
						else
						{
							top_left = {x: cur_UpperX, y: cur_UpperY};
							top_right = {x: n_LowerX, y: cur_UpperY};
							bot_left = {x: cur_UpperX, y: cur_LowerY};
							bot_right = {x: n_LowerX, y: cur_LowerY};
							type = 5;
							// console.log("Overlapping occurs Case 5");
						}
					}
					else
					{
						top_left = {x: cur_UpperX, y: cur_UpperY};
						top_right = {x: cur_LowerX, y: cur_UpperY};
						bot_left = {x: cur_UpperX, y: n_LowerY};
						bot_right = {x: cur_LowerX, y: n_LowerY};
						type = 3;
						// console.log("Overlapping occurs Case 3");
					}	
				}
				else
				{
					if(n_UpperY < cur_LowerY)
						continue;

					if(n_LowerX < cur_LowerX)
					{
						if(n_LowerY < cur_LowerY)
						{
							top_left = {x: cur_UpperX, y: n_UpperY};
							top_right = {x: n_LowerX, y: n_UpperY};
							bot_left = {x: cur_UpperX, y: cur_LowerY};
							bot_right = {x: n_LowerX, y: cur_LowerY};
							type = 2;
							// console.log("Overlapping occurs Case 2");
						}
						else
						{
							top_left = {x: cur_UpperX, y: n_UpperY};
							top_right = {x: n_LowerX, y: n_UpperY};
							bot_left = {x: cur_UpperX, y: n_LowerY};
							bot_right = {x: n_LowerX, y: n_LowerY};
							type = 6;
							// console.log("Overlapping occurs Case 6");
						}
					}
					else
					{
						top_left = {x: cur_UpperX, y: n_UpperY};
						top_right = {x: cur_LowerX, y: n_UpperY};
						bot_left = {x: cur_UpperX, y: cur_LowerY};
						bot_right = {x: cur_LowerX, y: cur_LowerY};
						type = 4;
						// console.log("Overlapping occurs Case 4");
					}
				}

				if(cur_UpperY == n_UpperY)
				{
					// console.log("Overlapping Occurs Case 7");
					type = 7;
				}
				if(cur_UpperX == n_UpperX)
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
				let flag = 0;
				flag = check_if_occupied(overlapped_region);
				
				if(flag == 0)
				{
					arr.push(overlapped_region);
					// console.log(overlapped_region);
					overlapping_counts += 1;
					if(overlapped_region.type == 1)
						type_1 += 1;
					else if(overlapped_region.type == 2)
						type_2 += 1;
					else if(overlapped_region.type == 3)
						type_3 += 1;
					else if(overlapped_region.type == 4)
						type_4 += 1;
					else if(overlapped_region.type == 5)
						type_5 += 1;
					else if(overlapped_region.type == 6)
						type_6 += 1;
					else if(overlapped_region.type == 7)
						type_7 += 1;
					else if(overlapped_region.type == 8)
						type_8 += 1;
				}
			}
			// else
			// 	console.log("Overlapping Does Not Occur");		
		}
	}
	console.log(`Total Overlapping Counts ${overlapping_counts}`);
	// console.log(`Overlapping Counts By Types`);
	// console.log(`Type 1 ${type_1}`);
	// console.log(`Type 2 ${type_2}`);
	// console.log(`Type 3 ${type_3}`);
	// console.log(`Type 4 ${type_4}`);
	// console.log(`Type 5 ${type_5}`);
	// console.log(`Type 6 ${type_6}`);
	// console.log(`Type 7 ${type_7}`);
	// console.log(`Type 8 ${type_8}`);
	return arr;	
}
function detect_holes_previous(y, x, width, height){

	let cur_r = 0, cur_g = 0, cur_b= 0;
	cur_r = pixelArray[y][x][0];
	cur_g = pixelArray[y][x][1];
	cur_b = pixelArray[y][x][2];
	const cur_vector = new THREE.Vector3(cur_r, cur_g, cur_b);

	if(cur_r < 190 && cur_g < 190 && cur_b < 190)
		return false;
	if(x - 1 < 0 || x + 1 >= width)
		return false; 
	if(y - 1 < 0 || y + 1 >= height)
		return false; 
	
	let mask_result = false;

	let current_kernel = new THREE.Matrix3();
		
	let index = 0;

	for(let k = 1; k >= -1; k--)
	{
		for(let l = -1; l <= 1; l++)
		{
			let neighbor_r = 0, neighbor_g = 0, neighbor_b = 0;
			neighbor_r = pixelArray[y + k][x + l][0];
			neighbor_g = pixelArray[y + k][x + l][1];
			neighbor_b = pixelArray[y + k][x + l][2];

			if(neighbor_r >= 250 && neighbor_g >= 250 && neighbor_b >= 250)
				current_kernel.elements[index] = 0;
			else
				current_kernel.elements[index] = 1;
			index += 1;
		}
	}

	for(let j = 0; j < maskArray.length; j++)
	{	
		let resulting_matrix = ORMatrices(maskArray[j], current_kernel);
		mask_result = checkMatrices(resulting_matrix, maskArray[j]);
		if(mask_result == true)
		{
			return false;
		}
	}
	// console.log(current_kernel);
	return true;
}
function detect_holesBodyPix(y, x, width){

	let idx = pixel_position(width, x, y);

	let bodyFlag = 0;
	bodyFlag = pixels[idx + 3];
	
	if(bodyFlag == 0)
		return false;

	let cur_r = 0, cur_g = 0, cur_b= 0;
	cur_r = pixels[idx];
	cur_g = pixels[idx + 1];
	cur_b = pixels[idx + 2];

	if(cur_r >= 10 && cur_g >= 10 && cur_b >= 10)
		return false;
	return true;
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
function localDetection(width, height, convexHullOUt)
{
	let window = 10;
	let localValues = [];
	for(let y = 0; y < height; y += window)
	{
		// if(y < 1100)
		// 	continue;
		for(let x = 0; x < width; x += window)
		{
			let validCount = 0;

			// for(let k = 0; k < window; k++) //Find the local average here
			// {
			// 	if(y + k > height - 1)
			// 		break;
			// 	for(let l = 0; l < window; l++)
			// 	{
			// 		if(x + l > width - 1)
			// 			break;
			// 		if(pixelArray[y + k][x + l][3] != 0)
			// 		{
			// 			let minDistance = Number.POSITIVE_INFINITY;
			// 			let localDepth = 0;
			// 			for(let i = 0; i < convexHullOUt.length; i++)
			// 			{
			// 				let cx = convexHullOUt[i][0];
			// 				let cy = convexHullOUt[i][1];
			// 				let distance = euclideanDistance2D([cx, cy], [x + l, y + k]);
						
			// 				if(distance < minDistance)
			// 				{
			// 					minDistance = distance; 
			// 					localDepth = pixelArray[cy][cx][3];
			// 				}
			// 			}
			// 			if(pixelArray[y + k][x + l][3] > localDepth)
			// 			{
			// 				pixelArray[y + k][x + l][0] = 255;
			// 				pixelArray[y + k][x + l][1] = 255;
			// 				pixelArray[y + k][x + l][2] = 255;
			// 			}
			// 		}
			// 	}
			// }
			
			for(let k = 0; k < window; k++) //Find the local average here
			{
				if(y + k > height - 1)
					break;
				for(let l = 0; l < window; l++)
				{
					if(x + l > width - 1)
						break;
					if(pixelArray[y + k][x + l][3] != 0)
					{
						localValues.push(pixelArray[y + k][x + l][3]);
						validCount += 1;
					}
				}
			}
			let localStats = [];
			localStats = standard_deviation(localValues);

			let IQR = computeIQR(localValues);

			let range = Math.max(...localValues) - Math.min(...localValues);
			
			if(localValues.length != 0)
			{
				// let jsonString = JSON.stringify(localValues);
				// saveFile(jsonString, `${y}-${x}.json`);
				// console.log(`Local Values Length ${y}-${x}: ${localValues.length}`);
				// console.log(`Local Stats: ${localStats[0]}, ${localStats[1]}, ${range}`);
			}


			for(let k = 0; k < window; k++)
			{
				if(y + k > height - 1)
					break;
				for(let l = 0; l < window; l++)
				{ 	
					if(x + l > width - 1)
						break;
					
					let curDepth = pixelArray[y + k][x + l][3];
					let r = pixelArray[y + k][x + l][0];
					let g = pixelArray[y + k][x + l][1];
					let b = pixelArray[y + k][x + l][2];
					// console.log(r, g, b);
					if(curDepth != 0 && curDepth > IQR.upperBound)
					{
						pixelArray[y + k][x + l][0] = 255;
						pixelArray[y + k][x + l][1] = 255;
						pixelArray[y + k][x + l][2] = 255;
					}

					// pixelArray[y + k][x + l][0] = 255;
					// pixelArray[y + k][x + l][1] = 255;
					// pixelArray[y + k][x + l][2] = 255;
				}
			}
			localValues.splice(0, localValues.length);
		}
	}

	// for(let i = 0; i < convexHullOUt.length; i++)
	// {
	// 	let cx = convexHullOUt[i][0];
	// 	let cy = convexHullOUt[i][1];

	// 	for(let k = -2; k < 2;  k++)
	// 	{
	// 		if(cy + k < 0 || cy + k > height - 1)
	// 			continue;
	// 		for(let l = -2; l < 2; l++)
	// 		{
	// 			if(cx + l < 0 || cx + l > width - 1)
	// 				continue;
	// 			pixelArray[cy + k][cx + l][0] = 255;
	// 			pixelArray[cy + k][cx + l][1] = 0;
	// 			pixelArray[cy + k][cx + l][2] = 0;
	// 		}
	// 	}
	// }
}
function detect_interpolate_occluded(y, x, width, height, global_depthAverage){
	if(pixelArray[y][x][3] == 0)
		return;
	if(x - 1 < 0 || x + 1 >= width)
		return false; 
	if(y - 1 < 0 || y + 1 >= height)
		return false;
	
	let depthAverage = 0;
	let valid_count = 0;
	for(let k = 1; k >= -1; k--)
	{
		for(let l = -1; l <= 1; l++)
		{
			if(pixelArray[y + k][x + l][3] != 0)
			{
				depthAverage += pixelArray[y + k][x + l][3];
				valid_count += 1;
			}
		}
	}
	depthAverage = depthAverage / valid_count;

	if(depthAverage > global_depthAverage)
	{
		pixelArray[y][x][3] = -1;
	}

	if(pixelArray[y][x][3] == -1)
	{
		let sum_r = 0, sum_g = 0, sum_b = 0;
		valid_count = 0;
		for(let k = 1; k >= -1; k--)
		{
			for(let l = -1; l <= 1; l++)
			{
				if(l == 0 && k == 0)
					continue;
	
				if(pixelArray[y + k][x + l][3] != 0 && pixelArray[y + k][x + l][3] < depthAverage)
				{
					let r = 0, g = 0, b = 0;
					r = pixelArray[y + k][x + l][0];
					g = pixelArray[y + k][x + l][1];
					b = pixelArray[y + k][x + l][2];
	
					sum_r = sum_r + r;
					sum_g = sum_g + g;
					sum_b = sum_b + b;
					valid_count += 1;
				}
			}
		}
		if(valid_count != 0)
		{
			// pixelArray[y][x][0] = sum_r / valid_count;
			// pixelArray[y][x][1] = sum_g / valid_count;
			// pixelArray[y][x][2] = sum_b / valid_count;

			pixelArray[y][x][0] = 255;
			pixelArray[y][x][1] = 255;
			pixelArray[y][x][2] = 255;
		}
	}
	return;
}
function fill_in_rest(width, height)
{
	for(let i = 0; i < 2; i++)
	{
		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(x == 0 || y == 0)
					continue;
				if(holeArray[y][x] == -1)
					continue;
				if(holeArray[y][x - 1] == 1 || holeArray[y - 1][x] == 1)
				{	
					let cur_r = 0, cur_g = 0, cur_b = 0;
					cur_r = pixelArray[y][x][0];
					cur_g = pixelArray[y][x][1];
					cur_b = pixelArray[y][x][2];

					if(cur_r == 255 && cur_g == 255 && cur_b == 255)
						holeArray[y][x] = 1;
				}
			}
		}
		
		for(let y = height - 1; y >= 0; y--)
		{
			for(let x = width - 1; x >= 0; x--)
			{
				if(x == width - 1 || y == height - 1)
					continue;
				if(holeArray[y][x] == -1)
					continue;
				if(holeArray[y][x + 1] == 1 || holeArray[y + 1][x] == 1)
				{	
					let cur_r = 0, cur_g = 0, cur_b= 0;
					cur_r = pixelArray[y][x][0];
					cur_g = pixelArray[y][x][1];
					cur_b = pixelArray[y][x][2];

					if(cur_r == 255 && cur_g == 255 && cur_b == 255)
						holeArray[y][x] = 1;
				}
			}
		}
	}
}
// function interpolate_holes(pixels, y, x, width, height, kernel_size){
	
// 	let interval = 0;
// 	interval = Math.floor(kernel_size / 2);

// 	let sum_r = 0, sum_g = 0, sum_b = 0;
// 	let valid_count = 0;

// 	let color = [];

// 	for(let idx_y = -interval; idx_y <= interval; idx_y++)
// 	{
// 		if(y + idx_y < 0 || y + idx_y >= height)
// 		{
// 			continue;
// 		}
// 		for(let idx_x = -interval; idx_x <= interval; idx_x++)
// 		{	
			
// 			if(x + idx_x < 0 || x + idx_x >= width)
// 			{
// 				continue;
// 			}
// 			let r = 0, g = 0, b = 0;
// 			// let position = pixel_position(width, x + idx_x, y + idx_y);

// 			// r = pixels[position];
// 			// g = pixels[position + 1];
// 			// b = pixels[position + 2];

// 			r = pixelArray[y + idx_y][x + idx_x][0];
// 			g = pixelArray[y + idx_y][x + idx_x][1];
// 			b = pixelArray[y + idx_y][x + idx_x][2];

// 			if(r == 255 && g == 255 && b == 255)
// 				continue;

// 			sum_r = sum_r + r;
// 			sum_g = sum_g + g;
// 			sum_b = sum_b + b;

// 			valid_count += 1;
// 		}
// 	}
// 	color.push(sum_r / valid_count, sum_g / valid_count, sum_b / valid_count);
// 	return color;
// }
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
function holeProcess(pixels, y, x, width, height, kernel_size)
{
	let interval = 0;
	interval = Math.floor(kernel_size / 2);

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


			let idx = pixel_position(width, x + idx_x, y + idx_y)
			r = pixels[idx];
			g = pixels[idx + 1];
			b = pixels[idx + 2];

			if(r != 0 && g != 0 && b != 0)
			{
				valid_count += 1;
			}
		}
	}

	if(valid_count < kernel_size ** 2 * 0.3)
	{
		holeArray[y][x] = 0;
	}

	return;
}
function interpolate_overlaps(pixels, overlapped_region, y, x, color_index, width, height)
{
	// console.log(overlapped_region);
	let new_color = 0;
	let left = 0, right = 0, top = 0, bottom = 0;
	left = overlapped_region.start_x - 1;
	right = overlapped_region.end_x + 1;
	bottom = overlapped_region.start_y - 1;
	top = overlapped_region.end_y + 1;

	if(left < 0)
		left = 0;
	if(right >= width)
		right = width - 1;
	if(bottom < 0)
		bottom = 0;
	if(top >= height)
		top = height - 1;

	let d_L = 0, d_R = 0, d_T = 0, d_B = 0, diag_up = 0, diag_low = 0;
	let pixel_L = 0, pixel_R = 0, pixel_T = 0, pixel_B = 0, pixel_up = 0, pixel_low = 0;

	d_L = Math.round((x - left));
	d_R = Math.round((right - x));
	d_B = Math.round((y - bottom));
	d_T = Math.round((top - y));
	
	// console.log(left, right, top, bottom, x, y);
	try{
		pixel_L = pixelArray[y][left][color_index];
		pixel_R = pixelArray[y][right][color_index];
		pixel_B = pixelArray[bottom][x][color_index];
		pixel_T = pixelArray[top][x][color_index];
	}
	catch(error)
	{
		console.error(error);
		console.log(left, right, top, bottom, x, y, width, height);
	}

	if(overlapped_region.type == 1)
	{
		diag_up = Math.min(d_L, d_T);
		diag_low = Math.min(d_R, d_B);
		
		if(diag_up == d_L)
			pixel_up = pixel_L;
		else
			pixel_up = pixel_T;
		
		if(diag_low == d_R)
			pixel_low = pixel_R;
		else
			pixel_low = pixel_B;
	}
	if(overlapped_region.type == 2)
	{
		diag_up = Math.min(d_R, d_T);
		diag_low = Math.min(d_L, d_B);
		if(diag_up == d_R)
			pixel_up = pixel_R;
		else
			pixel_up = pixel_T;
		if(diag_low == d_L)
			pixel_low = pixel_L;
		else
			pixel_low = pixel_B;
		// pixel_up = pixel_R;
		// pixel_low = pixel_L;
	}	
	//a^2 + b^2 = c^2
	diag_up = Math.sqrt(diag_up * diag_up + diag_up * diag_up);
	diag_low = Math.sqrt(diag_low * diag_low + diag_low * diag_low);

	// pixel_L = pixels[pixel_position(width, left, y) + color_index];
	// pixel_R = pixels[pixel_position(width, right, y) + color_index];
	// pixel_B = pixels[pixel_position(width, x, bottom) + color_index];
	// pixel_T = pixels[pixel_position(width, x, top) + color_index];


	if(overlapped_region.type == 7 || overlapped_region.type == 5 || overlapped_region.type == 6)
		new_color = (d_R * pixel_L + d_L * pixel_R) / (d_L + d_R);
	else if(overlapped_region.type == 8 || overlapped_region.type == 3 || overlapped_region.type == 4)
		new_color = (d_T * pixel_B + d_B * pixel_T) / (d_B + d_T);
	else if(overlapped_region.type == 1)
		new_color =  (diag_low * pixel_up + diag_up * pixel_low) / (diag_up + diag_low);
	else if(overlapped_region.type == 2)
		new_color =  (diag_up * pixel_low + diag_low * pixel_up) / (diag_up + diag_low);
	else
		new_color = (d_R * pixel_L + d_L * pixel_R + d_T * pixel_B + d_B * pixel_T) / (d_L + d_R + d_T + d_B);

	// if(x == 388)
	// {
	// 	console.log(y, x);
	// 	console.log(diag_left, diag_right);
	// 	console.log(`New Color ${new_color}`);
	// }
	// || overlapped_region.type == 3 || overlapped_region.type == 4
	return new_color;
}
function calculate_distance_color_histogram()
{
	let file_dist = [];
	let file_color = [];
	let dist_avg = 0;
	let size_avg = 0;
	let position_avg = 0;

	for(let k = 0; k < screen_coords.length; k++)
	{
		let neighbor = tree.nearestNeighbors(screen_coords[k][0], 21);
		// for average
		let avg = 0;
		//array to determine max
		let dist_arr = [];
		let color_arr = [];
		// if(screen_coords_set[k][0] > 900 && screen_coords_set[k][0] < 910)
		// 	console.log(neighbor);
		// let cur_x = screen_coords[k][0][0];
		// let cur_y = screen_coords[k][0][1];

		// let cur_r = 0, cur_g = 0, cur_b = 0;
		// cur_r = pixelArray[cur_y][cur_x][0];
		// cur_g = pixelArray[cur_y][cur_x][1];
		// cur_b = pixelArray[cur_y][cur_x][2];

		// let cur_vector = new THREE.Vector3(cur_r, cur_g, cur_b);

		for(let l = 1; l < neighbor.length; l++)
		{
			avg = avg + neighbor[l].distance;
			dist_arr.push(neighbor[l].distance);
			
			// let x = neighbor[l].point[0];
			// let y = neighbor[l].point[1];

			// let r = 0, g = 0, b = 0;
			// r = pixelArray[y][x][0];
			// g = pixelArray[y][x][1];
			// b = pixelArray[y][x][2];
			// let vector = new THREE.Vector3(r, g, b);
			
			// let difference = deltaE(cur_vector, vector);
			
			// color_arr.push(difference);
			
			// if(cur_vector.x == 71 && cur_vector.y == 64 && cur_vector.z == 59)
			// {
			// 	console.log(cur_vector);
			// 	console.log(vector);
			// 	console.log(difference);
			// }	
			
			// if(k == 100)
			// {
			// 	console.log(neighbor[l]);
			// 	console.log(cur_vector, vector);
			// }
		}
		avg = avg / (neighbor.length - 1);
		// let dist_max = Math.max(...dist_arr);
		// let color_max = Math.max(...color_arr);

		file_dist.push(avg);
		// file_color.push(color_max);
		// dist_avg += avg;
		// size_avg += occupied_pixels_arr[k];
		// position_avg += mvPosition_arr[k];
	}
	// const jsonString = JSON.stringify(file_dist);
	// saveFile(jsonString, 'distance.json');
	let median_value_distance = median(file_dist);
	let mean_value_distance = average(file_dist);

	// let max_size = Math.max(...occupied_pixels_arr);
	// let min_size = Math.min(...occupied_pixels_arr);

	// console.log(occupied_pixels_arr.length, mvPosition_arr.length, screen_coords.length);
	// console.log(median_color.toFixed(3), average_color.toFixed(3), stdev_color	.toFixed(3));
	console.log(median_value_distance.toFixed(3));
	console.log(mean_value_distance.toFixed(3));
}
function initialize_tree()
{
	for(let j = 0; j < screen_coords.length; j++)
	{
		tree.insert(screen_coords[j], Math.round(occupied_pixels_arr[j] * 100) / 100);
	}
	screen_coords.splice(0, screen_coords.length);
	occupied_pixels_arr.splice(0, occupied_pixels_arr.length);

	tree.traverse(tree.root, node =>
	{
		screen_coords.push([node.point, node.pixelSize]);
		occupied_pixels_arr.push(node.pixelSize);
	});
}

// function onMouseStop(event) {
// 	console.log("Mouse stopped at:", event.clientX, event.clientY);
// 	modify_pixels();
// }


// for (let y = 0; y < height; y++) {
	// 	let row = [];
	// 	for (let x = 0; x < width; x++) {
	// 		// Calculate the starting index for the pixel
	// 		let index = (y * width + x) * 4;
	// 		if(flippedSegmentation[segmentationIdx] == 0)
	// 		// Push the RGBA values as an array for the pixel
	// 			row.push([pixels[index], pixels[index + 1], pixels[index + 2], 0]);
	// 		else
	// 			row.push([pixels[index], pixels[index + 1], pixels[index + 2], 1]);
	// 		segmentationIdx += 1;
	// 	}
	// 	pixelArray.push(row);
	// }
	// console.time("Initialize Pixel Array Time");	
	// for (let y = 0; y < height; y++) {
	// 	let row = [];
	// 	for (let x = 0; x < width; x++) {
	// 		// Calculate the starting index for the pixel
	// 		let index = (y * width + x) * 4;
	// 			row.push([pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]]);
	// 	}
	// 	pixelArray.push(row);
	// }
	// console.timeEnd("Initialize Pixel Array Time");

// console.time("Pixel Array Time");
		// for (let y = 0; y < height; y++) {
		// 	const targetStart = y * rowSize; // Start index in the 1D flippedPixels array
		// 	for (let x = 0; x < width; x++) {
		// 		const pixel = pixelArray[y][x]; // Get the pixel [R, G, B, A] from the 2D array
		// 		const pixelStart = targetStart + x * 4;  // Start index for this pixel in flippedPixels
		// 		// Write RGBA components into the flippedPixels array
		// 		tempPixels[pixelStart] = pixel[0];     // R
		// 		tempPixels[pixelStart + 1] = pixel[1]; // G
		// 		tempPixels[pixelStart + 2] = pixel[2]; // B
		// 		tempPixels[pixelStart + 3] = 255;      // A
		// 	}
		// }
		// console.timeEnd("Pixel Array Time");