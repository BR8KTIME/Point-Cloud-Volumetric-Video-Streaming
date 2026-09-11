#include <pcl/point_cloud.h>
#include <pcl/octree/octree_search.h>
#include <pcl/io/ply_io.h> 
#include <pcl/common/common.h>

#include <iostream>
#include <vector>
#include <string>
#include <algorithm> // For std::sort

using namespace std;

// Custom comparator for sorting points
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

            // Distribute points into different LoD clouds
            for (size_t j = 0; j < points.size(); ++j)
            {
                // This complex mapping can be simplified, but keeping your original logic
                int target_level = -1;
                int remainder = j % sampling_ratio;
                // if (remainder == 0) target_level = 0;
                // else if (remainder == 1) target_level = 3;
                // else if (remainder == 2) target_level = 1;
                // else if (remainder == 3) target_level = 4;
                // else if (remainder == 4) target_level = 2;
                // else if (remainder == 5) target_level = 5;
                // else if (remainder == 6) target_level = 9;
                // else if (remainder == 7) target_level = 8;
                // else if (remainder == 8) target_level = 7;
                // else if (remainder == 9) target_level = 6;

                
                clouds[remainder]->points.push_back(points[j]);
                
            }
            count++;
        }
    }

    // Save the processed point clouds to output PLY files
    std::string output_dir = argv[2];
    for (int i = 0; i < sampling_ratio; ++i)
    {
        if (clouds[i]->points.empty()) continue; // Don't save empty clouds

        // --- CHANGE: Use .ply format for output ---
        string format = ".ply";
        string s = "level" + to_string(i);
        string path_out = output_dir + s + format;

        // Set cloud properties before saving
        clouds[i]->width = clouds[i]->points.size();
        clouds[i]->height = 1;
        clouds[i]->is_dense = true;

        // --- CHANGE: Use savePLYFileBinary ---
        pcl::io::savePLYFileBinary(path_out, *clouds[i]);
        cout << "Saved to: " << path_out << ", with points: " << clouds[i]->points.size() << endl;
    }

    return 0;
}