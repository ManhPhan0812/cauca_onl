# 🎣 Hồ Câu Săn Thủy Quái — TikTok LIVE

Sân khấu câu cá tương tác cho TikTok LIVE, khung dọc 9:16: người xem chat để nhận cần, thả tim hoặc chat "giật" để kéo cá, tặng quà để lên cần VIP và săn thủy quái.

## Cách chơi (hiện sẵn ở cuối màn hình sân khấu)

- Chat **"câu cá"** → nhận **Cần Tre + 10 mồi** miễn phí, vào 1 trong 12 chỗ ngồi quanh hồ tròn (hồ đầy thì vào hàng chờ; treo quá 3 phút khi đang rảnh sẽ tự nhường chỗ).
- Cá cắn câu ngẫu nhiên theo loại cần (Cần Tre 8–20 giây): phao rung, bảng đỏ **"CẮN!"** đếm ngược ngay trên đầu cần thủ.
- **Thả tim ❤️ hoặc chat "giật"** trong lúc đếm ngược để kéo cá lên. Giật sớm cá chỉ hoảng và phải chờ cắn lại (không mất thêm mồi); để quá giờ cá chạy mất.
- Cá **Thủy Quái / Thần Long**: cả phòng thả tim hoặc chat "giật" phụ kéo — chủ cần tính 2 lực, người phụ tính 1 lực, đủ 3 lực mới lên được.
- Mỗi 50 tim của chính người chơi → **+10 mồi**. Theo dõi (follow) → **+5 mồi**.

## Cá và xu

17 loài, 5 hạng: Thường · Hiếm · VIP · Khủng · Thủy Quái. Cân nặng kéo theo chiều dài và xu (xu = kg × hệ số loài, Giờ Vàng x2):

- Thường: Cá Hề Nemo Hoàng Tử, Cá Rô Phi, Cá Diêu Hồng, Cá Chép, Cá Trê
- Hiếm: Cá Chim Vàng, Cá Lóc Bông, Cá Tai Tượng, Cá Tầm
- VIP: Cá Chép Koi Vàng, Cá Ngừ Vây Vàng, **Cá Hồi Vàng Alaska** (15–40 kg)
- Khủng: Cá Tra Dầu, Cá Hô Khổng Lồ, Cá Đuối Nước Ngọt (tới 140 kg)
- Thủy Quái: **Cá Rồng Thần Long** và **Thủy Quái Cổ Đại** (tới 300 kg)

Bảng vinh danh chạy trực tiếp: **Vua Sát Cá** (tổng kg cao nhất phiên) và **Kỷ lục** con nặng nhất (phiên này + kỷ lục lưu trên máy bằng localStorage).

## Quà → thưởng (theo tổng xu kim cương của món quà)

| Quà | Thưởng |
| --- | --- |
| 1 xu | +50 mồi |
| 5 xu | +50 mồi VIP |
| 30 xu | Cần VIP (cá cắn nhanh hơn, cá hiếm nhiều hơn) |
| 100 xu | Cần VIP2 |
| 500 xu | Cần Thần Long |

Tổng quà cả phiên cứ đạt mốc 200 xu lại mở **Giờ Vàng 5 phút**: x2 xu mọi con cá, cá hạng VIP trở lên xuất hiện nhiều hơn.

Quà và cá hạng VIP trở lên được **đọc cảm ơn / chúc mừng bằng giọng online** vi-VN-HoaiMyNeural qua cầu nối (mục Giọng đọc bên dưới). Riêng quà đổi mồi, giọng đọc nói rõ **"Cảm ơn bạn đã mua 50 mồi"** kèm lời chúc; quà lên cần thì đọc luôn hạng cần mới (Cần VIP / VIP2 / Thần Long).

## Chạy sân khấu

Yêu cầu Node.js (đã có v22 trên máy).

```bat
cd /d D:\Source\tool\cauca_onl
npm install
node bridge.js --demo
```

Mở **http://localhost:21214** để xem sân khấu với sự kiện giả lập của cầu nối. Mở file `live.html` trực tiếp cũng chơi thử được: bấm **⚙ Panel → Bật giả lập Demo** (người xem ảo tự câu, tự thả tim/giật, tặng quà).

Live thật:

```bat
node bridge.js ten_tiktok_cua_ban
```

(bỏ dấu @ ở đầu; tài khoản phải đang LIVE). Đưa sân khấu lên TikTok LIVE Studio bằng **Add source → Window Capture / Browser** trỏ vào cửa sổ trình duyệt mở http://localhost:21214, hoặc OBS Browser Source cùng địa chỉ, khung 1080×1920.

Cổng mặc định **21214** (khác 21213 của dichua_online nên hai sân khấu chạy cùng lúc không đụng nhau). Đổi cổng: `node bridge.js --port 21215 ten_tiktok`.

## Giọng đọc online

Mở sân khấu qua cầu nối (http://localhost:21214) thì trang tự lấy giọng mp3 từ endpoint `/tts` của `bridge.js` (Microsoft Edge TTS, giọng **vi-VN-HoaiMyNeural**, miễn phí, không cần key). Đổi giọng nam:

```bat
node bridge.js --voice vi-VN-NamMinhNeural ten_tiktok
```

Nếu mất mạng hoặc mở file trực tiếp, trang tự quay về giọng tiếng Việt có sẵn của trình duyệt (chỉ đọc khi máy có giọng vi — không bao giờ đọc bằng giọng tiếng Anh). Nút **🔊 Giọng Nói** trên sân khấu tắt/bật toàn bộ phần đọc.

## Ghi chú

- Sự kiện quà chuỗi (combo) chỉ tính khi dứt chuỗi (`repeatEnd`), giống bản dichua_online, để không tính trùng.
- Chưa kiểm chứng với phòng live thật: lần kiểm chứng đầu tiên cần anh lên live thật và chạy `node bridge.js ten_tiktok` trên máy của anh.
