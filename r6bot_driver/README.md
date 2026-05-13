# r6bot_driver

ros2_control hardware interface for the R6Bot 6-DOF arm.

Implements the **continuous streaming** pattern — the control loop never
blocks.  A background thread handles all UDP communication while `read()`
and `write()` only copy data through lock-free realtime buffers.

---

## Quick start (simulator)

> No physical robot needed.  Start `virtual_r6bot.py` as the simulator.

### Step 1 — Build

```bash
export R6BOT_WS=~/r6bot_ws
cd "$R6BOT_WS"
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
```

---

### Step 2 — Start the virtual robot  `[terminal 1]`

```bash
python3 ~/r6bot_ws/src/opensource-driver-6dof/virtual_r6bot.py
```

Expected output:
```
╔══════════════════════════════════════════════════════════╗
║       Virtual R6Bot  —  sim + WebSocket + UDP            ║
╠══════════════════════════════════════════════════════════╣
║  Web UI  →  ws://localhost:8765                          ║
║  ROS2    →  UDP 0.0.0.0:30000  (optional)                ║
╚══════════════════════════════════════════════════════════╝

[virtual_r6bot] WebSocket ready  ws://0.0.0.0:8765
[virtual_r6bot] UDP  listening on 0.0.0.0:30000  (ROS2 driver)
```

---

### Step 3 — Launch the driver  `[terminal 2]`

```bash
export R6BOT_WS=~/r6bot_ws
cd "$R6BOT_WS"
source install/setup.bash
ros2 launch r6bot_driver r6bot.launch.py
```

Expected output:
```
[R6botHardware]: Init — robot 127.0.0.1:30000  local_port 30001
[R6botHardware]: Socket open — ready to activate
[R6botHardware]: R6botClient stream started → robot 127.0.0.1:30000
[spawner_joint_state_broadcaster]: Configured and activated joint_state_broadcaster
[spawner_joint_trajectory_controller]: Configured and activated joint_trajectory_controller
```

> `Could not enable FIFO RT scheduling policy` is a warning, not an error —
> it appears on non-RT kernels and does not affect functionality.

---

### Step 4 — Verify joints  `[terminal 3]`

```bash
source install/setup.bash
ros2 topic echo /joint_states --once
ros2 topic hz /joint_states        # expect ~50 Hz
```

---

### Step 5 — Send a test trajectory  `[terminal 3]`

```bash
ros2 run joint_trajectory_cmd move_demo
```

Or directly via action:

```bash
ros2 action send_goal /joint_trajectory_controller/follow_joint_trajectory \
  control_msgs/action/FollowJointTrajectory \
  "{trajectory: {joint_names: [joint_1,joint_2,joint_3,joint_4,joint_5,joint_6], \
  points: [{positions: [0.5,0.5,0.5,0.5,0.5,0.5], time_from_start: {sec: 2}}]}}"
```

---

## Connect to a real robot

```bash
ros2 launch r6bot_driver r6bot.launch.py robot_ip:=192.168.1.100
```

Launch arguments:

| Argument | Default | Description |
|---|---|---|
| `robot_ip` | `127.0.0.1` | Robot IP (use `127.0.0.1` for `virtual_r6bot.py`) |
| `robot_port` | `30000` | UDP port the robot listens on |
| `local_port` | `30001` | UDP port on this PC for state replies |
| `rviz` | `true` | Launch RViz |

---

## Package structure

```
r6bot_driver/
├── r6bot_client/
│   ├── include/r6bot_driver/
│   │   ├── robot_comm.hpp       — UDP socket layer
│   │   └── r6bot_client.hpp     — streaming client API
│   ├── robot_comm.cpp           — sendCommand() / receiveState()
│   └── r6bot_client.cpp         — stream_loop(), lock-free buffers
├── r6bot_hardware_interface/
│   ├── include/r6bot_driver/
│   │   └── r6bot_hardware.hpp   — ros2_control plugin declaration
│   └── r6bot_hardware.cpp       — SystemInterface: on_init/configure/activate/read/write
├── ros2_control/
│   └── r6bot_hardware.ros2_control.xacro   — hardware block for URDF
├── urdf/
│   └── r6bot.urdf.xacro         — full robot description
├── config/
│   └── r6bot_controllers.yaml   — 100 Hz control loop + JTC config
└── launch/
    └── r6bot.launch.py          — one-command startup
```

---

## How it works

```
MoveIt  ──►  joint_trajectory_controller  ──►  ros2_control loop (100 Hz)
                                                     │
                                              write()  → command_buffer_
                                              read()   ← state_buffer_
                                                     │  (lock-free, never block)
                                           R6botClient::stream_loop()
                                           (background thread)
                                                     │
                                           sendCommand() ──► virtual_r6bot / robot
                                           receiveState() ◄── virtual_r6bot / robot
```

`write()` and `read()` **never** touch the socket.
All network I/O happens in the background stream thread.

---

## Communication protocol

```
PC → Robot   COMMAND   48 bytes   6 × double   [ j1 … j6 positions ]
Robot → PC   STATE     48 bytes   6 × double   [ j1 … j6 positions ]
```

`virtual_r6bot.py` implements the same binary protocol and replies
immediately on each received command — it is a drop-in replacement for
the physical robot controller.

---

## Plugin name

```xml
<plugin>r6bot_driver/R6botHardware</plugin>
```
