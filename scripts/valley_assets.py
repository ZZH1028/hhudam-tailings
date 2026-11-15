"""Build textured terrain, vegetation, and the changing dam profiles for the demo."""
import json
import struct
import zlib

import numpy as np

from valley_demo import DAM_STAGES, GRID, embankment, ground, river_center, smooth


def png(image):
    height, width, _ = image.shape
    data = b"".join(b"\0" + row.tobytes() for row in image)

    def chunk(kind, contents):
        return struct.pack(">I", len(contents)) + kind + contents + struct.pack(">I", zlib.crc32(kind + contents))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(data, 5)) + chunk(b"IEND", b"")


def rectangle(x0, xmax, y0, ymax, nx, ny):
    return np.meshgrid(np.linspace(x0, xmax, nx), np.linspace(y0, ymax, ny))


def rgb_mix(a, b, weight):
    weight = np.asarray(weight)[..., None]
    return np.asarray(a) * (1 - weight) + np.asarray(b) * weight


def grain(x, y, width, salt):
    x, y = x / width, y / width
    i, j = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    u, v = smooth(0, 1, x - i), smooth(0, 1, y - j)

    def sample(a, b):
        value = np.asarray(a * 374761393 + b * 668265263 + salt * 362437, dtype=np.uint32)
        value = (value ^ (value >> 13)) * np.uint32(1274126177)
        return (value ^ (value >> 16)) / 4294967295.0

    lower = sample(i, j) * (1 - u) + sample(i + 1, j) * u
    upper = sample(i, j + 1) * (1 - u) + sample(i + 1, j + 1) * u
    return lower * (1 - v) + upper * v


def terrain_color(x, y):
    river = np.abs(y - river_center(x))
    fields = 0.71 * grain(x, y, 67, 51) + 0.29 * grain(x, y, 16, 81)
    trees = smooth(0.25, 0.84, fields) * smooth(33, 155, river)
    color = rgb_mix([143, 132, 94], [61, 87, 52], smooth(8, 92, river))
    color = rgb_mix(color, [41, 65, 39], trees)
    color = rgb_mix(color, [121, 112, 84], (1 - smooth(15, 46, river)) * (0.53 + 0.25 * np.sin(x / 18 + y / 25)))
    road = 91 + 13 * np.sin(x / 90)
    track = (1 - smooth(2.7, 4.4, np.abs(y - road))) * smooth(102, 150, x) * (1 - smooth(710, 750, x))
    color = rgb_mix(color, [143, 135, 114], track)
    aggregate = 11 * np.sin(x * 0.42 + y * 0.45) * np.sin(y * 0.38 - x * 0.31)
    aggregate += 7 * np.sin(x * 1.72 - y * 2.2) * np.cos(y * 1.68)
    aggregate += 6 * np.sin(y * 0.09 - x * 0.11)
    return np.clip(color + aggregate[..., None], 0, 255)


def dam_color(x, y, base, filled):
    cover = filled - base
    axis = x - 0.0008 * y * y
    texture = 2 * (grain(x, y, 4.2, 210) - 0.5)
    strata = np.cos((filled + y * 0.004) * 2.5)
    riprap = rgb_mix([149, 130, 105], [116, 111, 96], 0.54 + 0.34 * np.sin(y / 33 - x / 11))
    riprap = riprap + (17 * texture + 6 * strata)[..., None]
    crest = (np.abs(axis - 1) < 6) & (filled > 22)
    bench = ((axis > 42) & (axis < 50) & (filled > 14)) | ((axis > 76) & (axis < 84) & (filled > 6))
    riprap = rgb_mix(riprap, [160, 153, 134], np.where(crest | bench, 0.85, 0))
    rock = rgb_mix([136, 119, 94], [188, 149, 105], 0.35 + 0.31 * np.cos(filled * 0.9 + y * 0.04))
    steep = np.abs(np.gradient(filled, axis=0)) > 1.9
    color = rgb_mix(riprap, rock, np.where(steep, 0.65, 0))
    return np.clip(rgb_mix(terrain_color(x, y), color, smooth(0.1, 2.3, cover)), 0, 255)


def to_linear(rgb):
    srgb = np.clip(np.asarray(rgb) / 255, 0, 1)
    return np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)


