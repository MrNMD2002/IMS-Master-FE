"""Dựng public/geo/vietnam.json — lãnh thổ Việt Nam + địa danh biển đảo cho lớp bản đồ chủ quyền.

Nguồn (đều dùng tự do):
- Ranh giới: Natural Earth 1:10m, bản "theo quan điểm Việt Nam" (ne_10m_admin_0_countries_vnm.geojson,
  public domain) — lãnh thổ Việt Nam GỒM quần đảo Hoàng Sa và Trường Sa.
- Địa danh: Wikidata (CC0) — đảo / đá / bãi trong khung Hoàng Sa, Trường Sa; đảo ven bờ, bán đảo,
  mũi đất của Việt Nam, lấy NHÃN TIẾNG VIỆT.

Chạy (Python 3, không cần thư viện ngoài):
    python scripts/build-vietnam-geo.py <ne_10m_admin_0_countries_vnm.geojson> <wd_islands.json> <wd_mainland.json>

wd_islands.json / wd_mainland.json là kết quả truy vấn SPARQL Wikidata (xem ghi chú cuối file).
"""
import json
import math
import re
import sys

NE, WD_SEA, WD_LAND = sys.argv[1:4]
OUT = "public/geo/vietnam.json"

# ── Ranh giới ────────────────────────────────────────────────────────────────


def simplify(ring, tol):
    """Douglas–Peucker trên toạ độ độ (đủ cho hiển thị); giữ tối thiểu 4 điểm cho vòng kín."""
    if len(ring) <= 4:
        return ring

    def dist(p, a, b):
        if a == b:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
                       ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)))
        return math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])))

    def dp(pts):
        if len(pts) < 3:
            return pts
        i, dmax = max(((i, dist(pts[i], pts[0], pts[-1])) for i in range(1, len(pts) - 1)), key=lambda x: x[1])
        if dmax <= tol:
            return [pts[0], pts[-1]]
        return dp(pts[: i + 1])[:-1] + dp(pts[i:])

    out = dp(ring)
    return out if len(out) >= 4 else ring


ne = json.load(open(NE, encoding="utf-8"))
vnm = next(f for f in ne["features"] if f["properties"].get("ADM0_A3") == "VNM")
geom = vnm["geometry"]
polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
boundary = [
    [[[round(x, 4), round(y, 4)] for x, y in simplify(ring, 0.003)] for ring in poly]
    for poly in polys
]

# ── Địa danh ─────────────────────────────────────────────────────────────────


