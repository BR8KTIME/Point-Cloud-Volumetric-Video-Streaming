import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';


import { euclideanDistance3D, euclideanDistance2D, median, average, computeIQR, dot, normalize, ORMatrices, checkMatrices, standard_deviation, getModelViewMatrix } from '../modules/utility.js';
import { concave } from '../modules/hull.js';
import { saveFile , readZipFromArrayBuffer, loadSigns} from '../modules/io.js';
import { discardWithNormals } from '../modules/customshader.js';

let camera, scene, renderer, currentAngle;

let isRunning = false;
let screen_coords = [];
let scale = 0;
let point_info_array = [];
let pixelArray = [];
let pixels_on_screen = [];
let holeArray = [];
let total_area_arr = [];
var pixels;
let pointSize = 0;

let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let modifiedMesh, postMesh;
let dataRecord = [];
let postRecord = [];

const canvas = document.getElementById("webglCanvas");
const POINTS = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function wait() {
  console.log("before");
  sleep(10).then(() => init());
  console.log("done!");
}

wait();

async function init() {

	//antialis makes the rendered scene look smoother and more visually apealing by reducing the jagged edges
	renderer = new THREE.WebGLRenderer({ antialias: false, canvas });
	renderer.setPixelRatio(window.devicePixelRatio);
	console.log(window.devicePixelRatio)
	renderer.setSize(window.innerWidth, window.innerHeight);
	console.log(`Canvas Size: ${window.innerWidth}, ${window.innerHeight}\n`);
	scale = window.innerHeight * window.devicePixelRatio / 2;
	console.log(`Scale: ${scale}\n`);
	
	//set the background image
	// renderer.setClearColor(0xffffff);
	renderer.setClearColor(0x000000);

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

	const radius = 1600;  // Distance from center
	currentAngle = 350;    // 0 = front, 90 = right, 180 = back, etc.
	const angle = THREE.MathUtils.degToRad(currentAngle);

	// Set camera position relative to front
	const x = radius * Math.sin(angle);
	const z = radius * Math.cos(angle);
	const y = 550; 

	camera.position.set(x, y, z);
	camera.lookAt(300, 490, 0);
	// camera.lookAt(250, 690, 0);

	scene.add(camera);

	window.addEventListener('resize', onWindowResize);
	start();
}

