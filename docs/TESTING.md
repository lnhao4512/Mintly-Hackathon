# Hướng dẫn kiểm thử thủ công

## 0. Chuẩn bị
1. `cd FrontEnd && npm install` (có thư viện mới `qrcode`).
2. Tạo `FrontEnd/.env.local` với `MONGODB_URI` và `MONGODB_DB` (xem README mục 5).
3. `npm run dev` → mở http://localhost:3000.
4. Phantom: Cài đặt > Nhà phát triển > bật **Chế độ Testnet** và chọn **Solana Devnet** (không dùng ví Mainnet), có SOL Devnet (airdrop). App tự chặn giao dịch nếu RPC không phải Devnet. Cần **2 ví**: A (seller/tác giả), B (người mua). Dùng hai profile trình duyệt hoặc hai tài khoản Phantom.
5. Nếu muốn thử bảo hiểm bùng kèo / chống bid sát giờ: `cd BackEnd && anchor build && anchor deploy` trước.

## 1. Luồng chính (làm trước)
| # | Bước | Kết quả mong đợi |
|---|---|---|
| 1 | Ví A vào `/create`, vẽ vài nét, đặt tên | Canvas vẽ được |
| 2 | Bấm **Mint** | AI quét xong, hiện điểm nguyên bản; xác nhận mint trong Phantom |
| 3 | Vào `/portfolio` | Thấy NFT vừa mint |
| 4 | Đưa lên đấu giá (giá khởi điểm nhỏ, ví dụ 0.1 SOL, thời lượng vài phút) | Phiên `LIVE` xuất hiện ở `/auctions` |
| 5 | Ví B đặt giá | 10% cọc bị khóa vào escrow |
| 6 | Ví A hoặc B đặt giá cao hơn | Người bị vượt được hoàn cọc ngay |
| 7 | Hết giờ, ví B vào trang phiên → thanh toán 90% còn lại | NFT về ví B, trạng thái `SETTLED` |
| 8 | Trang chủ | "Settled Volume" > 0 và đúng bằng giá bán |

## 2. Tính năng mới
**Không cần deploy hợp đồng**
- **Banner Devnet & số liệu thật:** banner cam ở đầu mọi trang; trang chủ chưa có giao dịch → `0.00 SOL`.
- **`/legal`:** đổi ngôn ngữ EN/VI; link ở footer.
- **`/originality`:** tải ảnh khi **chưa kết nối ví** → có điểm nguyên bản. Lần đầu tải model ~90MB.
- **Realtime:** mở trang phiên ở hai tab (ví A, ví B). Đặt giá ở tab này → tab kia đổi giá trong ~1 giây, không cần tải lại. Người bị vượt thấy thông báo vàng.
- **Proof-of-Creation:** mint một tranh **vẽ tay** (không upload ảnh) → mở `/passport/<mint>`: thấy replay quá trình vẽ, "khớp mã băm", và "khớp Memo on-chain". Mint bằng ảnh upload → nhãn "Có ảnh nhập vào".
- **QR hộ chiếu:** trong passport, quét bằng điện thoại (máy và điện thoại cùng mạng, hoặc dùng domain deploy) hoặc bấm "Tải mã QR".
- **Chặn sao chép:** ở `/create`, upload lại một ảnh đã có trong catalogue (`public/assets`) rồi Mint → hộp thoại "Không thể mint". Sửa nhẹ ảnh (đổi kích thước/nén) → hộp thoại yêu cầu tick cam kết + ký ví.
- **Khiếu nại:** ở passport của một NFT, nhập lý do (≥ 10 ký tự), "Ký bằng ví & gửi" → hiện "Đang bị khiếu nại (1)". Vào `/admin` bằng ví `authority` → thấy danh sách, bấm **Chấp nhận** → passport hiện "Khiếu nại được chấp nhận" kèm "Thưởng 0.05 SOL — chờ chi trả".
- **Uy tín người mua:** trang phiên có người dẫn đầu → huy hiệu cạnh địa chỉ ("Người mới", "Uy tín", "Từng bùng kèo").
- **Vẽ trực tiếp:** ví A ở `/create` bấm "Phát trực tiếp phiên vẽ" (ký ví), vẽ. Tab khác mở `/live` → thấy phiên; bấm vào xem canvas cập nhật ~1.5s. Bấm dừng → trạng thái "Đã kết thúc".

**Cần deploy hợp đồng mới**
- **Chống bid sát giờ:** tạo phiên ngắn; đặt giá khi còn < 60s → thời gian đếm ngược nhảy thành ~60s, tab kia hiện thông báo gia hạn.
- **Bảo hiểm bùng kèo:** ví B thắng nhưng **không thanh toán**; chờ quá hạn thanh toán → bấm xử lý bùng kèo. Kiểm tra trên Solana Explorer (Devnet): 70% cọc về ví A, 30% về ví `forfeiture_recipient`.

## 3. Nếu lỗi
- `/api/*` trả 500: thiếu hoặc sai `MONGODB_URI`.
- Nút xử lý bùng kèo lỗi: chưa deploy hợp đồng mới (IDL đã có account `seller_payment_account`).
- Memo "không tìm thấy": NFT mint trước tính năng này, hoặc RPC công khai không trả giao dịch cũ.
- Phantom không ký được message: dùng Phantom (ví hỗ trợ `signMessage`), không dùng ví chỉ ký giao dịch.

## 4. Giao dịch mô phỏng trên Devnet (để làm dữ liệu thuyết trình)

Script `FrontEnd/scripts/devnet_sim.mjs` chạy **giao dịch thật** trên Devnet với ví do script tự tạo (người dùng mô phỏng): mint NFT → tạo đấu giá → đặt giá → `finalize_auction` → `pay_deposit` → `pay_balance`. Nếu bị gián đoạn, chạy `npm run sim:devnet -- --settle` để settle các phiên còn dở. Mỗi vòng ~11 giao dịch, 3 vòng ≈ 35 giao dịch. Mọi chữ ký xem được trên Solana Explorer.

```bash
cd FrontEnd
npm run sim:devnet -- --auctions 3
```

- Cần ~0.4 SOL Devnet (giá đấu nhỏ 0.01–0.02 SOL nên rất rẻ) gửi vào địa chỉ **seller** mà script in ra (faucet.solana.com); script chia lại cho hai ví đặt giá. Hoặc đặt `FUNDER_KEYPAIR=<file json>`.
- Nên dùng RPC riêng: `SOLANA_RPC_URL=<helius/quicknode>` (RPC công cộng giới hạn rất gắt).
- Kết quả ghi vào `FrontEnd/scripts/sim-output/*.json` (kèm link Explorer) và, nếu app đang chạy, vào MongoDB với cờ `simulated: true`. **Khi thuyết trình phải nói rõ đây là dữ liệu mô phỏng, không phải traction.**
