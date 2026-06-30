
// Number of dimensions
const k = 2;

class Node {
constructor(point, pixelSize, depth_distance) {
	this.point = point;
	this.left = null;
	this.right = null;
    this.pixelSize = pixelSize;
    // this.depth_distance = depth_distance;
    // this.bbox = null;
}
}

class KDTree {
    constructor() {
        this.root = null;
    }
    clear(){
        this.root = null;
    }
    // Inserts a new point into the KD-Tree
    insert(point, pixelSize) {
        this.root = this.insertRec(this.root, point, pixelSize, 0);
    }

    insertRec(root, point, pixelSize, depth) {
        if (!root) {
            return new Node(point, pixelSize);
        }
		if (this.arePointsSame(root.point, point)) {
            if(root.pixelSize < pixelSize)
            {
                root.pixelSize = pixelSize;
            }
            // if(root.depth_distance > depth_distance)
            // {
            //     root.depth_distance = depth_distance;
            // }
            return root; // Don't insert duplicates
        }

        const cd = depth % k; // Current axis
        if (point[cd] < root.point[cd]) {
            root.left = this.insertRec(root.left, point, pixelSize, depth + 1);
        } else {
            root.right = this.insertRec(root.right, point, pixelSize, depth + 1);
        }
        return root;
    }

    add_bbox(point, bbox){
        return this.add_bboxRec(this.root, point, bbox, 0);
    }

    add_bboxRec(root, point, bbox, depth){
        if (!root) return;
        if (this.arePointsSame(root.point, point)){
            root.bbox = bbox;
            // console.log(`This ${root.point}'s bbox is ${root.bbox}`);
            return;
        } 
        const cd = depth % k;
        if (point[cd] < root.point[cd]) {
            return this.add_bboxRec(root.left, point, bbox, depth + 1);
        }
        return this.add_bboxRec(root.right, point, bbox, depth + 1);
    }

    traverse(node = this.root, callback = () => {}) {
        if (!node) return;
    
        callback(node); //passess current node's point to the callback 
        this.traverse(node.left, callback);
        this.traverse(node.right, callback);
    }

    // Searches for a point in the KD-Tree
    search(point) {
        return this.searchRec(this.root, point, 0);
    }
    searchRec(root, point, depth) {
        if (!root)
        {
            return null;
        } 
        if (this.arePointsSame(root.point, point)){
            return root;
        } 
        const cd = depth % k;
        if (point[cd] < root.point[cd]) {
            return this.searchRec(root.left, point, depth + 1);
        }
        return this.searchRec(root.right, point, depth + 1);
    }
    // Utility function to check if two points are the same
    arePointsSame(point1, point2) {
 
		// Compare individual coordinate values
		for (let i = 0; i < k; i++) {
		  if (point1[i] !== point2[i]) {
			  return false;
		}
	  }
	  return true;
	}
	findKNearestNeighbors(root, point, depth, bestNeighbors, n) {
        if (!root) return bestNeighbors;

        const dist = this.euclideanDistance(root.point, point);

        // Insert the point into the bestNeighbors array if it is among the k closest
        if (bestNeighbors.length < n) {
            bestNeighbors.push({ point: root.point, distance: dist, bbox: root.bbox });
            bestNeighbors.sort((a, b) => a.distance - b.distance); // Sort by distance
        } else if (dist < bestNeighbors[bestNeighbors.length - 1].distance) {
            bestNeighbors[bestNeighbors.length - 1] = { point: root.point, distance: dist, bbox: root.bbox };
            bestNeighbors.sort((a, b) => a.distance - b.distance); // Sort by distance
        }

        // Determine which subtree to explore
        const cd = depth % k;
        const nextBranch = point[cd] < root.point[cd] ? root.left : root.right;
        const otherBranch = point[cd] < root.point[cd] ? root.right : root.left;

        // Explore the next branch first
        bestNeighbors = this.findKNearestNeighbors(nextBranch, point, depth + 1, bestNeighbors, n);

        // Check if we need to explore the other branch
        const planeDistance = Math.abs(point[cd] - root.point[cd]);
        if (planeDistance < bestNeighbors[bestNeighbors.length - 1].distance) {
            bestNeighbors = this.findKNearestNeighbors(otherBranch, point, depth + 1, bestNeighbors, n);
        }

        return bestNeighbors;
    }

    // Public method to find the k nearest neighbors
    nearestNeighbors(point, n) {
        const bestNeighbors = this.findKNearestNeighbors(this.root, point, 0, [], n);
        return bestNeighbors;
        // return bestNeighbors.map(neighbor => neighbor.distance);
    }

    // Euclidean distance between two points
    euclideanDistance(point1, point2) {
        return Math.sqrt(point1.reduce((sum, val, idx) => sum + Math.pow(val - point2[idx], 2), 0));
    }
}

export { KDTree };