import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';


import { getModelViewMatrix } from './utility.js';
import { getSigns} from './removePoints3D.js';
import JSZip from 'jszip'

let camera, scene, renderer, currentAngle;

let scale = 0;

let dracoLoader;

const allSignsData = {}; 

const canvas = document.getElementById("webglCanvas");


init();

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
	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 4000);
	
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

	const radius = 2445;  // Distance from center
	currentAngle = 0;    // 0 = front, 90 = right, 180 = back, etc.
	const angle = THREE.MathUtils.degToRad(currentAngle);

	// Set camera position relative to front
	const x = radius * Math.sin(angle);
	const z = radius * Math.cos(angle);
	const y = 700 // maintain current Y (or set as needed) 700

	camera.position.set(x, y, z);
	camera.lookAt(250, 490, 0);
	// camera.lookAt(250, 690, 0);
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./draco/');
	dracoLoader.setDecoderConfig({ type: 'js' });
	dracoLoader.setWorkerLimit(4);

	scene.add(camera);

	window.addEventListener('resize', onWindowResize);
	start();
}

async function start() {
    let baseUrl = 'http://192.168.125.132/dataset/longdress/drcNormalSequences/';
    let level = 'level';
    let pcdFormat = '.drc';

    const totalFrames = 100; // Let's say you want to loop through frames 0 to 9
    const frameNumberPadding = 4; // '0000' has 4 digits

    // This array will hold all the promises from loading point clouds across all frames and levels
    const allLoadingPromises = [];

    for (let i = 0; i < totalFrames; i++) {
        const frameNumStr = i.toString();
        const paddedFrameNum = frameNumStr.padStart(frameNumberPadding, '0');

        for (let j = 0; j < 10; j++) {
            const newURL = `${baseUrl}frame${paddedFrameNum}/${level}${j}${pcdFormat}`;
            const fileName = `F${i}L${j}A${currentAngle}.txt`; // Include angle in filename for uniqueness
            console.log(`Scheduling load for: ${fileName}`);
            // Add each promise directly to the combined array
            allLoadingPromises.push(loadDrc(newURL, fileName));
        }
    }

    try {
        // Wait for ALL point cloud loading operations (across all frames and levels) to complete.
        // This is the critical step to ensure allSignsData is fully populated.
        await Promise.all(allLoadingPromises);
        console.log("All scheduled point cloud loading operations have successfully completed.");

        // Now, after all promises have resolved, check the size of the allSignsData object.
        // Use Object.keys().length to get the number of properties in the object.
		console.log(allSignsData);
        if (Object.keys(allSignsData).length > 0) {
            console.log(`Initiating ZIP download for ${Object.keys(allSignsData).length} files.`);
            await createAndDownloadZip(allSignsData, 'all_point_cloud_signs.zip');
        } else {
            console.warn("No sign data was collected. ZIP file will not be created.");
        }
    } catch (error) {
        console.error("One or more point cloud loading operations failed:", error);
        // Depending on your error handling strategy, you might still attempt to
        // download a partial ZIP or halt the process.
        if (Object.keys(allSignsData).length > 0) {
            console.warn("Attempting to download partial data due to previous errors.");
            await createAndDownloadZip(allSignsData, 'partial_point_cloud_signs.zip');
        }
    }
}


// Ensure loadPointCloud returns a Promise that resolves when data is added
function loadDrc(url, fileName) {
    return new Promise((resolve, reject) => {
        
        dracoLoader.load(url, function (geometry) {
            const material = new THREE.PointsMaterial({size: 3, vertexColors: true});
            const points = new THREE.Points(geometry, material);
            
            console.log(`Processing points for ${fileName}: ${points.geometry.attributes.position.array.length / 3}`);

            let signs = [];
            // Assuming getModelViewMatrix and getSigns are correctly defined elsewhere
            let normalMatrix = getModelViewMatrix(points, camera);
            signs = getSigns(points.geometry.attributes, camera, normalMatrix);

            // Store the signs array as a string in the global allSignsData object
            allSignsData[fileName] = signs.join(','); // Ensure correct string conversion

            resolve(); // Resolve this specific promise to indicate completion
        }, undefined, function (error) {
            console.error(`Error loading PCD from ${url}:`, error);
            reject(error); // Reject the promise on error
        });
    });
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

function render() {
	renderer.render(scene, camera);
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
}

// Function to create and download a ZIP file
async function createAndDownloadZip(files, zipFilename) {
    const zip = new JSZip();

    for (const filename in files) {
        if (Object.hasOwnProperty.call(files, filename)) {
            zip.file(filename, files[filename]);
        }
    }

    console.log(`Preparing to download ${Object.keys(files).length} files in ${zipFilename}`);

    const content = await zip.generateAsync({ type: "blob" });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = zipFilename;
    document.body.appendChild(a); // Append to body to ensure it's in the DOM
    a.click();
    document.body.removeChild(a); // Clean up
    URL.revokeObjectURL(a.href); // Release object URL

    console.log(`Successfully downloaded ${zipFilename}`);
}