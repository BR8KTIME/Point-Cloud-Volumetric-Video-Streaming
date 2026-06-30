import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';


let camera, scene, renderer, currentPoints, currentFrame = 0;
const totalFrames = 1;
let startTime, endTime;

let dracoLoader;
const pointCloudQueue = [];

let scale = 0;
let currentAngle = 0;

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

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 4000);
	// console.log(`Aspect Ratio: ${window.innerWidth / window.innerHeight}`)
	// camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 3, 2000);
	
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.addEventListener('change', render); // use if there is no animation loop
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

	dracoLoader = new DRACOLoader();

	// Setup DRACOLoader
	dracoLoader.setDecoderPath('./draco/');
	dracoLoader.setDecoderConfig({ type: 'js' });
	dracoLoader.setWorkerLimit(4);
	
	window.addEventListener('resize', onWindowResize);
	loadFrames();
}

// async function loadFrames() {
//     for (let i = 0; i < totalFrames; i++) {
//         const url = `http://192.168.125.129/dataset/longdress_drc_normalized/longdress/frame${i.toString().padStart(4, '0')}.drc`;
        
//         // Fetch each frame and decode immediately after fetching
//         fetch(url)
//             .then(res => res.arrayBuffer())
//             .then(buffer => {
//                 // console.log(`Starting decode for frame #${i}`);
//                 decodeDracoModel(buffer, i);
//             })
//             .catch(error => {
//                 console.error(`Error fetching or decoding frame #${i}:`, error);
//             });
//     }
// }

async function loadFrames(batchSize = 1) {
    const batches = Math.ceil(totalFrames / batchSize);

    for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        // Start index of the batch
        const start = batch * batchSize;
        // End index of the batch
        const end = Math.min(start + batchSize, totalFrames);

        for (let i = start; i < end; i++) {
            const url = `http://192.168.125.132/dataset/longdress/drc/frame${i.toString().padStart(4, '0')}.drc`;
            const promise = fetch(url)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    // console.log(`Starting decode for frame #${i}`);
                    decodeDracoModel(buffer, i);
                })
                .catch(error => {
                    console.error(`Error fetching or decoding frame #${i}:`, error);
                });
            promises.push(promise);
        }

        // Wait for the current batch to complete before moving on to the next
        await Promise.all(promises);
        console.log(`Batch ${batch + 1} of ${batches} completed.`);
    }
}


function decodeDracoModel(buffer, index) {
        // Make sure that 'parse' is used here if 'decodeDracoFile' is not a defined method
        dracoLoader.parse(buffer, geometry => {
            // console.log(`Decoding successful for frame #${index}`);
            
            if (!geometry) {
                console.error(`Decoding failed, no geometry returned for frame #${index}`);
                reject(new Error(`No geometry returned for frame #${index}`));
                return;
            }

            const material = new THREE.PointsMaterial({ size: 3, vertexColors: true });
            const points = new THREE.Points(geometry, material);
			console.log(`Number of points ${points.geometry.attributes.position.array.length / 3}`);

            // Add the points object to the point cloud queue
            pointCloudQueue.push({ points, index });

            // Resolve the promise with the points object to confirm completion
        });
};

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

function render() {
	if (pointCloudQueue.length > 0) {
		pointCloudQueue.sort((a, b) => a.index - b.index); // Ensure frames are added in order
		
		console.log(`current frame: ${currentFrame}, first value: ${pointCloudQueue[0].index}`);

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
			console.log(`Displaying: ${frame.index}`);
			currentFrame++;
		}

		if (currentFrame >= totalFrames) {			
			// Release decoder resources.
			dracoLoader.dispose();
			return;
		}
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
