"""
move_demo.py
============
Sends two successive single-waypoint goals to
/joint_trajectory_controller/follow_joint_trajectory:

  Move 1 — current pose  →  TARGET_POSE   (big move, observe streaming)
  Move 2 — TARGET_POSE   →  ZERO_POSE

No intermediate waypoints are inserted.  The joint_trajectory_controller
interpolates internally at the controller_manager update rate (100 Hz),
so write() / read() stream continuously throughout the motion.

Usage:
  ros2 run joint_trajectory_cmd move_demo
"""

import time
from typing import List, Optional

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.duration import Duration

from builtin_interfaces.msg import Duration as DurationMsg
from control_msgs.action import FollowJointTrajectory
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

JOINT_NAMES = [
    'joint_1',
    'joint_2',
    'joint_3',
    'joint_4',
    'joint_5',
    'joint_6',
]

TARGET_POSE = [
    0.13731246925145968,
    0.8693642128053826,
    0.4859642739319313,
    -0.41652360900294016,
    0.003998051536084053,
    -0.118852090194233,
]

ZERO_POSE = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

# Duration for each motion segment (seconds).
# A large move needs enough time so the robot can actually reach the target
# within the trajectory_controller's goal_time tolerance.
MOVE_DURATION_SEC = 4.0


def _make_goal(positions: List[float], duration_sec: float) -> FollowJointTrajectory.Goal:
    point = JointTrajectoryPoint()
    point.positions = positions
    point.time_from_start = DurationMsg(
        sec=int(duration_sec),
        nanosec=int((duration_sec % 1) * 1e9),
    )

    traj = JointTrajectory()
    traj.joint_names = JOINT_NAMES
    traj.points = [point]

    goal = FollowJointTrajectory.Goal()
    goal.trajectory = traj
    return goal


class MoveDemoNode(Node):
    def __init__(self):
        super().__init__('move_demo')
        self._action_client = ActionClient(
            self,
            FollowJointTrajectory,
            '/joint_trajectory_controller/follow_joint_trajectory',
        )
        self._current_positions: Optional[List[float]] = None
        self._joint_state_sub = self.create_subscription(
            JointState,
            '/joint_states',
            self._joint_state_cb,
            10,
        )

    def _joint_state_cb(self, msg: JointState) -> None:
        name_to_pos = dict(zip(msg.name, msg.position))
        try:
            self._current_positions = [name_to_pos[n] for n in JOINT_NAMES]
        except KeyError:
            pass  # message does not yet contain all joints

    def get_current_pose(self, timeout_sec: float = 5.0) -> List[float]:
        self.get_logger().info('Waiting for /joint_states ...')
        deadline = self.get_clock().now() + Duration(seconds=timeout_sec)
        while self._current_positions is None:
            rclpy.spin_once(self, timeout_sec=0.1)
            if self.get_clock().now() > deadline:
                raise RuntimeError(
                    '/joint_states not received — is the driver running?\n'
                    '  Start it with: ros2 launch r6bot_driver r6bot.launch.py'
                )
        return list(self._current_positions)

    def send_goal_and_wait(self, label: str, positions: List[float]) -> bool:
        self.get_logger().info(
            '\n' + '=' * 60 + '\n'
            '  ' + label + '\n'
            '  Target: ' + str(['{:.4f}'.format(p) for p in positions]) + '\n'
            + '=' * 60
        )

        if not self._action_client.wait_for_server(timeout_sec=5.0):
            self.get_logger().error(
                'Action server not available — is joint_trajectory_controller active?'
            )
            return False

        goal = _make_goal(positions, MOVE_DURATION_SEC)
        send_future = self._action_client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, send_future, timeout_sec=10.0)

        if not send_future.done():
            self.get_logger().error(f'{label}: timed out waiting for goal response')
            return False

        goal_handle = send_future.result()
        if goal_handle is None or not goal_handle.accepted:
            self.get_logger().error(f'{label}: goal rejected by controller')
            return False

        self.get_logger().info(f'{label}: goal accepted — robot moving ...')

        result_future = goal_handle.get_result_async()

        # Spin manually so /joint_states callbacks fire.
        # Print joint positions at 1 Hz while waiting for the motion to finish.
        deadline = time.monotonic() + MOVE_DURATION_SEC + 10.0
        last_print = time.monotonic() - 1.0  # trigger an immediate first print

        while not result_future.done():
            rclpy.spin_once(self, timeout_sec=0.05)

            now = time.monotonic()
            if now - last_print >= 1.0:
                if self._current_positions is not None:
                    pos_str = '  '.join('{:+.4f}'.format(p) for p in self._current_positions)
                    self.get_logger().info(f'  joints: [{pos_str}]')
                last_print = now

            if now > deadline:
                self.get_logger().error(f'{label}: timed out waiting for result')
                return False

        result = result_future.result().result
        if result.error_code == FollowJointTrajectory.Result.SUCCESSFUL:
            self.get_logger().info(f'{label}: DONE')
            return True

        self.get_logger().error(
            f'{label}: failed  error_code={result.error_code}'
            f'  "{result.error_string}"'
        )
        return False


def main(args=None):
    rclpy.init(args=args)
    node = MoveDemoNode()

    try:
        # ── read current pose ──────────────────────────────────────────────
        current = node.get_current_pose()
        node.get_logger().info(
            f'\nCurrent pose: {[f"{p:.4f}" for p in current]}'
        )

        # ── Move 1: current → TARGET_POSE ─────────────────────────────────
        ok = node.send_goal_and_wait('Move 1  (current → target)', TARGET_POSE)
        if not ok:
            return

        # ── Move 2: TARGET_POSE → ZERO_POSE ───────────────────────────────
        node.send_goal_and_wait('Move 2  (target → zero)', ZERO_POSE)

    except RuntimeError as exc:
        node.get_logger().error(str(exc))
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
