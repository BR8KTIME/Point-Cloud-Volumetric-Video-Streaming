cmake_minimum_required(VERSION 3.5 FATAL_ERROR)

project(visual)

find_package(PCL 1.2 REQUIRED)

include_directories(${PCL_makeINCLUDE_DIRS})
link_directories(${PCL_LIBRARY_DIRS})
add_definitions(${PCL_DEFINITIONS})

add_executable (exe ply_divideLevels.cpp)
target_link_libraries (exe ${PCL_LIBRARIES})