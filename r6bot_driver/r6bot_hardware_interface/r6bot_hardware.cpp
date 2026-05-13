// Copyright 2025 r6bot_driver Contributors
// SPDX-License-Identifier: Apache-2.0

#include "r6bot_driver/r6bot_hardware.hpp"

#include <stdexcept>

#include "pluginlib/class_list_macros.hpp"

namespace r6bot_driver
{

// ─────────────────────────────────────────────────────────────────────────────
// on_init  —  Called once when ros2_control loads this plugin.
//
// Reads the <param> values from the URDF <hardware> block:
//
//   <hardware>
//     <plugin>r6bot_driver/R6botHardware</plugin>
//     <param name="robot_ip">127.0.0.1</param>   ← simulator or real robot IP
//     <param name="robot_port">30000</param>
//     <param name="local_port">30001</param>
//   </hardware>
// ─────────────────────────────────────────────────────────────────────────────
CallbackReturn R6botHardware::on_init(
  const hardware_interface::HardwareComponentInterfaceParams & params)
{
  // Parent validates the joint list and populates info_ (joint names, params…)
  if (
    hardware_interface::SystemInterface::on_init(params) !=
    CallbackReturn::SUCCESS)
  {
    return CallbackReturn::ERROR;
  }

  try {
    robot_ip_     = info_.hardware_parameters.at("robot_ip");
    robot_port_   = static_cast<uint16_t>(
      std::stoul(info_.hardware_parameters.at("robot_port")));
    local_port_   = static_cast<uint16_t>(
      std::stoul(info_.hardware_parameters.at("local_port")));
  } catch (const std::out_of_range & e) {
    RCLCPP_FATAL(
      rclcpp::get_logger("R6botHardware"),
      "Missing URDF <param>: %s", e.what());
    return CallbackReturn::ERROR;
  }

  RCLCPP_INFO(
    rclcpp::get_logger("R6botHardware"),
    "Init — robot %s:%u  local_port %u",
    robot_ip_.c_str(), robot_port_, local_port_);

  for (std::size_t i = 0; i < info_.joints.size(); ++i) {
    const auto & joint_name = info_.joints[i].name;
    position_state_names_[i] = joint_name + "/" + hardware_interface::HW_IF_POSITION;
    velocity_state_names_[i] = joint_name + "/" + hardware_interface::HW_IF_VELOCITY;
    effort_state_names_[i] = joint_name + "/" + hardware_interface::HW_IF_EFFORT;
    position_command_names_[i] = joint_name + "/" + hardware_interface::HW_IF_POSITION;
  }

  return CallbackReturn::SUCCESS;
}

// ─────────────────────────────────────────────────────────────────────────────
// on_configure  —  Create the low-level client and initialize interfaces.
//
// Called when the controller_manager transitions to "configured".
// The R6botClient stream is NOT started here — it starts in on_activate().
// ─────────────────────────────────────────────────────────────────────────────
CallbackReturn R6botHardware::on_configure(
  const rclcpp_lifecycle::State & /*previous_state*/)
{
  r6bot_client_ = std::make_unique<R6botClient>(
    robot_ip_, robot_port_, local_port_);

  if (!r6bot_client_->connect()) {
    RCLCPP_ERROR(
      rclcpp::get_logger("R6botHardware"),
      "Cannot bind socket to local port %u", local_port_);
    return CallbackReturn::ERROR;
  }

  RobotState initial_state;
  if (r6bot_client_->read_hardware_joints(initial_state)) {
    r6bot_client_->write_joints(initial_state.pos);

    for (std::size_t i = 0; i < info_.joints.size(); ++i) {
      set_state(position_state_names_[i], initial_state.pos[i]);
      set_state(velocity_state_names_[i], 0.0);
      set_state(effort_state_names_[i], 0.0);
      set_command(position_command_names_[i], initial_state.pos[i]);
    }

    RCLCPP_INFO(rclcpp::get_logger("R6botHardware"), "Configured from current robot pose");
  } else {
    for (const auto & [name, descr] : joint_state_interfaces_) {
      set_state(name, 0.0);
    }
    for (const auto & [name, descr] : joint_command_interfaces_) {
      set_command(name, 0.0);
    }
    RCLCPP_WARN(
      rclcpp::get_logger("R6botHardware"),
      "Could not read current robot pose during configure; interfaces zeroed");
  }

  RCLCPP_INFO(rclcpp::get_logger("R6botHardware"), "Socket open — ready to activate");
  return CallbackReturn::SUCCESS;
}

// ─────────────────────────────────────────────────────────────────────────────
// on_activate  —  Start the low-level communication stream.
//
// From this moment the driver streams commands to the robot and receives state.
// The control loop (read/write) exchanges data through R6botClient.
// ─────────────────────────────────────────────────────────────────────────────
CallbackReturn R6botHardware::on_activate(
  const rclcpp_lifecycle::State & /*previous_state*/)
{
  if (!r6bot_client_) {
    RCLCPP_ERROR(rclcpp::get_logger("R6botHardware"), "R6botClient is not configured");
    return CallbackReturn::ERROR;
  }

  if (!r6bot_client_->start_stream()) {
    RCLCPP_ERROR(rclcpp::get_logger("R6botHardware"), "Cannot start R6botClient stream");
    return CallbackReturn::ERROR;
  }

  RCLCPP_INFO(
    rclcpp::get_logger("R6botHardware"),
    "R6botClient stream started → robot %s:%u",
    robot_ip_.c_str(), robot_port_);

  return CallbackReturn::SUCCESS;
}

// ─────────────────────────────────────────────────────────────────────────────
// on_deactivate  —  Stop the low-level communication stream.
// ─────────────────────────────────────────────────────────────────────────────
CallbackReturn R6botHardware::on_deactivate(
  const rclcpp_lifecycle::State & /*previous_state*/)
{
  if (r6bot_client_) {
    r6bot_client_->stop_stream();
  }

  RCLCPP_INFO(rclcpp::get_logger("R6botHardware"), "R6botClient stream stopped");
  return CallbackReturn::SUCCESS;
}

// ─────────────────────────────────────────────────────────────────────────────
// on_cleanup  —  Close the socket.
// ─────────────────────────────────────────────────────────────────────────────
CallbackReturn R6botHardware::on_cleanup(
  const rclcpp_lifecycle::State & /*previous_state*/)
{
  if (r6bot_client_) {
    r6bot_client_->disconnect();
    r6bot_client_.reset();
  }
  return CallbackReturn::SUCCESS;
}

// ─────────────────────────────────────────────────────────────────────────────
// read  —  Called every control cycle (~500 Hz).
//
// Copies the latest robot state from R6botClient into ros2_control's
// state interfaces so controllers can observe joint positions.
//
// Does NOT talk to the robot — that is R6botClient's stream thread.
//
// Note: the stream thread updates state whenever hardware feedback arrives.
// read() may return the same position between comm updates.
// This is expected and harmless — the controllers handle it gracefully.
// ─────────────────────────────────────────────────────────────────────────────
return_type R6botHardware::read(
  const rclcpp::Time & /*time*/, const rclcpp::Duration & /*period*/)
{
  if (!r6bot_client_) {
    return return_type::ERROR;
  }

  const RobotState state = r6bot_client_->read_joints();

  // Push into ros2_control state interfaces
  for (std::size_t i = 0; i < info_.joints.size(); ++i) {
    set_state(position_state_names_[i], state.pos[i]);
    set_state(velocity_state_names_[i], 0.0);
    set_state(effort_state_names_[i],   0.0);
  }

  return return_type::OK;
}

// ─────────────────────────────────────────────────────────────────────────────
// write  —  Called every control cycle (~500 Hz).
//
// Copies joint position commands from ros2_control's command interfaces into
// R6botClient for the stream thread to forward to the robot.
//
// Does NOT send to the robot — that is R6botClient's stream thread.
//
// The joint_trajectory_controller writes a freshly interpolated position every
// control cycle. R6botClient picks up the latest available value each stream pass.
// ─────────────────────────────────────────────────────────────────────────────
return_type R6botHardware::write(
  const rclcpp::Time & /*time*/, const rclcpp::Duration & /*period*/)
{
  std::array<double, N_JOINTS> cmd;
  for (std::size_t i = 0; i < info_.joints.size(); ++i) {
    cmd[i] = get_command(position_command_names_[i]);
  }

  if (!r6bot_client_) {
    return return_type::ERROR;
  }

  r6bot_client_->write_joints(cmd);

  return return_type::OK;
}

}  // namespace r6bot_driver

// Register with pluginlib so controller_manager can discover this plugin
PLUGINLIB_EXPORT_CLASS(
  r6bot_driver::R6botHardware,
  hardware_interface::SystemInterface)
