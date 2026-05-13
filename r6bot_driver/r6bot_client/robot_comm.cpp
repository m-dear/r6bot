// Copyright 2025 r6bot_driver Contributors
// SPDX-License-Identifier: Apache-2.0

#include "r6bot_driver/robot_comm.hpp"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cstring>

namespace r6bot_driver
{

RobotComm::RobotComm(
  const std::string & robot_ip, uint16_t robot_port, uint16_t local_port)
: robot_ip_(robot_ip), robot_port_(robot_port), local_port_(local_port)
{}

RobotComm::~RobotComm()
{
  disconnect();
}

bool RobotComm::connect()
{
  sock_fd_ = ::socket(AF_INET, SOCK_DGRAM, 0);
  if (sock_fd_ < 0) {
    return false;
  }

  // Bind so the robot knows where to send its state replies
  sockaddr_in local{};
  local.sin_family      = AF_INET;
  local.sin_addr.s_addr = INADDR_ANY;
  local.sin_port        = htons(local_port_);

  if (::bind(sock_fd_, reinterpret_cast<sockaddr *>(&local), sizeof(local)) < 0) {
    ::close(sock_fd_);
    sock_fd_ = -1;
    return false;
  }

  // Short receive timeout so the comm thread can check comm_running_ regularly
  timeval tv{};
  tv.tv_sec  = 0;
  tv.tv_usec = 10000;  // 10 ms
  ::setsockopt(sock_fd_, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

  return true;
}

void RobotComm::disconnect()
{
  if (sock_fd_ >= 0) {
    ::close(sock_fd_);
    sock_fd_ = -1;
  }
}

bool RobotComm::sendCommand(const RobotCommand & cmd)
{
  if (sock_fd_ < 0) {
    return false;
  }

  sockaddr_in dest{};
  dest.sin_family = AF_INET;
  dest.sin_port   = htons(robot_port_);
  ::inet_pton(AF_INET, robot_ip_.c_str(), &dest.sin_addr);

  // Pack 6 joint positions into 48 bytes
  uint8_t buf[CMD_PACKET_BYTES];
  std::memcpy(buf, cmd.pos.data(), CMD_PACKET_BYTES);

  const ssize_t sent = ::sendto(
    sock_fd_, buf, CMD_PACKET_BYTES, 0,
    reinterpret_cast<const sockaddr *>(&dest), sizeof(dest));

  return sent == static_cast<ssize_t>(CMD_PACKET_BYTES);
}

bool RobotComm::receiveState(RobotState & state)
{
  if (sock_fd_ < 0) {
    return false;
  }

  uint8_t buf[STATE_PACKET_BYTES];
  sockaddr_in sender{};
  socklen_t   sender_len = sizeof(sender);

  // Blocking read — respects the SO_RCVTIMEO set in connect()
  const ssize_t received = ::recvfrom(
    sock_fd_, buf, STATE_PACKET_BYTES, 0,
    reinterpret_cast<sockaddr *>(&sender), &sender_len);

  if (received != static_cast<ssize_t>(STATE_PACKET_BYTES)) {
    return false;  // timeout or wrong size — keep last state
  }

  // Drain any additional packets that queued up while the stream thread was
  // busy.  The sim sends at its own rate so the OS buffer can accumulate
  // several packets between driver iterations.  Keep only the newest one so
  // read() always reports the freshest state.
  uint8_t tmp[STATE_PACKET_BYTES];
  while (true) {
    const ssize_t extra = ::recvfrom(
      sock_fd_, tmp, STATE_PACKET_BYTES, MSG_DONTWAIT,
      reinterpret_cast<sockaddr *>(&sender), &sender_len);
    if (extra != static_cast<ssize_t>(STATE_PACKET_BYTES)) {
      break;
    }
    std::memcpy(buf, tmp, STATE_PACKET_BYTES);
  }

  std::memcpy(state.pos.data(), buf, STATE_PACKET_BYTES);
  return true;
}

}  // namespace r6bot_driver
