import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';


import { euclideanDistance3D, euclideanDistance2D, median, average, computeIQR, dot, normalize, ORMatrices, checkMatrices, standard_deviation, getModelViewMatrix } from '../modules/utility.js';
import { saveFile , readZipFromArrayBuffer, loadSigns} from '../modules/io.js';
import { discardWithNormals } from '../modules/customshader.js';

let camera, scene, renderer, currentAngle;

let isRunning = false;
let screen_coords = [];
let scale = 0;
let point_info_array = [];
let overlapped_array = [];
let pixelArray = [];
let pixels_on_screen = [];
let occupied_pixels_arr = [];
let total_area_arr = [];
let signsAngle = [];
var pixels;
let pointSize = 0;
let LoD = 0;

let devicePixelRatio = window.devicePixelRatio;
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

let modifiedMesh;
let dataRecord = [];

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
	const y = 550 // maintain current Y (or set as needed) 700

	camera.position.set(x, y, z);
	camera.lookAt(300, 490, 0);
	// camera.lookAt(250, 690, 0);	

	scene.add(camera);

	window.addEventListener('resize', onWindowResize);
	start();
}

async function start() {
    let baseUrl = 'http://192.168.125.132/dataset/longdress/normalSequencesBinary/';
    // let baseUrl = 'http://192.168.125.132/dataset/redandblack/visual/with_normals/10_levels/'
	let level = 'level';
    let pcdFormat = '.pcd';

    const totalFrames = 100; // Let's say you want to loop through frames 0 to 9
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
			}
			clearCanvas();
		}
	}
	console.log(dataRecord);
	saveFile(dataRecord, "Overlap Area");	
}

function clearCanvas()
{
	for(let i = 0; i < POINTS.length; i++)
	{
		scene.remove(POINTS[i]);
		disposeObject(POINTS[i]);
	}
	POINTS.splice(0, POINTS.length);


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

function log_coord(pixels, worldPosition, width, height, index) {
	
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

async function modify_pixels() {
	if (isRunning){
		console.log("Still Running");
		return;
	} 
	isRunning = true;	
	try
	{
		console.time("Total Time");
		const gl = canvas.getContext('webgl2')
		const width = gl.drawingBufferWidth;
		const height = gl.drawingBufferHeight;
		console.log(gl);	

		pixelArray.splice(0, pixelArray.length);
		screen_coords.splice(0, screen_coords.length);
		occupied_pixels_arr.splice(0, occupied_pixels_arr.length);
		point_info_array.splice(0, point_info_array.length);
		overlapped_array.splice(0, overlapped_array.length);
		pixels_on_screen.splice(0, pixels_on_screen.length);
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

		pixels_on_screen = Array(height).fill().map(() => Array(width).fill(0));

		console.log(`Screen Coordinate Length ${screen_coords.length}`);
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
				log_coord(pixels, worldPosition, width, height, i);
			}
		}

		let screen_coords_set = new Set(screen_coords.map(pair => JSON.stringify(pair)));
		screen_coords.splice(0, screen_coords.length);

		// Convert back to arrays if needed
		screen_coords = [...screen_coords_set].map(str => JSON.parse(str));
		console.log(`Screen Coordinate Length ${screen_coords.length}`);
		
		// console.time("Bounding Box Time");
		// Find boundingbox's upper and lower corners of each point
		point_info_array = calculate_boundingbox(width, height);
		point_info_array.sort((a, b) => a.Upper_x - b.Upper_x);
		// console.timeEnd("Bounding Box Time");

		console.log(`Point Info Array: ${point_info_array.length}`);

		// console.time("Overlap Time");
		//Using bounding box's corners find the overlapping regions' corners
		overlapped_array = calculateOverlappingRegion(point_info_array, width, height);
		console.log(`Overlap Area Length ${overlapped_array.length}`);
		// console.timeEnd("Overlap Time");


		let overlapArea = 0;
		for(let k = 0; k < overlapped_array.length; k++)
		{
			let area = 0, area_width = 0, area_height = 0;
			area_width = overlapped_array[k].end_x - overlapped_array[k].start_x;
			area_height = overlapped_array[k].end_y - overlapped_array[k].start_y;
			area = area_width * area_height;
			overlapArea += area;
		}
		console.log(`Total Overlapped Area ${overlapArea}`);
		dataRecord.push(overlapArea);
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