def point(wkt):
    lng, lat = map(float, re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", wkt).groups())
    return round(lat, 5), round(lng, 5)


def clean(name):
    """Bỏ phần phân biệt trong ngoặc của Wikidata: "Lát (đá)" → "Đá Lát", "Phan Vinh (đảo)" → "Đảo Phan Vinh"."""
    m = re.match(r"^(.*?)\s*\((đảo|đá|bãi ngầm|bãi)\)$", name)
    if m:
        return f"{m.group(2).capitalize()} {m.group(1)}"
    name = re.sub(r"\s*\((quần đảo Hoàng Sa|Hoàng Sa|Khánh Hòa|.*?)\)$", "", name)
    return name[:1].upper() + name[1:]


SEA_TYPES = {"island", "islet", "reef", "atoll", "shoal", "cay", "rock formation", "skerry", "ocean bank",
             "coral reef", "sandbank", "mudflat", "guyot"}
# Thực thể hành chính / công trình do bên khác đặt, tên phiên âm không phải địa danh Việt, mục không phải địa hình.
EXCLUDE = {"Tam Sa", "Khu Tây Sa", "Vĩnh Hưng", "Sân bay đảo Vĩnh Hưng", "Xã khu Linh Dương", "Tam Trì Tể",
           "Ba Ba", "Ốc Hoa", "Đá Trà Tây", "Lỗ Rồng", "Tetley Reef", "Bãi Fancy Wreck", "Đền Cây Cỏ",
           "Hải chiến Hoàng Sa 1974", "Bãi Đường", "Cụm Loại Ta", "Cụm Luân Đôn", "Cụm Nam Yết", "Cụm Song Tử",
           "Cụm Thị Tứ", "Hoàng Sa đảo",
           # tên sau khi chuẩn hoá ngoặc; toạ độ sai trên Wikidata; đảo sông; trùng chỗ với "Côn Đảo"
           "Đảo Ba Ba", "Đảo Ốc Hoa", "Cái Mép", "Cù lao Phố", "Cù lao Giêng", "Côn Sơn"}
ISLAND_WORDS = ("Đảo ", "Hoàng Sa", "Phú Lâm", "Linh Côn", "Tri Tôn", "Quang Hòa", "Quang Ảnh", "Duy Mộng",
                "Hữu Nhật", "Bạch Quy", "Trường Sa Lớn", "Trường Sa Đông", "An Bang", "Phan Vinh",
                "Bình Nguyên", "Vĩnh Viễn")

places, seen = [], set()


def add(name, lat, lng, kind, zoom):
    key = (name, round(lat, 2), round(lng, 2))
    if key in seen or name in EXCLUDE:
        return
    seen.add(key)
    places.append({"n": name, "k": kind, "z": zoom, "p": [lat, lng]})


for o in json.load(open(WD_SEA, encoding="utf-8")):
    if not o.get("vi"):
        continue
    types = set(o["types"])
    if types and not (types & SEA_TYPES):
        continue  # khu hành chính, toà nhà, sân bay, sự kiện…
    name = clean(o["vi"])
    if name in EXCLUDE or name.lower().startswith("quần đảo") or name.lower().startswith("nhóm"):
        continue
    lat, lng = point(o["coord"])
    is_island = name.startswith(ISLAND_WORDS) or "island" in types or "islet" in types
    add(name if not (is_island and not name.startswith(("Đảo", "Đá", "Bãi", "Cồn"))) else name,
        lat, lng, "island" if is_island else "reef", 6 if is_island else 8)

# Hai nhóm đảo của Hoàng Sa (tên gọi Việt).
add("Nhóm An Vĩnh", 16.9, 112.32, "subgroup", 7)
add("Nhóm Lưỡi Liềm", 16.5, 111.65, "subgroup", 7)

LAND_SKIP_BOX = ((7.0, 17.5), (110.8, 117.5))  # Hoàng Sa / Trường Sa đã lấy ở trên
for o in json.load(open(WD_LAND, encoding="utf-8")):
    lat, lng = point(o["coord"])
    if LAND_SKIP_BOX[0][0] <= lat <= LAND_SKIP_BOX[0][1] and LAND_SKIP_BOX[1][0] <= lng <= LAND_SKIP_BOX[1][1]:
        continue
    name = clean(o["vi"])
    if name in {"Bán đảo Đông Dương", "Vinpearl Land", "Bình Quới – Thanh Đa", "Bãi Tư Chính", "An Thới"}:
        continue
    kind = {"island": "coast-island", "archipelago": "coast-island", "peninsula": "cape", "cape": "cape"}[o["kind"]]
    if kind == "coast-island" and o["links"] < 3:
        continue
    add(name, lat, lng, kind, 6 if o["links"] >= 10 else 8 if o["links"] < 5 else 7)

for name, lat, lng, kind, z in [  # bổ sung đã tra Wikidata theo tên
    ("Lý Sơn", 15.38083, 109.1175, "coast-island", 6), ("Côn Đảo", 8.69306, 106.60944, "coast-island", 6),
    ("Nam Du", 9.7, 104.36667, "coast-island", 7), ("Quan Lạn", 20.865, 107.46833, "coast-island", 8),
    ("Mũi Ba Làng An", 15.23444, 108.94194, "cape", 8),
]:
    add(name, lat, lng, kind, z)

# ── Viền nét đứt quanh hai quần đảo: bao lồi các điểm + nới rộng ──────────────


def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def envelope(box, pad=0.25):
    pts = [(p["p"][1], p["p"][0]) for p in places
           if box[0][0] <= p["p"][0] <= box[0][1] and box[1][0] <= p["p"][1] <= box[1][1]]
    for poly in boundary:  # cả các đảo trong dữ liệu ranh giới
        for x, y in poly[0]:
            if box[0][0] <= y <= box[0][1] and box[1][0] <= x <= box[1][1]:
                pts.append((x, y))
    h = hull(pts)
    cx, cy = sum(x for x, _ in h) / len(h), sum(y for _, y in h) / len(h)
    grown = []
    for x, y in h:  # nới mỗi đỉnh ra xa tâm thêm `pad` độ
        d = math.hypot(x - cx, y - cy) or 1
        grown.append([round(x + (x - cx) / d * pad, 3), round(y + (y - cy) / d * pad, 3)])
    return grown + [grown[0]]


archipelagos = {
    "hoangSa": envelope(((15.6, 17.3), (111.0, 113.0))),
    "truongSa": envelope(((7.3, 11.7), (111.4, 117.0))),
}

data = {
    "source": "Ranh giới: Natural Earth 1:10m (quan điểm Việt Nam, public domain). Địa danh: Wikidata (CC0).",
    "boundary": boundary,
    "archipelagos": archipelagos,
    "places": sorted(places, key=lambda p: (p["z"], p["n"])),
}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
kinds = {}
for p in places:
    kinds[p["k"]] = kinds.get(p["k"], 0) + 1
print(OUT, "polys", len(boundary), "pts", sum(len(r) for p in boundary for r in p), "places", kinds)

# Truy vấn Wikidata đã dùng (https://query.wikidata.org):
#  - Biển đảo: SERVICE wikibase:box trong khung Hoàng Sa (111.0,15.6)-(113.0,17.2) và Trường Sa
#    (111.4,7.3)-(117.0,11.6), lấy ?item wdt:P625, nhãn vi/en, P31.
#  - Ven bờ: ?item wdt:P31/wdt:P279* (Q23442 đảo | Q34763 bán đảo | Q185113 mũi | Q33837 quần đảo);
#    wdt:P17 wd:Q881; nhãn vi; wikibase:sitelinks để xếp độ nổi tiếng.
