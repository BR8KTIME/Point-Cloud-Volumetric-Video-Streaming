#include <pcl/point_cloud.h>
#include <pcl/octree/octree_search.h>
#include <pcl/io/ply_io.h>
#include <pcl/common/common.h>

#include <iostream>
#include <vector>
#include <string>
#include <algorithm> // For std::sort
#include <cmath>     // For std::ceil

using namespace std;

// Custom comparator for sorting points based on spatial coordinates.
// This ensures a consistent order for subsampling within each voxel.
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

vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> generateLODs(
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr inputCloud,
    int samplingRatio,
    bool useCustomSamplingLogic)
{
    float voxel_size = 128.0f;
    pcl::octree::OctreePointCloudSearch<pcl::PointXYZRGB> octree(voxel_size);
    octree.setInputCloud(inputCloud);
    octree.addPointsFromInputCloud();

    vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> lodClouds(samplingRatio);
    for(int i = 0; i < samplingRatio; ++i) {
        lodClouds[i].reset(new pcl::PointCloud<pcl::PointXYZRGB>);
    }

    pcl::octree::OctreePointCloud<pcl::PointXYZRGB>::AlignedPointTVector voxel_centers;
    octree.getOccupiedVoxelCenters(voxel_centers);

    for (const auto& voxel_center : voxel_centers)
    {
        vector<int> point_idx_vec;
        if (octree.voxelSearch(voxel_center, point_idx_vec))
        {
            vector<pcl::PointXYZRGB> points;
            points.reserve(point_idx_vec.size());
            for (int idx : point_idx_vec)
            {
                points.push_back(inputCloud->points[idx]);
            }
            sort(points.begin(), points.end(), compare);

            // Counter for distributing non-base points in the custom logic
            int nonBasePointIdx = 0;

            for (int pointIdx = 0; pointIdx < points.size(); pointIdx++)
            {
                int point_level;

                if (!useCustomSamplingLogic)
                {
                    // PASS 1 LOGIC: Standard uniform distribution.
                    point_level = pointIdx % samplingRatio;
                }
                else
                {
                    // --- MODIFIED PASS 2 LOGIC ---
                    // The goal is to get 20% (2/10) of points in the base layer.
                    // To do this uniformly, we select every 5th point for level 0.
                    const int base_level_interval = 5; // 1 out of 5 points = 20%
                    int remaining_levels = samplingRatio - 1; // 9 levels for other points

                    if (pointIdx % base_level_interval == 0)
                    {
                        // This point is uniformly sampled for the base layer.
                        point_level = 0;
                    }
                    else
                    {
                        // This point belongs to one of the other 9 levels.
                        // We use a counter to distribute these points evenly.
                        point_level = 1 + (nonBasePointIdx % remaining_levels);
                        nonBasePointIdx++;
                    }
                }

                // Add the point to its own level and all subsequent, higher-detail levels.
                // This single loop now correctly handles both logic cases.
                for (int k = point_level; k < samplingRatio; k++)
                {
                    lodClouds[k]->points.push_back(points[pointIdx]);
                }
            }
        }
    }

    if(useCustomSamplingLogic)
    {
        for (int i = 0; i < lodClouds.size(); i++)
        {
            if (lodClouds[i]->points.empty()) continue; // Skip empty clouds
            cout << "Created LOD " << i << ", with points: " << lodClouds[i]->points.size() << endl;
        }
    }

    return lodClouds;
}

/**
 * @brief Saves a vector of LOD point clouds to PLY files.
 *
 * @param lodClouds The vector of point clouds to save.
 * @param outputDir The directory where files will be saved.
 * @param filePrefix A prefix for the output filenames (e.g., "LOD_Pass1_").
 */
void saveLODs(
    const vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr>& lodClouds,
    const std::string& outputDir)
{
    cout << endl;
    for (int i = 0; i < lodClouds.size(); ++i)
    {
        if (lodClouds[i]->points.empty()) continue; // Skip empty clouds

        string path_out = outputDir + "LOD" + to_string(i) + ".ply";

        // Set cloud properties before saving
        lodClouds[i]->width = lodClouds[i]->points.size();
        lodClouds[i]->height = 1;
        lodClouds[i]->is_dense = true;

        pcl::io::savePLYFileBinary(path_out, *lodClouds[i]);
        cout << "Saved to: " << path_out << ", with points: " << lodClouds[i]->points.size() << endl;
    }
}


int main(int argc, char** argv)
{
    if (argc < 3) {
        cerr << "Usage: " << argv[0] << " <input_file.ply> <output_directory_path>" << endl;
        return -1;
    }

    pcl::PointCloud<pcl::PointXYZRGB>::Ptr cloud(new pcl::PointCloud<pcl::PointXYZRGB>);

    if (pcl::io::loadPLYFile<pcl::PointXYZRGB>(argv[1], *cloud) == -1)
    {
        cerr << "Could not read the input PLY File: " << argv[1] << endl;
        return -1;
    }

    cout << "Loaded " << cloud->width * cloud->height << " points from " << argv[1] << endl;
    std::string output_dir = argv[2];

    cout << "\n--- Creating the Old LOD First (Standard 1/10 distribution) ---" << endl;
    const int samplingRatio = 10;
    vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> originalLOD = generateLODs(cloud, samplingRatio, false);

    //For frame rate 10: Set LOD 9 as the highest LOD, set the lowest LOD as 25%.
    //For frame rate 15: Set LOD 7 as the highest LOD, set the lowest LOD as 20%.
    //For frame rate 30: Set LOD 4 as the highest LOD, set the lowest LOD as 20%.

    int newLODIndex = 7;
    if (originalLOD.size() <= newLODIndex || originalLOD[newLODIndex]->points.empty()) {
        cerr << "Error: LOD" << newLODIndex << " from the first pass is empty or does not exist. Cannot proceed to Pass 2." << endl;
        return -1;
    }

    pcl::PointCloud<pcl::PointXYZRGB>::Ptr newPointCloud = originalLOD[newLODIndex];
    cout << "\n--- Now creating the new LOD with " << newPointCloud->points.size() << " points ---" << endl;

    const int newSamplingRatio = 10;
    vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> newLOD = generateLODs(newPointCloud, newSamplingRatio, true);
    saveLODs(newLOD, output_dir);

    cout << "\nProcessing complete." << endl;

    return 0;
}