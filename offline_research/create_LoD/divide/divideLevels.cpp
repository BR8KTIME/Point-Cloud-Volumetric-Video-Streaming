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

    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_0(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_1(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_2(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_3(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_4(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_5(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_6(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_7(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_8(new pcl::PointCloud<pcl::PointXYZRGB>);
    pcl::PointCloud<pcl::PointXYZRGB>::Ptr level_9(new pcl::PointCloud<pcl::PointXYZRGB>);


    vector<pcl::PointCloud<pcl::PointXYZRGB>::Ptr> clouds;
    clouds.push_back(level_0);
    clouds.push_back(level_1);
    clouds.push_back(level_2);
    clouds.push_back(level_3);
    clouds.push_back(level_4);
    clouds.push_back(level_5);
    clouds.push_back(level_6);
    clouds.push_back(level_7);
    clouds.push_back(level_8);
    clouds.push_back(level_9);
    
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
            
            // if(count == 0)
            // {
            //     for(const auto & point : points)
            //     {
            //         cout << "Point: (" << point.x << ", " << point.y << ", " << point.z << ")"
            //               << " with color (" << static_cast<int>(point.r) << ", "
            //               << static_cast<int>(point.g) << ", "
            //               << static_cast<int>(point.b) << ")" << endl;
            //     }
            // }
            for(int j = 0; j < points.size(); j++)
            {
                if(j % sampling_ratio == 0)
                    level_0->points.push_back(points[j]);
                else if(j % sampling_ratio == 1)
                    level_3->points.push_back(points[j]);
                else if(j % sampling_ratio == 2)
                    level_1->points.push_back(points[j]);
                else if(j % sampling_ratio == 3)
                    level_4->points.push_back(points[j]);
                else if(j % sampling_ratio == 4)
                    level_2->points.push_back(points[j]);
                else if(j % sampling_ratio == 5)
                    level_5->points.push_back(points[j]);
                else if(j % sampling_ratio == 6)
                    level_9->points.push_back(points[j]);
                else if(j % sampling_ratio == 7)
                    level_8->points.push_back(points[j]);
                else if(j % sampling_ratio == 8)
                    level_7->points.push_back(points[j]);
                else if(j % sampling_ratio == 9)
                    level_6->points.push_back(points[j]);
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
        s = "level" + to_string(i);
        string path_out = output_file_path + s + format;
        clouds[i]->width = clouds[i]->points.size();
        clouds[i]->height = 1;
        clouds[i]->is_dense = true;
        pcl::io::savePCDFileBinary(path_out, *clouds[i]);
        cout << "Saved to: " << path_out << ", with points: " << clouds[i]->points.size() << endl;
    }
    return 0;
}
    