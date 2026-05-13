cmake_minimum_required(VERSION 3.16)
project(r6bot_driver LANGUAGES CXX)

# CMake 3.30 removed the built-in FindBoost module (CMP0167).
# Upstream ROS 2 Jazzy packages (realtime_tools, hardware_interface) still
# rely on it, so we set the policy to OLD to keep the legacy behaviour.
if(POLICY CMP0167)
  cmake_policy(SET CMP0167 OLD)
endif()

# ── Compiler options ──────────────────────────────────────────────────────────
find_package(ros2_control_cmake REQUIRED)
set_compiler_options()
export_windows_symbols()

# ── Dependencies ──────────────────────────────────────────────────────────────
find_package(ament_cmake REQUIRED)
find_package(backward_ros REQUIRED)
find_package(hardware_interface REQUIRED)
find_package(pluginlib REQUIRED)
find_package(realtime_tools REQUIRED)

# Require ros2_control 4.x (Jazzy)
find_package(controller_manager 4.0.0 REQUIRED)

# ── Hardware interface library ────────────────────────────────────────────────
add_library(${PROJECT_NAME} SHARED
  r6bot_client/robot_comm.cpp
  r6bot_client/r6bot_client.cpp
  r6bot_hardware_interface/r6bot_hardware.cpp
)

target_compile_features(${PROJECT_NAME} PUBLIC cxx_std_17)

target_include_directories(${PROJECT_NAME} PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/r6bot_client/include>
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/r6bot_hardware_interface/include>
  $<INSTALL_INTERFACE:include/${PROJECT_NAME}>
)

target_link_libraries(${PROJECT_NAME} PUBLIC
  hardware_interface::hardware_interface
  pluginlib::pluginlib
  realtime_tools::realtime_tools
)

# Register the hardware plugin so controller_manager can find it by name
pluginlib_export_plugin_description_file(hardware_interface r6bot_driver.xml)

# ── Install ───────────────────────────────────────────────────────────────────
install(
  DIRECTORY
    r6bot_client/include/
    r6bot_hardware_interface/include/
  DESTINATION include/${PROJECT_NAME}
)

install(
  DIRECTORY ros2_control urdf config launch
  DESTINATION share/${PROJECT_NAME}
)

install(TARGETS ${PROJECT_NAME}
  EXPORT export_${PROJECT_NAME}
  ARCHIVE DESTINATION lib
  LIBRARY DESTINATION lib
  RUNTIME DESTINATION bin
)

# ── Export for downstream packages ───────────────────────────────────────────
ament_export_targets(export_${PROJECT_NAME} HAS_LIBRARY_TARGET)
ament_export_dependencies(hardware_interface pluginlib realtime_tools)

ament_package()
