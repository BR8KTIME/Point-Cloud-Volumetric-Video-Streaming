#include <pcl/point_cloud.h>
#include <pcl/octree/octree_search.h>
#include <pcl/io/ply_io.h> // <--- CHANGE: Include PLY I/O header
#include <pcl/common/common.h>

#include <iostream>
#include <vector>
#include <string>
#include <algorithm> // For std::sort

using namespace std;

// Custom comparator for sorting points (unchanged)
bool compare(const pcl::PointXYZRGB& a, const pcl::PointXYZRGB& b)
{
    if (a.x == b.x)
    {
        if (a.y == b.y)
            return a.z < b.z;
        return a.y < b.y;
    }
    return a.x < b.x;
}

int main(int argc, char** argv)
{
    if (argc < 3) {
        cerr << "Usage: " << argv[0] << " <input_file.ply> <output_directory_path>" << endl;
        return -1;
    }

    pcl::PointCloud<pcl::PointXYZRGB>::Ptr cloud(new pcl::PointCloud<pcl::PointXYZRGB>);

    // --- CHANGE: Use loadPLYFile instead of loadPCDFile ---
    if (pcl::io::loadPLYFile<pcl::PointXYZRGB>(argv[1], *cloud) == -1)
    {
        cerr << "Could not read the input PLY File: " << argv[1] << endl;
        return -1;
    }

    int sampling_ratio = 15;

    cout << "Loaded " << cloud->width * cloud->height << " points from " << argv[1] << endl;

    // Set the octree resolution
    float voxel_size = 128.0f;

    // Create and configure the octree
    pcl::octree::OctreePointCloudSearch<pcl::PointXYZRGB> octree(voxel_size);
    octree.setInputCloud(cloud);
    octree.addPointsFromInputCloud();

    // Vector to store the voxel centers
    pcl::octree::OctreePointCloud<pcl::PointXYZRGB>::AlignedPointTVector voxel_centers;
    octree.getOccupiedVoxelCenters(voxel_centers);

    // Initialize point clouds for each level of detail
    vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> clouds(sampling_ratio);
    for(int i = 0; i < sampling_ratio; ++i) {
        clouds[i].reset(new pcl::PointCloud<pcl::PointXYZRGB>);
    }

    int count = 0;
    for (const auto& voxel_center : voxel_centers)
    {
        vector<int> point_idx_vec;
        if (octree.voxelSearch(voxel_center, point_idx_vec))
        {
            cout << count << "th Voxel Center: (" << voxel_center.x << ", "
                 << voxel_center.y << ", " << voxel_center.z << ")"
                 << " contains " << point_idx_vec.size() << " points." << endl;

            // Collect points within the voxel
            vector<pcl::PointXYZRGB> points;
            points.reserve(point_idx_vec.size()); // Pre-allocate memory
            for (int idx : point_idx_vec)
            {
                points.push_back(cloud->points[idx]);
            }
            sort(points.begin(), points.end(), compare);

            for (int j = 0; j < points.size(); j++)
            {
                // Determine the base "importance" level of this point.
                // The points with the lowest modulo are the most important.
                // We will use a simple, sequential mapping for clarity.
                int point_level = j % sampling_ratio;

                // A point belongs in its own level and all subsequent, higher-detail levels.
                // For example, a point at level 0 (point_level=0) gets added to clouds 0 through 9.
                // A point at level 1 (point_level=1) gets added to clouds 1 through 9.
                for (int k = point_level; k < sampling_ratio; k++)
                {
                    clouds[k]->points.push_back(points[j]);
                }
            }
            count += 1;
        }
    }

    // Save the processed point clouds to output PLY files
    std::string output_dir = argv[2];
    for (int i = 0; i < sampling_ratio; ++i)
    {
        if (clouds[i]->points.empty()) continue; // Don't save empty clouds

        // --- CHANGE: Use .ply format for output ---
        string format = ".ply";
        string s = "LOD" + to_string(i);
        string path_out = output_dir + s + format;

        // Set cloud properties before saving
        clouds[i]->width = clouds[i]->points.size();
        clouds[i]->height = 1;
        clouds[i]->is_dense = true;

        // --- CHANGE: Use savePLYFileBinary ---
        pcl::io::savePLYFileBinary(path_out, *clouds[i]);
        cout << "Saved to: " << path_out << ", with points: " << clouds[i]->points.size() << endl;
    }1;

    return 0;
}