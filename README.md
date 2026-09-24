<a id="readme-top"></a>

# Point-Cloud-Volumetric-Video-Streaming

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![C++17](https://img.shields.io/badge/C%2B%2B-17-00599C?logo=c%2B%2B)](https://en.cppreference.com/w/cpp/17)
[![PCL](https://img.shields.io/badge/PCL-Point%20Cloud%20Library-green)](https://pointclouds.org/)
[![Google Draco](https://img.shields.io/badge/Draco-Mesh%20Compression-blue)](https://google.github.io/draco/)
[![Three.js](https://img.shields.io/badge/Three.js-black?logo=threedotjs)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-GLSL%20Shaders-990000?logo=webgl)](https://www.khronos.org/webgl/)
[![MPEG-DASH](https://img.shields.io/badge/Streaming-MPEG--DASH-orange)](https://dashif.org/)

> **Adaptive 6-DoF Volumetric Video Streaming Engine with 2D Depth-Interpolated Hole Concealment.**

<!-- ABOUT THE PROJECT -->
## About The Project
Volumetric Video, also known as the next generation media, allows users to experience 6-Degrees of Freedom (DoF), thereby providing a true immersive experience compared to the traditional 2D videos. The downside of these videos is the large data size which is highly unlikely to be supported by the current network infrastructure. In order to overcome this, we propose this system to enhance the user's Quality of Experience (QoE) under the given network. 
### Key Ideas
Here are key ideas of this project: 
* Subdivides the single point cloud frame into numerous Level of Details (LoDs) such that it can be streamed under constrained network.
* Provides optimal point size for each LoD considering the trade-off between the holes and the overlap areas. The calculation is done in the offline phase and provided in the metafile to the client.
* Adopts 2D interpolation technique at the client side to detect occuring holes and conceal them to enhance the final visual quality.
* **Spatial-Temporal Adaptive DASH Streaming & Buffer-Aware Scheduling**: Dynamically selects optimal spatial LoD (voxel density) and temporal LoD (frame rate) via an objective function. Utilizes a Group of Frames (GOF) buffer queue and margin-based adaptation to eliminate video playback stalls (rebuffering) under fluctuating network bandwidth.

### Repository Structure
* **`src/`**: Real-time adaptive volumetric video streaming web client powered by MPEG-DASH, Three.js, and custom WebGL shaders (`stream.js`).
* **`offline_research/create_LoD/`**: C++ PCL Octree-based voxelization and Draco compression pipeline for generating multi-level LoD point cloud sequences.

### System Architecture
<img src="src/images/architecture.png" alt="Architecture" height="90%" width="90%">

### Results
<img src="src/images/example.png" alt="example" height="50%" width="50%">
<br/>

*Visual quality comparison: (Left) Baseline point cloud rendering with noticeable hole artifacts due to LoD reduction vs. (Right) Proposed 2D depth interpolation with adaptive point size optimization, effectively concealing surface discontinuities.*

### Built With

| Category | Technologies & Tools |
| :--- | :--- |
| **Core Languages** | C++17, JavaScript (ES6+), GLSL (Custom Shaders), Python 3 |
| **3D & Graphics** | Point Cloud Library (PCL), Google Draco 3D Compression, Three.js |
| **Rendering & Shaders** | WebGL (Custom Vertex & Fragment Shaders, Alpha-Channel Depth Encoding) |
| **Media & Delivery** | MPEG-DASH (Dynamic Adaptive Streaming over HTTP), MPD Manifest Parser |
| **Build & Tooling** | Node.js, Vite, npm, CMake (for C++ PCL pipeline) |

<!-- GETTING STARTED -->
## Getting Started

Here are steps to set up and run the streaming client.

### Prerequisites

* **Node.js** (v18+ recommended)
* **npm** (comes with Node.js)

### Installation

1. Clone this repository to your local machine.
2. Install the required client dependencies:
   ```bash
   npm install
   ```

### Dataset Structure & LoD Generation

The streaming client requests Draco-compressed point cloud frames (`.drc`) structured according to `src/metafile.mpd`:

```text
<dataset_root>/
└── longdress/                       # period.id specified in metafile.mpd
    └── sequence/
        ├── frame0000/
        │   ├── LOD0.drc             # Base quality (lowest bandwidth, larger point size)
        │   ├── LOD1.drc
        │   └── ...
        │   └── LOD14.drc            # Highest quality (highest bandwidth, fine point size)
        ├── frame0001/
        └── ...
```

To generate this LoD dataset from raw `.ply` sequences, use the pipeline in `offline_research/create_LoD/`:
1. **Octree LoD Division (`divide/`)**:
   ```bash
   cd offline_research/create_LoD/divide
   mkdir -p build && cd build && cmake .. && make && cd ..
   ./divide.sh <input_ply_directory> <output_lod_directory>
   ```
2. **Draco Compression (`changeFormat/`)**:
   ```bash
   cd ../changeFormat
   ./ply2dracov2.sh <output_lod_directory> <target_dataset_path>
   ```

> Set your media server URL in `src/stream.js`:
> ```javascript
> const baseUrl = 'http://localhost:8080/dataset/' + period.id + '/';
> ```

### Running the Project

1. To start the streaming system: 
    ```bash
    npm run dev
    ```
2. Open your web browser to see the system running.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Hasung Cho - lifeofcho23@gmail.com
<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[Node.js]:https://img.shields.io/badge/node.js-000000?style=for-the-badge&logo=nodedotjs 
[Three.js]: https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=threedotjs
[WebGL]: https://img.shields.io/badge/WebGL-black?style=for-the-badge&logo=webgl
[exampleImage]: src/images/example.png
[architectureImage]: src/images/architecture.png

