# joint_trajectory_cmd

Demo tool for the R6Bot 6-DOF arm.

Sends two successive **single-waypoint** goals to
`/joint_trajectory_controller/follow_joint_trajectory` so you can observe the
continuous `read()` / `write()` streaming during a large joint motion.

No intermediate waypoints are in the goal.  The `joint_trajectory_controller`
interpolates at 100 Hz, so `write()` copies a new command every 10 ms
throughout the entire motion.

---

## What it does

```
1. Read current pose from /joint_states
2. Move 1 — current pose  →  TARGET_POSE   (4 s)
3. Move 2 — TARGET_POSE   →  zero pose     (4 s)
```

Target pose (hard-coded in `move_demo.py`):

| Joint   | Position (rad) |
|---------|----------------|
| joint_1 |  0.1373        |
| joint_2 |  0.8694        |
| joint_3 |  0.4860        |
| joint_4 | -0.4165        |
| joint_5 |  0.0040        |
| joint_6 | -0.1189        |

---

## Installation

The driver must be running.  Start the virtual robot and driver first:

```bash
# terminal 1 — virtual robot simulator
python3 ~/r6bot_ws/src/opensource-driver-6dof/virtual_r6bot.py

# terminal 2 — ROS2 driver
source install/setup.bash
ros2 launch r6bot_driver r6bot.launch.py
```

---

## Quick start

### Step 1 — Build

```bash
export R6BOT_WS=~/r6bot_ws
cd "$R6BOT_WS"
source /opt/ros/jazzy/setup.bash
colcon build --packages-select joint_trajectory_cmd
source install/setup.bash
```

---

### Step 2 — Run the demo  `[terminal 3]`

```bash
ros2 run joint_trajectory_cmd move_demo
```

Expected output:

```
[move_demo]: Waiting for /joint_states ...
[move_demo]: Current pose: ['0.0000', '0.0000', '0.0000', '0.0000', '0.0000', '0.0000']

============================================================
  Move 1  (current → target)
  Target: ['0.1373', '0.8694', '0.4860', '-0.4165', '0.0040', '-0.1189']
============================================================
[move_demo]: Move 1  (current → target): goal accepted, robot moving ...
[move_demo]: Move 1  (current → target): DONE

============================================================
  Move 2  (target → zero)
  Target: ['0.0000', '0.0000', '0.0000', '0.0000', '0.0000', '0.0000']
============================================================
[move_demo]: Move 2  (target → zero): goal accepted, robot moving ...
[move_demo]: Move 2  (target → zero): DONE
```

---

### Step 3 — Observe the streaming  `[terminal 4]`

While `move_demo` is running:

```bash
ros2 topic hz /joint_states            # ~50 Hz
ros2 topic echo /joint_states --field position
```

Positions change **smoothly and continuously** — not in jumps — because the
controller generates a dense interpolated stream from the single waypoint.

---

## Why single waypoint?

A single waypoint forces the controller to own all interpolation:

```
Goal sent once:
  t=0 s → current pose
  t=4 s → target pose   ← only this waypoint in the goal

Controller generates at 100 Hz:
  t=0.00 s → [0.000, 0.000, ...]
  t=0.01 s → [0.000, 0.002, ...]   ← write() copies this
  t=0.02 s → [0.000, 0.004, ...]   ← write() copies this
  ...
  t=4.00 s → [0.137, 0.869, ...]   ← write() copies this
```

This demonstrates that `write()` does not send to the robot directly —
the background stream thread does — and `read()` returns whatever state
the robot last reported, independent of the command rate.

---

## Changing the target pose or duration

Edit `joint_trajectory_cmd/move_demo.py`:

```python
TARGET_POSE = [
    0.13731246925145968,   # joint_1
    0.8693642128053826,    # joint_2
    0.4859642739319313,    # joint_3
    -0.41652360900294016,  # joint_4
    0.003998051536084053,  # joint_5
    -0.118852090194233,    # joint_6
]

MOVE_DURATION_SEC = 4.0   # seconds per segment
```

With `--symlink-install` active no rebuild is needed.

---

## Package structure

```
joint_trajectory_cmd/
├── package.xml
├── setup.py
├── setup.cfg
├── README.md
└── joint_trajectory_cmd/
    ├── __init__.py
    └── move_demo.py      — main executable
```
