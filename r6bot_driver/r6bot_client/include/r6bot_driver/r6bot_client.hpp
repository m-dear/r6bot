// Copyright 2025 r6bot_driver Contributors
// SPDX-License-Identifier: Apache-2.0

#ifndef R6BOT_DRIVER__R6BOT_CLIENT_HPP_
#define R6BOT_DRIVER__R6BOT_CLIENT_HPP_

#include <array>
#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <thread>

#include "realtime_tools/realtime_buffer.hpp"
#include "realtime_tools/realtime_thread_safe_box.hpp"

#include "r6bot_driver/robot_comm.hpp"

namespace r6bot_driver
{

class R6botClient
{
public:
  R6botClient(
    const std::string & robot_ip,
    uint16_t robot_port,
    uint16_t local_port);
  ~R6botClient();

  R6botClient(const R6botClient &) = delete;
  R6botClient & operator=(const R6botClient &) = delete;

  bool connect();
  void disconnect();

  bool start_stream();
  void stop_stream();

  void write_joints(const std::array<double, N_JOINTS> & positions);
  RobotState read_joints();
  bool read_hardware_joints(RobotState & state);

private:
  void stream_loop();

  std::unique_ptr<RobotComm> comm_;

  realtime_tools::RealtimeThreadSafeBox<std::array<double, N_JOINTS>> command_buffer_;
  realtime_tools::RealtimeBuffer<RobotState> state_buffer_;

  std::thread stream_thread_;
  std::atomic<bool> stream_running_{false};
  std::atomic<bool> connected_{false};
};

}  // namespace r6bot_driver

#endif  // R6BOT_DRIVER__R6BOT_CLIENT_HPP_
