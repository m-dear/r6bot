// Copyright 2025 r6bot_driver Contributors
// SPDX-License-Identifier: Apache-2.0

#ifndef R6BOT_DRIVER__ROBOT_COMM_HPP_
#define R6BOT_DRIVER__ROBOT_COMM_HPP_

// ──────────────────────────────────────────────────────────────────────────────
// RobotComm  —  Low-level communication with the robot controller
//
// Sends joint position commands and receives joint states over the network.
//
// PACKET FORMAT  (native-endian IEEE-754 doubles, no header):
//
//   PC → Robot   COMMAND   6 doubles = 48 bytes
//                          [ j1_pos … j6_pos ]
//
//   Robot → PC   STATE     6 doubles = 48 bytes
//                          [ j1_pos … j6_pos ]
//
// Use the Python simulator (sim/sim_robot_server.py) for testing without
// physical hardware.  Set robot_ip to "127.0.0.1" in the URDF to connect to it.
// ──────────────────────────────────────────────────────────────────────────────

#include <array>
#include <cstdint>
#include <string>

namespace r6bot_driver
{

constexpr std::size_t N_JOINTS = 6;

constexpr std::size_t CMD_PACKET_BYTES   = N_JOINTS * sizeof(double);       // 48
constexpr std::size_t STATE_PACKET_BYTES = N_JOINTS * sizeof(double);       // 48

/// Latest joint state received from the robot
struct RobotState
{
  std::array<double, N_JOINTS> pos{};  // positions  [rad]
};

/// Joint position command to send to the robot
struct RobotCommand
{
  std::array<double, N_JOINTS> pos{};  // desired positions [rad]
};

// ──────────────────────────────────────────────────────────────────────────────
class RobotComm
{
public:
  /// @param robot_ip   IP address of the robot / simulator  (e.g. "127.0.0.1")
  /// @param robot_port Port the robot listens on for commands (default 30000)
  /// @param local_port Port this PC binds to for state replies  (default 30001)
  RobotComm(const std::string & robot_ip, uint16_t robot_port, uint16_t local_port);
  ~RobotComm();

  RobotComm(const RobotComm &) = delete;
  RobotComm & operator=(const RobotComm &) = delete;

  /// Open socket and bind to local_port.  Returns true on success.
  bool connect();

  /// Close the socket (safe to call even if not connected).
  void disconnect();

  /// Send a 48-byte command packet.  Returns true if the packet was sent.
  bool sendCommand(const RobotCommand & cmd);

  /// Wait up to 10 ms for a 48-byte state packet.
  /// Returns true and fills `state` on success.
  /// Returns false on timeout — caller should keep the last known state.
  bool receiveState(RobotState & state);

private:
  std::string robot_ip_;
  uint16_t    robot_port_;
  uint16_t    local_port_;
  int         sock_fd_{-1};
};

}  // namespace r6bot_driver

#endif  // R6BOT_DRIVER__ROBOT_COMM_HPP_
