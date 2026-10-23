<p align="center"><img src="src/assets/brand/logo.png" width="360" alt="Command Center" /></p>

# Command Center — Web quản trị

**Định vị · Giám sát · Xử lý sự vụ.** Web cho người dùng Web (trực ban / chỉ huy) của hệ thống.
Backend: [CMC-Master](https://github.com/MrNMD2002/CMC-Master).

React 19 · TypeScript · Vite · Ant Design 5 · Tailwind 4 (shadcn/ui) · TanStack Query · Zustand · Leaflet.
Khung giao diện dựa trên template mã nguồn mở [slash-admin](https://github.com/d3george/slash-admin) (MIT).

## Tính năng

| Trang | Đường dẫn | Quyền cần |
|---|---|---|
| Tổng quan — số liệu, bản đồ thu nhỏ, sự vụ mới | `/dashboard` | `dashboard.access` |
| Giám sát trực tuyến — xe trên bản đồ (tự làm mới 10 giây), tạo sự vụ bằng cách bấm lên bản đồ, điều xe gần nhất | `/monitoring` | `gps.read` |
| Sự vụ — danh sách, chi tiết, điều / rút xe, kết thúc từng xe, ảnh hiện trường, nhật ký | `/incidents` | `incident.read` hoặc `incident.read.all` |
| Lộ trình — xem lại hành trình xe (tối đa 24 giờ), phát lại | `/activity` | `device_activity.read` |
| Phương tiện — CRUD, gán cán bộ (mỗi cán bộ một xe), mqtt_key | `/devices` | `device.read` |
| Tổ chức / đơn vị — cây nhiều cấp | `/organization` | `tenant.*` |
| Tài khoản — CRUD, khoá, đặt lại mật khẩu, cấp quyền lẻ | `/users` | `user.read` |
| Vai trò & quyền | `/roles` | `role.read` |
| Nhật ký thao tác — lọc, xuất Excel | `/audit-log` | `audit.read` |
| Cài đặt — loại phương tiện, lưu trữ lịch sử GPS | `/settings` | `device.read` / `setting.read` |
| Hồ sơ cá nhân — đổi tên, đổi mật khẩu | `/profile` | đăng nhập |

Menu tự ẩn mục người dùng không có quyền; vào thẳng URL không có quyền thì hiện trang 403.

**Giao diện:** màu mặc định xanh dương theo bộ nhận diện; nút Sáng / Tối và chọn ngôn ngữ (Tiếng Việt / English) ở thanh trên cùng (cả trang đăng nhập).
Nút bánh răng mở bảng tuỳ chỉnh: màu chủ đạo, bố cục menu (dọc / ngang / thu gọn), cỡ chữ. Lựa chọn được nhớ trên máy.

## Chạy

Cần Node 20+ và backend CMC đang chạy ở `http://localhost:8010`.

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm run dev          # http://localhost:3001
```

Dev server proxy `/cmc/api` → `VITE_DEV_API_TARGET` nên không vướng CORS.
Build: `npm run build` (ra `dist/`). Kiểm tra code: `npx tsc --noEmit`, `npm run lint`.

## Cấu trúc

```
src/
  api/apiClient.ts        gọi API: bóc khung {code,data,message}, tự refresh token khi 401,
                          đăng xuất khi 4011, toast lỗi (message tiếng Việt từ backend)
  api/services/*          một file / nhóm endpoint
  types/cmc.ts            kiểu dữ liệu theo schema backend
  constants/permission.ts mã quyền
  components/cmc/*        thành phần nghiệp vụ dùng chung: bản đồ, chọn đơn vị (cây),
                          form tạo sự vụ, chọn xe gần nhất, danh sách quyền...
  pages/*                 mỗi thư mục một trang (route khai báo ở routes/sections/dashboard)
  locales/lang/*/translation.json   bản dịch vi_VN / en_US
```

## Ghi chú

- **Bản đồ hoàn toàn tự host, không gọi dịch vụ bên ngoài** (repo [Map_CMC](https://github.com/MrNMD2002/Map_CMC)):
  - **Nền**: `VITE_MAP_TILE_URL` (bỏ trống → cùng máy với web, cổng 8090). Nền đã vẽ sẵn chủ quyền
    Hoàng Sa, Trường Sa và viền đỏ lãnh thổ Việt Nam. Không cho thu nhỏ dưới mức 5 / kéo ra ngoài
    khung dữ liệu (`base-map.tsx`). Đổi kiểu bản đồ ở backend thì tăng `?v=` trong URL. Giao diện tối
    làm dịu nền bằng CSS.
  - **Tra địa chỉ** (`utils/geocode.ts`): `GET /map/geocode`, `GET /map/reverse` của backend (Photon trên
    dữ liệu OSM Việt Nam) — đơn vị hành chính mới (phường / xã, tỉnh / thành, bỏ cấp huyện); vùng Hoàng
    Sa / Trường Sa ghi "Đặc khu Hoàng Sa, Thành phố Đà Nẵng" / "Đặc khu Trường Sa, Tỉnh Khánh Hòa".
- **Ảnh hiện trường** lấy qua `/incident/{id}/images/{image_id}/raw` kèm token rồi hiện bằng blob URL
  (thẻ `<img>` không gửi được header Authorization).
- **Xe gần nhất** chỉ gồm xe đang trực tuyến (gửi GPS trong 60 giây) thuộc đơn vị phụ trách sự vụ và cấp dưới
  — đúng luật điều xe của backend. Danh sách lấy từ `GET /map/dispatch-suggestions`: xe tới nhanh nhất theo
  đường đi thực tế trước, hiện "~7 phút · 2,6 km", 3 xe sẵn sàng tới nhanh nhất có nhãn **Gợi ý**. Máy chủ
  dẫn đường lỗi thì vẫn hiện danh sách, xếp theo đường chim bay kèm dòng cảnh báo.
- Thêm chuỗi giao diện mới: thêm khoá vào **cả hai** file `translation.json`.
- Tài khoản không có `dashboard.access` (tài khoản App của cán bộ) bị chặn ngay ở trang đăng nhập web.
- Bộ nhận diện: `src/assets/brand/` (biểu tượng, logo ngang), `public/` (favicon, icon PWA). Tên hệ thống ở
  `src/global-config.ts` (`appName`).