async function start() {
    let baseUrl = 'http://192.168.125.132/dataset/longdress/normalSequencesBinary/';
	// let baseUrl = 'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/'\
	let baseURL = 'http://141.223.65.28/dataset/longdress/sequences/'

    let level = 'level';
    let pcdFormat = '.pcd';

    const totalFrames = 10; // Let's say you want to loop through frames 0 to 9
    const frameNumberPadding = 4; // '0000' has 4 digits

    for (let i = 0; i < totalFrames; i++) {
        const frameNumStr = i.toString();
        const paddedFrameNum = frameNumStr.padStart(frameNumberPadding, '0');

		for(let k = 3; k <= 12; k++)
		{
			pointSize = k;
			for (let j = 0; j < 10; j++) {
				const newURL = `${baseUrl}frame${paddedFrameNum}/${level}${j}${pcdFormat}`;
				// const newURL = `${baseUrl}/${level}${j}${pcdFormat}`;
				await loadPointCloud(newURL, i, j);
				clearMesh();
			}
			clearCanvas();
		}
	}
	console.log(dataRecord);
	console.log(postRecord);
	saveFile(dataRecord, "Hole Area");
	saveFile(postRecord, "Post Hole Area");

}
function clearCanvas()
{
	for(let i = 0; i < POINTS.length; i++)
	{
		scene.remove(POINTS[i]);
		disposeObject(POINTS[i]);
	}
	POINTS.splice(0, POINTS.length);

	renderer.render(scene, camera);
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


async function loadPointCloud(URL, frame, LoD) {
    const loader = new PCDLoader();
    // Return a new Promise that encapsulates the asynchronous loading process
    return new Promise(async (resolve, reject) => {

        loader.load(URL, async function (points) { // This is the success callback
            try {
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
				console.log(`Distance ${distance}`);

                points.material.vertexColors = true;
                points.material.size = pointSize;
                points.material.sizeAttenuation = true;
                discardWithNormals(points.material);

                scene.add(points);
                POINTS.push(points); 
                let totalPoints = 0;
                for(let i = 0; i < POINTS.length; i++)
                {
                    totalPoints += POINTS[i].geometry.attributes.position.array.length / 3;
                }

                console.log(`Total Points: ${totalPoints}, Frame: ${frame}, LoD: ${LoD}, Point Size: ${pointSize}`);
                render();
				modify_pixels(); 
                // console.log(`Done with ${URL}`);
                resolve(points); // Resolve with the loaded points object, or true, or whatever is useful
            } catch (error) {
                console.error(`Error processing point cloud for ${URL}:`, error);
                reject(error); // Reject the Promise if any error occurs during processing
            }
        });
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

	if(x < 0 || x > width - 1)
		return;
	if(y < 0 || y > height - 1)
		return;

	// let farDistance = camera.far;// Distance from the viewport to the far plane
	// let cameraDistance = cameraPosition.length();
	// let depth_distance = cameraDistance / farDistance;
	
	let index = pixel_position(width, Math.floor(x), Math.floor(y));
	if(pixels[index] == 0 && pixels[index + 1] == 0 && pixels[index + 2] == 0)
		return;

	// screen_coords.push([[x, y], occupied_pixels]);
	screen_coords.push([Math.floor(x), Math.floor(y)]);

	// occupied_pixels_arr.push(occupied_pixels);
	// mvPosition_arr.push(-cameraPosition.z);
	// depthDistance_arr.push(depth_distance);
	return;
}
function detect_holesConcave(hullPoints, width, height){
	
	// for(let i = 0; i < hullPoints.length; i++)
	// {
	// 		let px = hullPoints[i][0];
	// 		let py = hullPoints[i][1];

	// 		let idx = pixel_position(width, px, py);
	// 		pixels[idx] = 0;
	// 		pixels[idx + 1] = 255;
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

		// if(r >= 220 && g >= 220 && b >= 220)
		// {
		// 	holeArray[py][px] = 1;
		// }
		if(r <= 10 && g <= 10 && b <= 10)
		{
			holeArray[py][px] = 1;
		}
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
		// const canvas = renderer.domElement;
		// const canvas = document.getElementById('webglCanvas');
		const gl = canvas.getContext('webgl2');
		console.log(gl);	
		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;

		pixelArray.splice(0, pixelArray.length);
		screen_coords.splice(0, screen_coords.length);
		point_info_array.splice(0, point_info_array.length);
		pixels_on_screen.splice(0, pixels_on_screen.length);
		holeArray.splice(0, holeArray.length);
		total_area_arr.splice(0, total_area_arr.length);
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
		pixels_on_screen = Array(height).fill().map(() => Array(width).fill(0));
		holeArray = Array(height).fill().map(() => Array(width).fill(0));
		
		// console.log(`Canvas: `, gl);	
		// console.log("Drawing Buffer Width:", gl.drawingBufferWidth);
		// console.log("Drawing Buffer Height:", gl.drawingBufferHeight);
		// console.log(`Pixels: ${pixels.length}`);
		// console.log(pixels);
		
		const flipped = new Uint8ClampedArray(pixels.length);
    	const rowSize = width * 4;


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
				if(holeArray[y][x] == 1)
					holeArea += 1;
			}
		}
		console.log(`Total Hole Area ${holeArea}`);
		dataRecord.push(holeArea);

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

		pixelArray.splice(0, pixelArray.length);
		screen_coords.splice(0, screen_coords.length);
		point_info_array.splice(0, point_info_array.length);
		pixels_on_screen.splice(0, pixels_on_screen.length);
		holeArray.splice(0, holeArray.length);
		total_area_arr.splice(0, total_area_arr.length);
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
		pixels_on_screen = Array(height).fill().map(() => Array(width).fill(0));
		holeArray = Array(height).fill().map(() => Array(width).fill(0));
		
		// console.log(`Canvas: `, gl);	
		// console.log("Drawing Buffer Width:", gl.drawingBufferWidth);
		// console.log("Drawing Buffer Height:", gl.drawingBufferHeight);
		// console.log(`Pixels: ${pixels.length}`);
		// console.log(pixels);
		
		const flipped = new Uint8ClampedArray(pixels.length);
    	const rowSize = width * 4;


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
				if(holeArray[y][x] == 1)
					holeArea += 1;
			}
		}
		console.log(`Total Hole Area ${holeArea}`);
		postRecord.push(holeArea);

		for(let y = 0; y < height; y++)
		{
			for(let x = 0; x < width; x++)
			{
				if(holeArray[y][x] == 1)
				{
					let idx = pixel_position(width, x, y);
					pixels[idx] = 0;
					pixels[idx + 1] = 255;
					pixels[idx + 2] = 0;
					// interpolate_holes(y, x, width, height, 7);
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

