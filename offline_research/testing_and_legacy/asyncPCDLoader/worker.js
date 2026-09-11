import * as THREE from 'three';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';


// Listen for a message from the main thread
self.onmessage = (event) => {
    try {
        const { buffer } = event.data;
        if (!buffer) return;

        // Instantiate the synchronous loader inside the worker
        const loader = new PCDLoader();

        // Perform the blocking parse operation safely on this background thread
        const points = loader.parse(buffer);

        // Extract the raw attribute data (position and color arrays)
        const position = points.geometry.attributes.position.array;
        const color = points.geometry.attributes.color.array;

        // Send the raw data back to the main thread, transferring ownership of the buffers
        self.postMessage(
            { position, color },
            [position.buffer, color.buffer]
        );
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};