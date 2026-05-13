from setuptools import find_packages, setup

package_name = 'joint_trajectory_cmd'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Robot Developer',
    maintainer_email='dear.moeurn2912@gmail.com',
    description='Demo: move r6bot to a target pose then back to zero via JTC action',
    license='Apache-2.0',
    entry_points={
        'console_scripts': [
            'move_demo = joint_trajectory_cmd.move_demo:main',
        ],
    },
)
