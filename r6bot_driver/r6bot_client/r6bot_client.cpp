// Copyright 2025 r6bot_driver Contributors
// SPDX-License-Identifier: Apache-2.0

#include "r6bot_driver/r6bot_client.hpp"

#include <thread>

namespace r6bot_driver
{

R6botClient::R6botClient(
  const std::string & robot_ip,
  uint16_t robot_port,
  uint16_t local_port)
: comm_(std::make_unique<RobotComm>(robot_ip, robot_port, local_port))
{
  command_buffer_.set(std::array<double, N_JOINTS>{});
  state_buffer_.initRT(RobotState{});
}

R6botClient::~R6botClient()
{
  disconnect();
}

bool R6botClient::connect()
{
  if (connected_) {
    return true;
  }

  connected_ = comm_->connect();
  return connected_;
}

void R6botClient::disconnect()
{
  stop_stream();
  if (connected_) {
    comm_->disconnect();
    connected_ = false;
  }
}

bool R6botClient::start_stream()
{
  if (stream_running_) {
    return true;
  }

  if (!connect()) {
    return false;
  }

  stream_running_ = true;
  stream_thread_ = std::thread(&R6botClient::stream_loop, this);
  return true;
}

void R6botClient::stop_stream()
{
  stream_running_ = false;
  if (stream_thread_.joinable()) {
    stream_thread_.join();
  }
}

void R6botClient::write_joints(const std::array<double, N_JOINTS> & positions)
{
  command_buffer_.try_set(positions);
}

RobotState R6botClient::read_joints()
{
  const RobotState * state = state_buffer_.readFromRT();
  return state != nullptr ? *state : RobotState{};
}

bool R6botClient::read_hardware_joints(RobotState & state)
{
  if (!connect()) {
    return false;
  }

  // The sim only sends state after it receives a command (it needs the
  // client address).  Send a probe command first so the reply arrives on
  // our socket, then retry a few times in case the first packet is lost.
  RobotCommand probe{};
  probe.pos = command_buffer_.get();

  for (int attempt = 0; attempt < 3; ++attempt) {
    comm_->sendCommand(probe);
    if (comm_->receiveState(state)) {
      state_buffer_.writeFromNonRT(state);
      command_buffer_.set(state.pos);
      return true;
    }
  }
  return false;
}

void R6botClient::stream_loop()
{
  while (stream_running_) {
    RobotCommand command;
    command.pos = command_buffer_.get();

    comm_->sendCommand(command);

    RobotState state;
    if (comm_->receiveState(state)) {
      state_buffer_.writeFromNonRT(state);
    }
  }
}

}  // namespace r6bot_driver
