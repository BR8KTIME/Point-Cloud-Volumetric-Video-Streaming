import * as THREE from 'three';
import convexHull from 'monotone-convex-hull-2d';
import concaveman from 'concaveman';

export function convex(pixelCoordinates) {
    const hullIndices = convexHull(pixelCoordinates);
    const hullPoints = hullIndices.map(i => pixelCoordinates[i]);
    // const verts = hullPoints.map(([x, y]) => new THREE.Vector3(x, -y, 0)); // Flip Y to match canvas
    // verts.push(verts[0]); // close loop

    // const geometry = new THREE.BufferGeometry().setFromPoints(verts);
    // const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    // const loop = new THREE.LineLoop(geometry, material);

    // scene.add(loop);
    return hullPoints;
}

export function concave(pixelCoordinates) {
    const hullPoints = concaveman(pixelCoordinates, 0.8);
    // scene.add(loop);
    return hullPoints;
}