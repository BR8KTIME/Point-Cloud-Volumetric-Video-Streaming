#include <pcl/point_cloud.h>
#include <pcl/octree/octree_search.h>
#include <pcl/io/pcd_io.h>
#include <pcl/common/common.h>

#include <iostream>
#include <vector>
#include <string>

using namespace std; 


bool compare(const pcl::PointXYZRGB& a, const pcl::PointXYZRGB& b)
{
    if(a.x == b.x)
    {
        if(a.y == b.y)
            return a.z < b.z;
        return a.y < b.y;
    }
    return a.x < b.x;
}

int main(int argc, char** argv)
{
    if(argc < 2){
        cerr << "Not enough arguments" << endl;
        return -1;
    }

    pcl::PointCloud<pcl::PointXYZRGB>::Ptr cloud(new pcl::PointCloud<pcl::PointXYZRGB>);

    if(pcl::io::loadPCDFile<pcl::PointXYZRGB>(argv[1], *cloud) == -1)
    {
        cerr << "Could not read the input PCD File" << endl;
        return -1;
    }

    int sampling_ratio = 10;

    cout << "Loaded " << cloud->width * cloud->height << endl;
    pcl::PointXYZRGB minPt, maxPt;
    pcl::getMinMax3D(*cloud, minPt, maxPt);
    // std::cout << "Min point: (" << minPt.x << ", " << minPt.y << ", " << minPt.z << ")" << std::endl;
    // std::cout << "Max point: (" << maxPt.x << ", " << maxPt.y << ", " << maxPt.z << ")" << std::endl;

    // Set the octree resolution to the voxel size of your point cloud
    float voxel_size = 128.0f; 

    // Create an octree object with the voxel size as the resolution
    pcl::octree::OctreePointCloudSearch<pcl::PointXYZRGB> octree(voxel_size);
    
    // Set input point cloud to the octree
    octree.setInputCloud(cloud);
    octree.addPointsFromInputCloud();
    
    // Vector to store the voxel centers
    pcl::octree::OctreePointCloud<pcl::PointXYZRGB>::AlignedPointTVector voxel_centers;

    // Get the centers of all occupied voxels
    octree.getOccupiedVoxelCenters(voxel_centers);

    // Iterate over each voxel center
    int count = 0;

    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD1(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD2(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD3(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD4(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD5(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD6(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD7(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD8(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD9(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr LOD10(new pcl::PointCloud<pcl::PointXYZRGB>);


    vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> clouds;
    clouds.push_back(LOD1);
    clouds.push_back(LOD2);
    clouds.push_back(LOD3);
    clouds.push_back(LOD4);
    clouds.push_back(LOD5);
    clouds.push_back(LOD6);
    clouds.push_back(LOD7);
    clouds.push_back(LOD8);
    clouds.push_back(LOD9);
    clouds.push_back(LOD10);
    
    for (const auto& voxel_center : voxel_centers)
    {
        // Search for the points within the voxel at this center
        vector<int> point_idx_vec;
        if (octree.voxelSearch(voxel_center, point_idx_vec))
        {
            // Print the voxel center and the number of points in this voxel
            cout << count << "th Voxel Center: (" << voxel_center.x << ", "
                      << voxel_center.y << ", " << voxel_center.z << ")"
                      << " contains " << point_idx_vec.size() << " points." << endl;
            
            vector<pcl::PointXYZRGB> points;
            for(int i = 0; i < point_idx_vec.size(); i++)
            {
                points.push_back(cloud->points[point_idx_vec[i]]);
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
    // 4. Save the processed point cloud to the output PLY file
    std::string output_file_path = argv[2];

    for(int i = 0;i < sampling_ratio; i++)
    {
        string s;
        // string output_file_path = "../../../../dataset/longdress/pcd/visual_importance/octree_LoD/without_normals/10_levels/";
        // string path = "/var/www/dataset/soldier/visual/10_levels/";

        string format = ".pcd";
        s = "LOD" + to_string(i);
        string path_out = output_file_path + s + format;
        clouds[i]->width = clouds[i]->points.size();
        clouds[i]->height = 1;
        clouds[i]->is_dense = true;
        pcl::io::savePCDFileBinary(path_out, *clouds[i]);
        cout << "Saved to: " << path_out << ", with points: " << clouds[i]->points.size() << endl;
    }
    return 0;
}
    