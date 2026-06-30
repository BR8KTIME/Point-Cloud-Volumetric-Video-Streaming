import * as THREE from 'three';



export function median(arr) {
    if (arr.length === 0) return null;

    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        // Even length: average of middle two
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        // Odd length: middle element
        return sorted[mid];
    }
}
export function getAverage(arr) {
    if (arr.length === 0) return null;
    let average = 0;

    for(let j = 0; j < arr.length; j++)
    {
        average += arr[j];
    }
    return average / arr.length;
}
export function getRMSE(actual, predicted)
{
    let sum = 0;
    for(let i = 0; i < actual.length; i++)
    {
        if(i == 0)
            continue;
        sum = sum + (actual[i] - predicted[i]) ** 2;
    }
    let rmse = Math.sqrt(sum / (actual.length - 1));
    return rmse; 
}

export function standard_deviation(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
    }
    
    let mean = sum / arr.length;

    let squaredDiffs = 0;
    for (let i = 0; i < arr.length; i++) {
        squaredDiffs += (arr[i] - mean) * (arr[i] - mean);
    }

    return [mean, Math.sqrt(squaredDiffs / arr.length)]; // Use arr.length - 1 for sample variance
}
export function computeIQR(data) {

    // Step 1: Sort the data
    const sorted = [...data].sort((a, b) => a - b);

    // Step 2: Helper function for quantiles
    const quantile = (arr, q) => {
        const pos = (arr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if ((arr[base + 1] !== undefined)) {
            return arr[base] + rest * (arr[base + 1] - arr[base]);
        } else {
            return arr[base];
        }
    };

    const q1 = quantile(sorted, 0.25);
    const q2 = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return { 
        lowerBound,
        upperBound,
        q1,
        q2,
        q3,
        iqr
    };
}

export function calculateBins(IQR, max, min, n)
{
    let optimalBinWidth = 2 * IQR * n ** (-1/3);
    let numberofBins = 0;

    if (optimalBinWidth > 0) {
        numberofBins = Math.round((max - min) / optimalBinWidth);
    } else {
        numberofBins = Math.round(Math.sqrt(n)); 
    }

    if (!Number.isInteger(numberofBins) || numberofBins <= 0) {
        throw new Error(`Invalid argument for 'bins'. Expected a positive integer, but received: ${numberofBins} with Max: ${max}, Min:${min}, IQR:${IQR}, N: ${n}`);
    }
    return numberofBins;
}

export function otsuThreshold(histogram) {
    const total = histogram.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;

    let sum = 0;
    for (let i = 0; i < histogram.length; i++) {
        sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0; 
    let wF = 0; 
    
    let maxVariance = 0;
    let threshold = 0;

    for (let t = 0; t < histogram.length; t++) {
        wB += histogram[t]; // Weight of background
        if (wB === 0) continue;

        wF = total - wB; // Weight of foreground
        if (wF === 0) break;

        sumB += t * histogram[t];

        const mB = sumB / wB; // Mean of background
        const mF = (sum - sumB) / wF; // Mean of foreground

        // Calculate the between-class variance
        const varianceBetween = wB * wF * Math.pow(mB - mF, 2);

        // Check if this is the new maximum variance
        if (varianceBetween > maxVariance) {
            maxVariance = varianceBetween;
            threshold = t;
        }
    }

    return threshold;
}

export function getThreshold(binIndex, min, max, bins = 256) {
    // 1. Get the min and max of the original data to establish the scale.
    const range = max - min;

    // 2. Handle the edge case where all data points are the same.
    // In this case, the range of any bin is just that single value.
    if (range === 0) {
        return { start: min, end: max, center: min };
    }

    // 3. Calculate the width of each bin's value range.
    // We divide by (bins - 1) because there are (bins - 1) intervals
    // between the min and max values for 'bins' number of points.
    // For example, 3 bins means 2 intervals.
    const binWidth = range / (bins - 1);

    // 4. Calculate the start of the range for the given bin index.
    // This is the minimum value plus the width of all preceding bins.
    const startValue = min + (binIndex * binWidth);

    // 5. The end of the range is the start plus the width of one bin.
    const endValue = startValue + binWidth;

    return { start: startValue, end: endValue };
}

export function createHistogram(data, bins = 256) {    
    const histogram = new Array(bins).fill(0);

    // 2. Find the min and max values to know the range of our data.
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    
    // If all data points are the same, handle this edge case.
    if (range === 0) {
        const binIndex = Math.floor(((data[0] - min) / 1) * (bins - 1)); // Avoid division by zero
        histogram[binIndex] = data.length;
        return histogram;
    }

    // 3. Loop through each value in the raw data array.
    for (const value of data) {
        // 4. Map the value to a specific bin index.
        // This formula scales the value to fit within the number of bins.
        const binIndex = Math.floor(((value - min) / range) * (bins - 1));
        
        // 5. Increment the count for that bin.
        histogram[binIndex]++;
    }
    return histogram;
}

export function getModelViewMatrix(points, camera)
{
    points.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, points.matrixWorld);
    let normalMatrix = new THREE.Matrix3().getNormalMatrix(points.modelViewMatrix);
    return normalMatrix;
}
export function dot(vec1, vec2)
{
    return vec1.x * vec2.x + vec1.y * vec2.y + vec1.z * vec2.z;
}
export function normalize(vec)
{
    const length = Math.sqrt(vec.x ** 2 + vec.y ** 2 + vec.z ** 2);
    return new THREE.Vector3(vec.x / length, vec.y / length, vec.z / length);
}
export function euclideanDistance3D(vector1, vector2)
{
    let x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;
    x1 = vector1.x;
    y1 = vector1.y;
    z1 = vector1.z;

    x2 = vector2.x;
    y2 = vector2.y;
    z2 = vector2.z;

    let distance = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2);
    return distance;
}
export function euclideanDistance2D(point1, point2)
{
    let x1 = 0, y1 = 0, z1 = 0, x2 = 0, y2 = 0, z2 = 0;
    x1 = point1[0];
    y1 = point1[1];

    x2 = point2[0];
    y2 = point2[1];

    let distance = Math.sqrt((x2 - x1)**2 + (y2 - y1)**2);
    return distance;
}
export function get_mvPosition(point, camera)
{
    const worldPosition = new THREE.Vector3(point.x, point.y, point.z);
    const cameraPosition = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse);
    return cameraPosition;
}
export function with_normalMatrix(normal)
{
    const normalMatrix = new THREE.Matrix3();
    normalMatrix.setFromMatrix4(camera.matrixWorldInverse);
    
    normalMatrix.invert();
    normalMatrix.transpose();

    const vector = new THREE.Vector3(normal.x, normal.y, normal.z);
    const vNormal = vector.clone().applyMatrix3(normalMatrix);
    return vNormal;
}
export function ORMatrices(matrixA, matrixB) {
    const result = new THREE.Matrix3();
    for (let i = 0; i < 9; i++) 
	{
		result.elements[i] = (matrixA.elements[i] | matrixB.elements[i]);
    }
    return result;
}
export function checkMatrices(matrixA, matrixB) {
	let count = 0;
    for (let i = 0; i < 9; i++) 
	{
        if(matrixA.elements[i] == matrixB.elements[i])
			count += 1;
    }
	if(count == 9)
		return true;

	return false;
}