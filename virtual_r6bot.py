#!/usr/bin/env python3
"""
virtual_r6bot.py — R6Bot combined simulator: WebSocket + UDP

Single entry-point for development and testing.  Runs the 6-DOF physics
simulation and exposes two interfaces so the web UI and the ROS2 driver
can connect simultaneously:

  WebSocket  ws://0.0.0.0:8765    ← browser / web UI
  UDP recv   0.0.0.0:30000        ← ros2 launch r6bot_driver r6bot.launch.py

Both interfaces share one simulated robot.  Either source can send
commands; the robot always tracks the most recently received command.
The ROS2 driver receives a UDP state reply immediately on each command
packet — identical behaviour to the old standalone sim_robot_server.py.

WebSocket messages (JSON):
  Bridge → Browser   {"type":"joint_states","names":[...],"positions":[...],
                       "velocities":[...],"ros2_driver":true|false}
  Browser → Bridge   {"type":"command","positions":[...],"speed":50}

UDP messages (binary, matches robot_comm.hpp exactly):
  Driver → Bridge    48 bytes  (6 × double)  joint position command
  Bridge → Driver    48 bytes  (6 × double)  joint state reply

Usage:
  python3 virtual_r6bot.py              # default ports
  python3 virtual_r6bot.py --ws-port 8765 --udp-port 30000
  ./start.sh                           # virtual robot + web UI together
"""

import argparse
import asyncio
import json
import struct
import time

try:
    import websockets
    from websockets.server import serve as ws_serve
except ImportError:
    raise SystemExit(
        "websockets library not found.\n"
        "Install it:  pip install websockets"
    )

# ── Configuration ──────────────────────────────────────────────────────────
N_JOINTS      = 6
JOINT_NAMES   = [f"joint_{i + 1}" for i in range(N_JOINTS)]
POSITION_GAIN = 5.0    # rad/s per rad of error
PUBLISH_HZ    = 50     # WebSocket broadcast rate
DT            = 1.0 / PUBLISH_HZ
ROS2_STALE_TIMEOUT_SEC = 1.5

WS_HOST  = "0.0.0.0"
WS_PORT  = 8765
UDP_HOST = "0.0.0.0"
UDP_PORT = 30000


# ── Shared robot state ─────────────────────────────────────────────────────
class RobotSim:
    def __init__(self):
        self.positions:  list[float] = [0.0] * N_JOINTS
        self.velocities: list[float] = [0.0] * N_JOINTS
        self.command:    list[float] = [0.0] * N_JOINTS
        self.speed_scale: float       = 0.5
        self.udp_client: tuple | None = None
        self.udp_last_seen: float | None = None

    def step(self, dt: float) -> None:
        for i in range(N_JOINTS):
            err              = self.command[i] - self.positions[i]
            self.velocities[i] = err * POSITION_GAIN * self.speed_scale
            self.positions[i] += self.velocities[i] * dt

    def mark_udp_client(self, addr: tuple, now: float) -> None:
        self.udp_client    = addr
        self.udp_last_seen = now

    def ros2_connected(self, now: float) -> bool:
        if self.udp_client is None or self.udp_last_seen is None:
            return False
        if now - self.udp_last_seen > ROS2_STALE_TIMEOUT_SEC:
            self.udp_client    = None
            self.udp_last_seen = None
            return False
        return True


robot     = RobotSim()
ws_clients: set = set()


# ── UDP endpoint (ROS2 driver protocol) ────────────────────────────────────
class UDPBridgeProtocol(asyncio.DatagramProtocol):
    """Speaks the same binary protocol as robot_comm.hpp."""

    def __init__(self) -> None:
        self.transport: asyncio.DatagramTransport | None = None

    def connection_made(self, transport: asyncio.DatagramTransport) -> None:
        self.transport = transport
        print(f"[virtual_r6bot] UDP  listening on {UDP_HOST}:{UDP_PORT}  (ROS2 driver)")

    def datagram_received(self, data: bytes, addr: tuple) -> None:
        if len(data) != N_JOINTS * 8:
            return
        robot.command     = list(struct.unpack(f"{N_JOINTS}d", data))
        robot.speed_scale = 1.0
        robot.mark_udp_client(addr, time.monotonic())
        # Reply immediately with current state — same behaviour as sim_robot_server.py
        if self.transport:
            self.transport.sendto(
                struct.pack(f"{N_JOINTS}d", *robot.positions), addr)

    def error_received(self, exc: Exception) -> None:
        print(f"[virtual_r6bot] UDP error: {exc}")


