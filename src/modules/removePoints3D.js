import * as THREE from 'three';
import { get_mvPosition, normalize, dot } from './utility';
import { FileLoader } from 'three';

export function display_normals(position, normal)
{
        const normalHelpers = new THREE.Group(); // Group to hold all normal helpers

        const vectorLength = 30; // Length of the normal vectors
        
        for (let i = 0; i < position.count; i += 25) {
            const vertex = new THREE.Vector3().fromBufferAttribute(position, i);

            if (normal) {
                const normalVector = new THREE.Vector3().fromBufferAttribute(normal, i);
                const arrowHelper = new THREE.ArrowHelper(normalVector.normalize(), vertex, vectorLength, 0xff0000);
                normalHelpers.add(arrowHelper);
            }
        }
        scene.add(normalHelpers);
}
export function estimate_normal_vector(points, objectcentroid)
{
    let arr = [];
    let count = 0;
    console.log(centroids);
    let counts = new Array(32).fill(0);
    for(let j = 0; j < points.position.array.length;  j += 3)
    {
        const X = points.position.array[j];
        const Y = points.position.array[j + 1];
        const Z = points.position.array[j + 2];
        let cur_vector = new THREE.Vector3(X, Y, Z);
        
        let minDistance = Number.POSITIVE_INFINITY;
        let flag = 0;

        for(let c = 0; c < centroids.length; c++)
        {
            let distance = euclideanDistance(cur_vector, centroids[c]);
            if(distance < minDistance)
            {
                minDistance = distance;
                flag = c;
            }
        }

        for(let c = 0; c < centroids.length; c++)
        {
            if(flag == c)
            {
                arr.push(X - centroids[c].x, Y - centroids[c].y , Z - centroids[c].z);
            }
        }
        // arr.push(X - objectcentroid.x, Y -objectcentroid.y , Z - objectcentroid.z);


        // let division_idx = 0;
        // for(let c = 0; c < centroids.length; c += 2)
        // {
        // 	if((Y > minY + division_idx * divisionY) && (Y <= minY + (division_idx + 1) * divisionY)) //Division 1
        // 	{
        // 		if((X > minX) && (X <= minX + divisionX))
        // 		{
        // 			arr.push(X - centroids[c].x, Y - centroids[c].y , Z - centroids[c].z);
        // 		}
        // 		else
        // 		{
        // 			arr.push(X - centroids[c + 1].x, Y - centroids[c + 1].y , Z - centroids[c + 1].z);
        // 		}
        // 	}
        // 	division_idx += 1;		
        // }
    }
    return arr;
}
export function remove_pointsNormalBased(points, camera, normalMatrix)
{
    let new_position = [];
    let new_color = [];
    let count = 0;
    let signs = [];
    let color_arr = points.color.array;

    for(let i = 0; i < points.position.array.length; i += 3)
    {

        let mvPosition = [], normals = [];
        let dot_product = 0;
        const x = points.position.array[i];
        const y = points.position.array[i + 1];
        const z = points.position.array[i + 2];
        mvPosition = get_mvPosition(new THREE.Vector3(x, y, z), camera);

        const nx = points.normal.array[i];
        const ny = points.normal.array[i + 1];
        const nz = points.normal.array[i + 2];
        normals = new THREE.Vector3(nx, ny, nz);

        normals = normals.clone().applyMatrix3(normalMatrix).normalize();
        mvPosition = normalize(mvPosition);
        
        mvPosition.x = -mvPosition.x;
        mvPosition.y = -mvPosition.y;
        mvPosition.z = -mvPosition.z;
        
        dot_product = dot(mvPosition, normals);

        if(dot_product > -0.3)
        {
            new_position.push(x, y, z);
            new_color.push(color_arr[i], color_arr[i + 1], color_arr[i + 2]);
            signs.push(0);	
        }
        else
        {
            signs.push(1);
        }
        count += 1;
    }
    return [new_position, new_color, signs];
}
export function getSigns(points, camera, normalMatrix)
{
    let signs = [];
    for(let i = 0; i < points.position.array.length; i += 3)
    {

        let mvPosition = [], normals = [];
        let dot_product = 0;
        const x = points.position.array[i];
        const y = points.position.array[i + 1];
        const z = points.position.array[i + 2];
        mvPosition = get_mvPosition(new THREE.Vector3(x, y, z), camera);

        const nx = points.normal.array[i];
        const ny = points.normal.array[i + 1];
        const nz = points.normal.array[i + 2];
        normals = new THREE.Vector3(nx, ny, nz);

        normals = normals.clone().applyMatrix3(normalMatrix).normalize();
        mvPosition = normalize(mvPosition);
        
        mvPosition.x = -mvPosition.x;
        mvPosition.y = -mvPosition.y;
        mvPosition.z = -mvPosition.z;
        
        dot_product = dot(mvPosition, normals);

        if(dot_product > -0.3)
        {
            signs.push(1);	
        }
        else
        {
            signs.push(0);
        }
    }
    return signs;
}
export function remove_pointsSignBased(points, signs, angle)
{
    let signsIndex = 0;
    
    for(let j = 0; j < signs.length; j += 1)
    {

        if(angle >= 30 * j && angle < 30 * (j + 1))
        {
            signsIndex = j;
        }
    }
    let index = 0;
    let count = 0;
    let color_arr = points.color.array;

    let new_position = [];
    let new_color = [];
    for(let i = 0; i < points.position.array.length; i += 3)
    {
        const x = points.position.array[i];
        const y = points.position.array[i + 1];
        const z = points.position.array[i + 2];
        let visible = 0;
        if(signs[signsIndex][index] == signs[signsIndex + 1][index])
        {
            visible = signs[signsIndex][index];
        }
        else
        {
            let normalizedAngle = 0;
            normalizedAngle = angle - 30 * signsIndex;
            normalizedAngle = normalizedAngle / 30;

            if(normalizedAngle > 0.5)
                visible = signs[signsIndex + 1][index];
            else
                visible = signs[signsIndex][index];
        }
 
        if(visible == 1)
        {
            new_position.push(x, y, z);
            new_color.push(color_arr[i], color_arr[i + 1], color_arr[i + 2]);
            count += 1;
        }
        index += 1;
    }
    // console.log(count, index);
    
    // for(let i = 0; i < points.position.array.length; i += 3)
    // {
    //     for(let j = 0; j < 1; j += 1)
    //     {
    //         if(signs[j][index] != signs[j + 1][index])
    //         {
    //             console.log(signs[j][index], signs[j + 1][index]);
    //             count += 1;
    //         }
    //         else
    //             totalCount += 1;
    //     }
    //     index += 1;
    // }
    

    return [new_position, new_color];
}
export function remove_pointsCoordinateBased(points, minY, divisionY, minX, divisionX)
{
    let new_position = [];
    let new_color = [];
    let count = 0;

    let color_arr = points.color.array;
    let centroidsMv = [];
    for(let j = 0; j < centroids.length; j++)
    {
        let x =  centroids[j].x;
        let y =  centroids[j].y;
        let z =  centroids[j].z;
        
        centroidsMv.push(get_mvPosition(new THREE.Vector3(x, y, z)));
    }

    for(let i = 0; i < points.position.array.length; i += 3)
    {
        let mvPosition = [];
        const X = points.position.array[i];
        const Y = points.position.array[i + 1];
        const Z = points.position.array[i + 2];
        mvPosition = get_mvPosition(new THREE.Vector3(X, Y, Z));
        let cur_vector = new THREE.Vector3(X, Y, Z);

        let minDistance = Number.POSITIVE_INFINITY;
        let index = 0;

        for(let c = 0; c < centroids.length; c++)
        {
            let distance = euclideanDistance(cur_vector, centroids[c]);
            if(distance < minDistance)
            {
                minDistance = distance;
                index = c;
            }
        }

        let flag = 0;
        for(let c = 0; c < centroids.length; c++)
        {
            if(index == c)
            {
                if(mvPosition.z < centroidsMv[c].z)
                    flag = 1;
            }
        }

        // let flag = 0;
        // let division_idx = 0;
        // for(let c = 0; c < centroids.length; c += 2)
        // {
        // 	if((Y > minY + division_idx * divisionY) && (Y <= minY + (division_idx + 1) * divisionY)) //Check which division it belongs to
        // 	{
        // 		if((X > minX) && (X <= minX + divisionX))
        // 		{
        // 			if(mvPosition.z < centroidsMv[c].z)
        // 				flag = 1;
        // 		}
        // 		else
        // 		{
        // 			if(mvPosition.z < centroidsMv[c + 1].z)
        // 				flag = 1;
        // 		}
        // 	}
        // 	division_idx += 1;		
        // }

        if(flag == 0)
        {
            new_position.push(X, Y, Z);
            new_color.push(color_arr[i], color_arr[i + 1], color_arr[i + 2])	
        }
        count += 1;
    }
    return [new_position, new_color];
}
export function only_face(points)
{
    let new_position = [];
    let new_color = [];

    let color_arr = points.color.array;

    for(let i = 0; i < points.position.array.length; i += 3)
    {
        const X = points.position.array[i];
        const Y = points.position.array[i + 1];
        const Z = points.position.array[i + 2];

        if(Y > 850)
        {
            new_position.push(X, Y, Z);
            new_color.push(color_arr[i], color_arr[i + 1], color_arr[i + 2])	
        }
    }
    return [new_position, new_color];
}

