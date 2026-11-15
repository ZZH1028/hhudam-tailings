"""Construct a fictional tailings valley and solve its illustrative 2D flood."""
import numpy as np

GRAVITY = 9.81
GRID = {"nx": 151, "ny": 105, "x0": -416, "y0": -416, "dx": 8, "dy": 8}
ORIGIN = {"longitude": 118.754, "latitude": 32.045, "height": 55}
FRAME_TIMES = range(0, 241, 2)
DAM_STAGES = 13


def smooth(a, b, value):
    limit = np.clip((value - a) / (b - a), 0, 1)
    return limit * limit * (3 - 2 * limit)


def river_center(x):
    return 36 * np.sin(x / 145) + 24 * np.sin(x / 77) + 0.031 * x


def ground(x, y, detailed=False):
    distance = np.abs(y - river_center(x))
    bank = 27 + 7 * np.sin(x / 80) + 20 * np.exp(-((x + 220) / 155) ** 2)
    valley_side = np.maximum(0, distance - bank)
    bed = -0.013 * x + 0.65 * np.sin(x / 87) + 0.045 * valley_side
    hillside = smooth(38, 250, valley_side)
    hills = 47 + 14 * np.sin(x / 111 + y / 73) + 10 * np.cos(x / 55 - y / 103)
    bed += hillside * (hills + 12 * np.sin(y / 61) ** 2)
    bed += smooth(30, 130, valley_side) * 2.6 * np.sin(x / 24 + y / 37) * np.cos(y / 29)
    # A level access terrace on the lower bank and a shallow drainage turn.
    access = 91 + 13 * np.sin(x / 90)
    trail = smooth(140, 215, x) * (1 - smooth(660, 740, x))
    bed = np.where((y > 0) & (np.abs(y - access) < 6), bed * (1 - 0.34 * trail) + (4.4 - 0.004 * x) * (0.34 * trail), bed)
    if detailed:
        bed += 0.28 * np.sin(x * 0.65 + y * 0.51) * np.cos(y * 0.58)
        bed += 0.35 * hillside * np.sin(x * 0.24 - y * 0.18)
    return bed


def embankment(x, y, base, stage):
    # The profile describes a crest, two inspection benches, and the outer toe.
    axis = x - 0.0008 * y * y
    profile = np.interp(axis, [-95, -68, -11, -5, 7, 42, 51, 76, 85, 115, 142],
                        [-5, 0, 26, 28, 28, 16, 16, 8, 8, 1, -6])
    profile -= 0.00012 * y * y + 9 * smooth(146, 184, np.abs(y))
    intact = np.maximum(profile, base)
    if stage <= 0:
        return intact
    notch_center = -9 + 8 * np.sin(x / 37)
    half_width = (4 + 49 * stage) * (1 + 0.14 * smooth(12, 82, x))
    shoulders = np.maximum(0, np.abs(y - notch_center) - half_width)
    groove = base + 28.5 * (1 - stage) + 0.55 * shoulders
    # Small variations in the exposed breach walls are linked to the same bed used by the solver.
    groove += 0.62 * np.sin(y * 0.22 + x * 0.17) * np.minimum(1, shoulders / 9)
    return np.maximum(base, np.minimum(intact, groove))


def phase(time):
    return float(smooth(12, 76, time))


def coordinates():
    g = GRID
    return np.meshgrid(g["x0"] + g["dx"] * np.arange(g["nx"]),
                       g["y0"] + g["dy"] * np.arange(g["ny"]))


def velocities(depth, mx, my):
    divisor = np.maximum(depth, 0.027)
    return mx / divisor, my / divisor


