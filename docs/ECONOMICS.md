# Kinh tế đơn vị (Unit economics)

Mintly **không phát hành "real yield"** và không trả thưởng SOL cho người chơi/LP. Doanh thu duy nhất là **phí sàn trên giao dịch đã thanh toán thật** (`fee_bps` trong `MarketplaceConfig`, mặc định 2.5%) — thu khi `pay_balance`/`buy_listing` thành công. Tiền phạt bùng kèo (10% cọc) chia 70% cho seller và 30% vào quỹ sàn (sau khi deploy bản hợp đồng mới), **không tính là doanh thu dự phóng**.

## Công thức
`Doanh thu tháng = Khối lượng đã thanh toán (SOL) × 2.5%`

## Điểm hòa vốn (giả định: 1 SOL = 150 USD, chi phí vận hành 600 USD/tháng: RPC + MongoDB + hosting + domain)

| Chỉ số | Giá trị |
|---|---|
| Doanh thu cần để hòa vốn | 600 USD ≈ 4 SOL/tháng |
| Khối lượng cần | 4 / 0.025 = **160 SOL/tháng ≈ 24.000 USD** |
| Giá bán trung bình giả định | 0.5 SOL (≈ 75 USD) |
| Số giao dịch/tháng | **~320** (≈ 11/ngày) |
| Nếu 15% người xem mua 1 tác phẩm/tháng | ~2.100 người dùng hoạt động |

Để có lương cho 3 người (≈ 6.000 USD/tháng): ~1.600 SOL khối lượng/tháng ≈ 3.200 giao dịch — cần ~21.000 người dùng hoạt động ở tỉ lệ chuyển đổi trên. Đây là con số mục tiêu, **chưa đạt được**.

## Nguồn doanh thu bổ sung (không phụ thuộc đầu cơ)
1. Phí mint có kiểm tra nguyên bản (gói trường học/studio, thu bằng SOL hoặc VND qua đối tác).
2. Phí "Passport Verify" cho bên thứ ba muốn xác thực tác phẩm (API).
3. Royalty sàn trên bán lại (đề xuất v2).

## Số liệu hiện tại
Mọi số liệu trên giao diện là **Devnet / dữ liệu thử nghiệm**. Trang chủ chỉ cộng giá của các giao dịch đã `pay_balance` (bảng `sales`); không còn công thức ước lượng.
