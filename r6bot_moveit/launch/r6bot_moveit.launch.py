#!/usr/bin/env python3
"""Launch MoveIt 2 for R6Bot."""

import os
from pathlib import Path

import yaml
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import Command, LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node, SetParameter
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare
from moveit_configs_utils import MoveItConfigsBuilder


def declare_arg(name: str, default: str, description: str) -> DeclareLaunchArgument:
    return DeclareLaunchArgument(name, default_value=str(default), description=description)


def load_yaml(package_name: str, relative_path: str):
    path = os.path.join(get_package_share_directory(package_name), relative_path)
    try:
        with open(path, "r") as file:
            return yaml.safe_load(file)
    except OSError:
        return None


def generate_launch_description() -> LaunchDescription:
    args = [
        declare_arg("launch_rviz", "true", "Launch MoveIt RViz"),
        declare_arg("use_sim_time", "false", "Use simulation clock"),
        declare_arg(
            "warehouse_sqlite_path",
            os.path.expanduser("~/.ros/r6bot_warehouse.sqlite"),
            "Path to the MoveIt warehouse SQLite database",
        ),
        declare_arg(
            "publish_robot_description_semantic",
            "true",
            "Publish robot_description_semantic from move_group",
        ),
    ]

    cfg = {
        name: LaunchConfiguration(name)
        for name in [
            "launch_rviz",
            "use_sim_time",
            "warehouse_sqlite_path",
            "publish_robot_description_semantic",
        ]
    }

    xacro_file = PathJoinSubstitution(
        [FindPackageShare("r6bot_description"), "urdf", "r6bot.urdf.xacro"]
    )
    robot_description = {
        "robot_description": ParameterValue(
            Command(["xacro ", xacro_file]),
            value_type=str,
        )
    }

    moveit_config = (
        MoveItConfigsBuilder(robot_name="r6bot", package_name="r6bot_moveit")
        .robot_description_semantic(Path("config") / "r6bot.srdf")
        .robot_description_kinematics(Path("config") / "kinematics.yaml")
        .trajectory_execution(Path("config") / "moveit_controllers.yaml")
        .joint_limits(Path("config") / "joint_limits.yaml")
        .sensors_3d(Path("config") / "sensors_3d_config.yaml")
        .planning_pipelines("ompl", ["ompl"])
        .planning_scene_monitor(
            publish_robot_description=True,
            publish_robot_description_semantic=True,
            publish_planning_scene=True,
        )
        .to_moveit_configs()
    )
    moveit_config.robot_description = robot_description

    warehouse_ros_config = {
        "warehouse_plugin": "warehouse_ros_sqlite::DatabaseConnection",
        "warehouse_host": cfg["warehouse_sqlite_path"],
    }

    move_group_node = Node(
        package="moveit_ros_move_group",
        executable="move_group",
        output="screen",
        parameters=[
            moveit_config.to_dict(),
            warehouse_ros_config,
            {
                "use_sim_time": cfg["use_sim_time"],
                "publish_robot_description_semantic": cfg["publish_robot_description_semantic"],
            },
        ],
    )

    rviz_config = PathJoinSubstitution(
        [FindPackageShare("r6bot_moveit"), "config", "moveit.rviz"]
    )
    rviz_node = Node(
        package="rviz2",
        executable="rviz2",
        name="rviz2_moveit",
        condition=IfCondition(cfg["launch_rviz"]),
        arguments=["-d", rviz_config],
        output="log",
        parameters=[
            moveit_config.robot_description,
            moveit_config.robot_description_semantic,
            moveit_config.robot_description_kinematics,
            moveit_config.planning_pipelines,
            moveit_config.joint_limits,
            warehouse_ros_config,
            {"use_sim_time": cfg["use_sim_time"]},
        ],
    )

    set_use_sim_time = SetParameter(name="use_sim_time", value=cfg["use_sim_time"])

    return LaunchDescription(args + [set_use_sim_time, move_group_node, rviz_node])