udp_protocol = UDPBridgeProtocol()


# ── WebSocket handler (web UI) ──────────────────────────────────────────────
async def ws_handler(websocket) -> None:
    ws_clients.add(websocket)
    addr = websocket.remote_address
    print(f"[virtual_r6bot] WS   client connected:    {addr}  ({len(ws_clients)} total)")
    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
                if msg.get("type") == "command":
                    pos = msg.get("positions", [])
                    if len(pos) == N_JOINTS:
                        robot.command     = [float(p) for p in pos]
                        speed             = float(msg.get("speed", 50))
                        robot.speed_scale = max(0.01, min(1.0, speed / 100.0))
            except Exception as exc:
                print(f"[virtual_r6bot] WS bad message: {exc}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        ws_clients.discard(websocket)
        print(f"[virtual_r6bot] WS   client disconnected  ({len(ws_clients)} remaining)")


# ── Simulation + WebSocket broadcast loop ──────────────────────────────────
async def sim_loop() -> None:
    prev  = time.monotonic()
    cycle = 0

    while True:
        now = time.monotonic()
        dt  = min(now - prev, 0.1)
        prev = now

        robot.step(dt)
        ros2_connected = robot.ros2_connected(now)
        cycle += 1

        # Broadcast to all WebSocket clients
        if ws_clients:
            payload = json.dumps({
                "type":        "joint_states",
                "names":       JOINT_NAMES,
                "positions":   [round(p, 6) for p in robot.positions],
                "velocities":  [round(v, 6) for v in robot.velocities],
                "ros2_driver": ros2_connected,
            })
            dead: set = set()
            for ws in list(ws_clients):
                try:
                    await ws.send(payload)
                except Exception:
                    dead.add(ws)
            ws_clients.difference_update(dead)

        # Console heartbeat — once per second (commented out to reduce log noise)
        # if cycle % PUBLISH_HZ == 0:
        #     pstr = "  ".join(f"{p:+7.3f}" for p in robot.positions)
        #     ros2 = "ROS2 ✓" if ros2_connected else "ROS2 —"
        #     web  = f"WS:{len(ws_clients)}"
        #     print(f"[virtual_r6bot] [{pstr}] rad   {ros2}  {web}")

        await asyncio.sleep(DT)


# ── Entry point ─────────────────────────────────────────────────────────────
async def main(ws_port: int, udp_port: int) -> None:
    global UDP_PORT
    UDP_PORT = udp_port

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║       Virtual R6Bot  —  sim + WebSocket + UDP            ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print(f"║  Web UI  →  ws://localhost:{ws_port:<5}                       ║")
    print(f"║  ROS2    →  UDP 0.0.0.0:{udp_port:<5}  (optional)             ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    loop = asyncio.get_running_loop()
    await loop.create_datagram_endpoint(
        lambda: udp_protocol,
        local_addr=(UDP_HOST, udp_port),
    )

    async with ws_serve(ws_handler, WS_HOST, ws_port):
        print(f"[virtual_r6bot] WebSocket ready  ws://0.0.0.0:{ws_port}")
        print(f"[virtual_r6bot] Open your browser at  http://localhost:5173")
        print(f"[virtual_r6bot] Ctrl+C to stop\n")
        await sim_loop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="R6Bot combined simulator (WebSocket + UDP)")
    parser.add_argument("--ws-port",  type=int, default=WS_PORT,  help="WebSocket port (default 8765)")
    parser.add_argument("--udp-port", type=int, default=UDP_PORT, help="UDP command port (default 30000)")
    args = parser.parse_args()

    try:
        asyncio.run(main(args.ws_port, args.udp_port))
    except KeyboardInterrupt:
        print("\n[virtual_r6bot] Stopped.")