def flux_difference(h, mx, my, z, exit_open):
    """Hydrostatic reconstruction with Rusanov flux and reflecting side walls."""
    depth = np.pad(h, ((0, 0), (1, 1)), mode="edge")
    floor = np.pad(z, ((0, 0), (1, 1)), mode="edge")
    normal = np.pad(mx, ((0, 0), (1, 1)), mode="edge")
    tangential = np.pad(my, ((0, 0), (1, 1)), mode="edge")
    normal[:, 0] *= -1
    if not exit_open:
        normal[:, -1] *= -1
    else:
        normal[:, -1] = np.maximum(normal[:, -1], 0)

    left, right = depth[:, :-1], depth[:, 1:]
    crest = np.maximum(floor[:, :-1], floor[:, 1:])
    a = np.maximum(0, left + floor[:, :-1] - crest)
    b = np.maximum(0, right + floor[:, 1:] - crest)
    u, v = velocities(depth, normal, tangential)
    ul, ur, vl, vr = u[:, :-1], u[:, 1:], v[:, :-1], v[:, 1:]
    speed = np.maximum(np.abs(ul) + np.sqrt(GRAVITY * a), np.abs(ur) + np.sqrt(GRAVITY * b))
    ax, bx = a * ul, b * ur
    ay, by = a * vl, b * vr
    mass = 0.5 * (ax + bx - speed * (b - a))
    f_mx = 0.5 * (ax * ul + bx * ur + (GRAVITY / 2) * (a * a + b * b) - speed * (bx - ax))
    f_my = 0.5 * (ax * vl + bx * vr - speed * (by - ay))
    normal_left = f_mx + (GRAVITY / 2) * (left * left - a * a)
    normal_right = f_mx + (GRAVITY / 2) * (right * right - b * b)
    return mass[:, 1:] - mass[:, :-1], normal_left[:, 1:] - normal_right[:, :-1], f_my[:, 1:] - f_my[:, :-1]


def build_flood():
    x, y = coordinates()
    floor = ground(x, y)
    intact = embankment(x, y, floor, 0)
    final = embankment(x, y, floor, 1)
    changed = np.flatnonzero(intact.ravel() - final.ravel() > 0.0001)
    h = np.where(x < 0, np.maximum(0, 23.5 - intact), 0)
    mx = np.zeros_like(h)
    my = np.zeros_like(h)
    roughness = 0.036 + 0.018 * smooth(25, 125, np.abs(y - river_center(x)))
    initial_volume = float(h.sum() * GRID["dx"] * GRID["dy"])
    time = 0.0
    frames = []
    for target in FRAME_TIMES:
        while time < target - 1e-8:
            u, v = velocities(h, mx, my)
            wave = np.sqrt(GRAVITY * h)
            rate = ((np.abs(u) + wave) / GRID["dx"] + (np.abs(v) + wave) / GRID["dy"]).max()
            dt = min(target - time, 0.39 / max(1e-8, rate), 0.45)
            z = embankment(x, y, floor, phase(time + dt / 2))
            hx, xx, yx = flux_difference(h, mx, my, z, True)
            hy, yy, xy = flux_difference(h.T, my.T, mx.T, z.T, False)
            h = np.maximum(0, h - dt * (hx / GRID["dx"] + hy.T / GRID["dy"]))
            mx -= dt * (xx / GRID["dx"] + xy.T / GRID["dy"])
            my -= dt * (yx / GRID["dx"] + yy.T / GRID["dy"])
            friction = 1 + dt * GRAVITY * roughness ** 2 * np.hypot(mx, my) / np.maximum(h, 0.04) ** (7 / 3)
            mx = np.where(h > 0.007, mx / friction, 0)
            my = np.where(h > 0.007, my / friction, 0)
            time += dt
        z = embankment(x, y, floor, phase(target))
        u, v = velocities(h, mx, my)
        speed = np.where(h > 0.035, np.hypot(u, v), 0)
        frames.append({
            "time": target,
            "depth": np.round(h.ravel(), 3).tolist(),
            "speed": np.round(speed.ravel(), 2).tolist(),
            "bed_change": np.round(z.ravel()[changed], 3).tolist(),
            "stage": phase(target),
        })
    assert np.isfinite(h).all() and float(h.sum() * GRID["dx"] * GRID["dy"]) <= initial_volume * 1.002
    return {
        "version": 1,
        "name": "山谷尾矿坝 · 溃口发展演示",
        "source_type": "demonstration",
        "method": "合成地形二维浅水有限体积计算，采用静水重构、Manning 阻力和给定的溃口发展过程。水面纹理用于表现泥沙水流，时序水深来自计算网格。",
        "vertical_datum": "演示地形相对高程",
        "origin": ORIGIN,
        "yaw": 0,
        "grid": GRID,
        "bed": np.round(intact.ravel(), 3).tolist(),
        "bed_indices": changed.tolist(),
        "frames": frames,
    }