def mesh_grid(x, y, z, color=None, keep=None, textured=False):
    gy, gx = np.gradient(z, y[1, 0] - y[0, 0], x[0, 1] - x[0, 0])
    normals = np.stack((-gx, np.ones_like(z), gy), axis=-1).reshape(-1, 3)
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    ids = np.arange(z.size, dtype=np.uint32).reshape(z.shape)
    a, b, c, d = ids[:-1, :-1], ids[:-1, 1:], ids[1:, :-1], ids[1:, 1:]
    if keep is not None:
        a, b, c, d = (values[keep] for values in (a, b, c, d))
    mesh = {
        "POSITION": np.stack((x, z, -y), axis=-1).reshape(-1, 3),
        "NORMAL": normals,
        "indices": np.stack((a, b, c, b, d, c), axis=-1).ravel(),
    }
    if color is not None:
        mesh["COLOR_0"] = to_linear(color).reshape(-1, 3)
    if textured:
        mesh["TEXCOORD_0"] = np.stack(((x - x.min()) / np.ptp(x), (y.max() - y) / np.ptp(y)), axis=-1).reshape(-1, 2)
    return mesh


def vegetation_and_structures():
    rng = np.random.default_rng(83)
    points, normals, colors = [], [], []

    def triangle(a, b, c, color):
        a, b, c = (np.array([x, z, -y]) for x, y, z in (a, b, c))
        normal = np.cross(b - a, c - a)
        length = np.linalg.norm(normal)
        if length > 1e-8:
            points.extend((a, b, c))
            normals.extend((normal / length,) * 3)
            colors.extend((color,) * 3)

    # Low-poly tree crowns follow the underlying landscape and receive lighting.
    for x, y in rng.uniform([-410, -410], [778, 410], size=(2800, 2)):
        distance = abs(y - river_center(x))
        road = 91 + 13 * np.sin(x / 90)
        if distance < 75 or (125 < x < 750 and abs(y - road) < 12) or (-102 < x < 155 and abs(y) < 188):
            continue
        forest = 0.54 + 0.26 * np.sin(x / 51 + y / 47) + 0.23 * np.cos(y / 27 - x / 70)
        if rng.random() > forest or (x < 0 and ground(x, y) < 24):
            continue
        height = rng.uniform(3.2, 9.3)
        radius = height * rng.uniform(0.27, 0.43)
        z = ground(x, y, detailed=True)
        shade = rng.uniform(0.75, 1.2)
        for level, scale in ((0.36, 1), (0.59, 0.76)):
            angles = np.linspace(0, np.pi * 2, 7) + rng.uniform(-1, 1)
            ring = [(x + np.cos(angle) * radius * scale, y + np.sin(angle) * radius * scale, z + height * level) for angle in angles]
            apex = (x + 0.11 * radius, y, z + height * (level + 0.41))
            for index in range(6):
                color = np.array([60, 89, 48]) * shade * rng.uniform(0.89, 1.08)
                triangle(ring[index], ring[index + 1], apex, color)

    def box(x0, x1, y0, y1, z0, z1, color):
        a, b, c, d = (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)
        e, f, g, h = (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)
        for p, q, r, s in ((e, f, g, h), (a, b, f, e), (b, c, g, f), (c, d, h, g), (d, a, e, h)):
            triangle(p, q, r, color)
            triangle(p, r, s, color)

    # A downstream access bridge provides a visual scale for the travelling wave.
    x = 354
    y = float(river_center(x))
    z = float(ground(x, y)) + 8.2
    box(x - 4, x + 4, y - 61, y + 61, z - 0.7, z, [125, 126, 120])
    for xx in (x - 3.9, x + 3.4):
        box(xx, xx + 0.44, y - 61, y + 61, z, z + 0.84, [174, 174, 159])
    for yy in (y - 49, y - 18, y + 18, y + 49):
        box(x - 2, x + 2, yy - 1.6, yy + 1.6, float(ground(x, yy)) - 1, z - 0.55, [133, 134, 123])

    return {"POSITION": np.asarray(points), "NORMAL": np.asarray(normals),
            "COLOR_0": to_linear(colors), "indices": np.arange(len(points), dtype=np.uint32)}


