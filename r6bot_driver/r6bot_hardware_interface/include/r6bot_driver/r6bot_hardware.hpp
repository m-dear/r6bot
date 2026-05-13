// Copyright 2025 r6bot_driver Contributors
// SPDX-License-Identifier: Apache-2.0

#ifndef R6BOT_DRIVER__R6BOT_HARDWARE_HPP_
#define R6BOT_DRIVER__R6BOT_HARDWARE_HPP_

// ──────────────────────────────────────────────────────────────────────────────
// R6botHardware  —  ros2_control SystemInterface plugin for the R6Bot arm
//
// HOW IT WORKS  (see CLAUDE.md for the full explanation)
//
//   ros2_control runs a fast control loop (~500 Hz).
//   At each cycle it calls read() then write().
//
//   read()   copies robot state from a shared buffer → ros2_control
//   write()  copies controller commands → a shared buffer
//
//   R6botClient communicates with the robot in a separate background thread
//   without blocking the control loop:
//
//     ┌──────────────────────────────────────────────────────────────────────┐
//     │  ros2_control loop (500 Hz)                                          │
//     │    read()  ──── shared_pos ─────────────►  controllers see state      │
//     │    write() ◄─── shared_cmd         ────   controllers set commands   │
//     └─────────────────────────────┬────────────────────────────────────────┘
//                                   │  realtime buffers protect shared data
//     ┌─────────────────────────────▼────────────────────────────────────────┐
//     │  R6botClient stream thread                                           │
//     │    sendCommand() → robot        receiveState() ← robot               │
//     └──────────────────────────────────────────────────────────────────────┘
// ──────────────────────────────────────────────────────────────────────────────

#include <array>
#include <memory>
#include <string>

#include "hardware_interface/system_interface.hpp"
#include "hardware_interface/types/hardware_interface_return_values.hpp"
#include "hardware_interface/types/hardware_interface_type_values.hpp"
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_lifecycle/state.hpp"

#include "r6bot_driver/r6bot_client.hpp"

namespace r6bot_driver
{

using CallbackReturn = rclcpp_lifecycle::node_interfaces::LifecycleNodeInterface::CallbackReturn;
using return_type    = hardware_interface::return_type;

class R6botHardware : public hardware_interface::SystemInterface
{
public:
  // ── Lifecycle (controller_manager drives these) ───────────────────────────

  /// Read URDF <hardware><param> values (robot_ip and ports)
  CallbackReturn on_init(
    const hardware_interface::HardwareComponentInterfaceParams & params) override;

  /// Open the socket; zero-init all state/command buffers
  CallbackReturn on_configure(
    const rclcpp_lifecycle::State & previous_state) override;

  /// Start the background communication thread
  CallbackReturn on_activate(
    const rclcpp_lifecycle::State & previous_state) override;

  /// Stop the background communication thread
  CallbackReturn on_deactivate(
    const rclcpp_lifecycle::State & previous_state) override;

  /// Close the socket
  CallbackReturn on_cleanup(
    const rclcpp_lifecycle::State & previous_state) override;

  // ── Control loop (controller_manager drives these at ~500 Hz) ────────────

  /// Copy robot state from shared buffer → ros2_control state interfaces.
  /// Does NOT communicate with the robot.
  return_type read(const rclcpp::Time & time, const rclcpp::Duration & period) override;

  /// Copy ros2_control command interfaces → shared buffer for comm thread.
  /// Does NOT communicate with the robot.
  return_type write(const rclcpp::Time & time, const rclcpp::Duration & period) override;

private:
  // ── Communication ─────────────────────────────────────────────────────────
  std::unique_ptr<R6botClient> r6bot_client_;

  // ── Interface names cached outside the control loop ───────────────────────
  std::array<std::string, N_JOINTS> position_state_names_{};
  std::array<std::string, N_JOINTS> velocity_state_names_{};
  std::array<std::string, N_JOINTS> effort_state_names_{};
  std::array<std::string, N_JOINTS> position_command_names_{};

  // ── Parameters (from URDF <hardware> block) ───────────────────────────────
  std::string robot_ip_;
  uint16_t    robot_port_{30000};
  uint16_t    local_port_{30001};
};

}  // namespace r6bot_driver

#endif  // R6BOT_DRIVER__R6BOT_HARDWARE_HPP_
