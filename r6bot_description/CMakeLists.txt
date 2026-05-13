cmake_minimum_required(VERSION 3.10)
project(r6bot_description)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY meshes srdf urdf rviz
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
