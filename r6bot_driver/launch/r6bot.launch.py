# Copyright 2025 r6bot_driver Contributors
# SPDX-License-Identifier: Apache-2.0

"""
r6bot.launch.py
════════════════
Launches the full R6Bot driver stack:

  1. ros2_control_node      — loads the hardware plugin and runs the control loop
  2. robot_state_publisher  — broadcasts TF from /joint_states
  3. joint_state_broadcaster spawner   — starts publishing /joint_states
  4. joint_trajectory_controller spawner — accepts MoveIt trajectory goals
  5. rviz2                  — visualizes the robot_description and TF

USAGE
  # Connect to the bridge simulator (start virtual_r6bot.py first)
  ros2 launch r6bot_driver r6bot.launch.py

  # Connect to a real robot
  ros2 launch r6bot_driver r6bot.launch.py robot_ip:=192.168.1.100
"""

from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    RegisterEventHandler,
)
from launch.conditions import IfCondition
from launch.event_handlers import OnProcessExit
from launch.substitutions import (
    Command,
    FindExecutable,
    LaunchConfiguration,
    PathJoinSubstitution,
)
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():

    # ── Arguments ─────────────────────────────────────────────────────────
    args = [
        DeclareLaunchArgument(
            "robot_ip",
            default_value="127.0.0.1",
            description="IP address of the robot controller (or '127.0.0.1' for the simulator)",
        ),
        DeclareLaunchArgument(
            "robot_port",
            default_value="30000",
            description="Port the robot listens on for joint commands",
        ),
        DeclareLaunchArgument(
            "local_port",
            default_value="30001",
            description="Port on this PC that receives state replies from the robot",
        ),
        DeclareLaunchArgument(
            "rviz",
            default_value="true",
            description="Start RViz for robot visualization",
        ),
    ]

    # ── Generate URDF from xacro ──────────────────────────────────────────
    # xacro substitutes $(arg robot_ip) etc. into the URDF before ros2_control
    # reads it, so the hardware plugin receives the correct IP at startup.
    pkg_share = FindPackageShare("r6bot_driver")
    description_share = FindPackageShare("r6bot_description")

    robot_description_content = ParameterValue(
        Command([
            FindExecutable(name="xacro"),
            " ",
            PathJoinSubstitution([pkg_share, "urdf", "r6bot.urdf.xacro"]),
            " robot_ip:=",      LaunchConfiguration("robot_ip"),
            " robot_port:=",    LaunchConfiguration("robot_port"),
            " local_port:=",    LaunchConfiguration("local_port"),
        ]),
        value_type=str,
    )
    robot_description = {"robot_description": robot_description_content}

    controller_config = PathJoinSubstitution(
        [pkg_share, "config", "r6bot_controllers.yaml"]
    )
    rviz_config = PathJoinSubstitution(
        [description_share, "rviz", "view_robot.rviz"]
    )

    # ── Node 1: ros2_control_node ─────────────────────────────────────────
    # Loads the hardware plugin (R6botHardware) and runs the 500 Hz control loop.
    # The robot_description parameter tells it which joints and interfaces to manage.
    control_node = Node(
        package="controller_manager",
        executable="ros2_control_node",
        parameters=[robot_description, controller_config],
        output="screen",
    )

    # ── Node 2: robot_state_publisher ────────────────────────────────────
    # Converts /joint_states into TF transforms so RViz can render the robot.
    robot_state_publisher_node = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        parameters=[robot_description],
        output="screen",
    )

    # ── Node 3: RViz ─────────────────────────────────────────────────────
    # Visualizes /robot_description and TF published by robot_state_publisher.
    rviz_node = Node(
        package="rviz2",
        executable="rviz2",
        name="rviz2",
        arguments=["-d", rviz_config],
        condition=IfCondition(LaunchConfiguration("rviz")),
        output="screen",
    )

    # ── Node 4: joint_state_broadcaster spawner ───────────────────────────
    # Reads position/velocity from the hardware state interfaces and publishes
    # them on /joint_states at the control loop rate.
    joint_state_broadcaster_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[
            "joint_state_broadcaster",
            "--controller-manager", "/controller_manager",
        ],
    )

    # ── Node 5: joint_trajectory_controller spawner ───────────────────────
    # Accepts JointTrajectory goals (from MoveIt or ros2 action send_goal).
    # Interpolates them into a dense position stream and calls write() each cycle.
    # We delay this until the broadcaster is confirmed running.
    joint_trajectory_controller_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=[
            "joint_trajectory_controller",
            "--controller-manager", "/controller_manager",
        ],
    )

    # Delay: start joint_trajectory_controller only after joint_state_broadcaster is up
    delay_jtc = RegisterEventHandler(
        event_handler=OnProcessExit(
            target_action=joint_state_broadcaster_spawner,
            on_exit=[joint_trajectory_controller_spawner],
        )
    )

    return LaunchDescription(
        args + [
            control_node,
            robot_state_publisher_node,
            rviz_node,
            joint_state_broadcaster_spawner,
            delay_jtc,
        ]
    )
