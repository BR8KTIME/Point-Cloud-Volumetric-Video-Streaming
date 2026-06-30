import * as THREE from 'three';

export class AsyncPCDLoader {
    constructor() {
        this.worker = new Worker('./worker.js');
    }

    parse(buffer) {
        return new Promise((resolve, reject) => {
            // Set up a one-time listener for the worker's response
            this.worker.onmessage = (event) => {
                if (event.data.error) {
                    return reject(new Error(event.data.error));
                }

                // Reconstruct the BufferGeometry on the main thread
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(event.data.position, 3));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(event.data.color, 3));

                // Create the final THREE.Points object
                const material = new THREE.PointsMaterial({});
                const points = new THREE.Points(geometry, material);

                // Resolve the promise with the finished object
                resolve(points);
            };

            this.worker.onerror = (error) => reject(error);

            // Send the buffer to the worker to start parsing (transferring ownership)
            this.worker.postMessage({ buffer }, [buffer]);
        });
    }

    dispose() {
        // Clean up the worker when it's no longer needed
        this.worker.terminate();
    }
}