def glb(path, meshes, texture=None):
    blob = bytearray()
    views, accessors, primitives = [], [], []

    def add_view(data, target=None):
        blob.extend(b"\x00" * (-len(blob) % 4))
        view = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)}
        if target:
            view["target"] = target
        blob.extend(data)
        views.append(view)
        return len(views) - 1

    def add_accessor(name, array):
        flat = name == "indices"
        dtype, component_type, target = ("<u4", 5125, 34963) if flat else ("<f4", 5126, 34962)
        view = add_view(array.astype(dtype, copy=False).tobytes(), target)
        accessor = {
            "bufferView": view, "componentType": component_type, "count": len(array),
            "type": "SCALAR" if flat else f"VEC{array.shape[1]}",
        }
        if name == "POSITION":
            accessor.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        accessors.append(accessor)
        return len(accessors) - 1

    for mesh in meshes:
        attrs = {name: add_accessor(name, data) for name, data in mesh.items() if name != "indices"}
        indices = add_accessor("indices", mesh["indices"])
        primitives.append({"attributes": attrs, "indices": indices, "material": int("TEXCOORD_0" in attrs)})
    plain = {"pbrMetallicRoughness": {"metallicFactor": 0, "roughnessFactor": 0.96}, "doubleSided": True}
    header = {
        "asset": {"version": "2.0", "generator": "HHU terrain demonstration"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": primitives}], "bufferViews": views, "accessors": accessors,
        "materials": [plain],
    }
    if texture:
        header["images"] = [{"bufferView": add_view(texture), "mimeType": "image/png"}]
        header["textures"] = [{"source": 0}]
        header["materials"].append({"pbrMetallicRoughness":
            {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1}})
    blob.extend(b"\x00" * (-len(blob) % 4))
    header["buffers"] = [{"byteLength": len(blob)}]
    data = json.dumps(header, separators=(",", ":")).encode()
    data += b" " * (-len(data) % 4)
    with path.open("wb") as file:
        file.write(struct.pack("<4sII", b"glTF", 2, 28 + len(data) + len(blob)))
        file.write(struct.pack("<I4s", len(data), b"JSON"))
        file.write(data)
        file.write(struct.pack("<I4s", len(blob), b"BIN\x00"))
        file.write(blob)


def build_models(public):
    models = public / "models"
    x0, y0 = GRID["x0"], GRID["y0"]
    xmax = x0 + (GRID["nx"] - 1) * GRID["dx"]
    ymax = y0 + (GRID["ny"] - 1) * GRID["dy"]
    x, y = rectangle(x0, xmax, y0, ymax, 301, 209)
    base = ground(x, y, detailed=True)
    bx, by = rectangle(x0, xmax, y0, ymax, 1360, 942)
    rgb = terrain_color(bx, by)
    texture = png(rgb[::-1].astype(np.uint8))
    glb(models / "valley.glb", [mesh_grid(x, y, base, textured=True), vegetation_and_structures()], texture)
    shaded = ground(bx, by, detailed=True)
    gy, gx = np.gradient(shaded, by[1, 0] - by[0, 0], bx[0, 1] - bx[0, 0])
    light = np.clip(0.71 + 0.29 * (1 - 0.9 * gx - 1.1 * gy) / np.sqrt(1 + gx * gx + gy * gy), 0.44, 1.25)
    rng = np.random.default_rng(94)
    rgb = np.clip(rgb * light[..., None] + rng.normal(0, 1.6, shaded.shape)[..., None], 0, 255)
    (models / "valley-relief.png").write_bytes(png(rgb[::-1].astype(np.uint8)))

    x, y = rectangle(-97, 177, -202, 202, 103, 151)
    base = ground(x, y, detailed=True)
    folder = models / "valley-dam"
    folder.mkdir(exist_ok=True)
    for index in range(DAM_STAGES):
        z = embankment(x, y, base, index / (DAM_STAGES - 1))
        raised = z - base > 0.03
        keep = raised[:-1, :-1] | raised[:-1, 1:] | raised[1:, :-1] | raised[1:, 1:]
        glb(folder / f"{index:02}.glb", [mesh_grid(x, y, z + 0.025, dam_color(x, y, base, z), keep)])
