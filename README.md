# 🎨 MINTLY — Sàn Đấu Giá NFT 1/1 "Chống Bùng Kèo" trên Solana

> Sàn giao dịch & đấu giá NFT 1/1 phi tập trung trên Solana, với escrow cọc 10% chống bùng kèo bằng smart contract, kiểm tra trùng lặp tác phẩm bằng AI trước khi mint, và hộ chiếu (passport) truy xuất nguồn gốc on-chain cho từng NFT.

Dự án làm cho **Mini Hackathon Solana**.

---

## 1. Dự án này làm gì?

MINTLY là một marketplace NFT 1/1 (mỗi NFT là độc bản, không phải bộ sưu tập nhiều bản) trên Solana, cho phép:

- **Vẽ/tạo tác phẩm và mint NFT** ngay trên web (canvas vẽ tay hoặc upload ảnh).
- **Kiểm tra trùng lặp bằng AI** trước khi mint, để hạn chế đạo nhái tác phẩm đã có trên sàn.
- **Đấu giá trực tiếp (English auction)** với cơ chế **cọc 10% qua smart contract escrow**: ai đặt giá cao hơn thì người bị vượt giá được tự động hoàn 100% tiền cọc ngay trên chain.
- **Thanh toán 90% còn lại + nhận NFT** khi thắng đấu giá — toàn bộ tiền và NFT đều di chuyển qua chương trình Anchor trên Solana, không phải giao dịch tay giữa hai ví.
- **Phạt bùng kèo**: nếu người thắng không thanh toán đúng hạn, tiền cọc 10% bị tịch thu vào quỹ xử phạt của sàn.
- **Đấu giá lại (resale) nhiều vòng**: một NFT đã bán vẫn có thể được đưa lên đấu giá vòng tiếp theo, tái sử dụng cùng một Auction PDA trên chain.
- **Bán giá cố định**: seller đăng tranh với giá cứng, người mua vào tab **Thị trường** để mua ngay; smart contract tự chia 5% phí sàn và 95% cho seller.
- **Hộ chiếu NFT (Passport)**: xem thông tin on-chain của một NFT (mint, supply, decimals, chủ sở hữu) và lịch sử chuyển nhượng qua các vòng đấu giá.
- **Trang quản trị (`/admin`)**: tạm dừng/mở lại toàn sàn, chỉ dành cho ví có quyền `authority`.

---

## 2. Kiến trúc tổng thể

```
Người dùng ─▶ FrontEnd (Next.js, client-side)
                 │
                 ├─▶ Solana Devnet (Anchor program "mintly-marketplace")
                 │      → nguồn sự thật duy nhất cho: giá, người thắng, trạng thái đấu giá,
                 │        tiền cọc, chuyển NFT, phí sàn, phạt bùng kèo
                 │
                 └─▶ MongoDB Atlas (qua Next.js API routes /api/*)
                        → cache off-chain: metadata tác phẩm (title/ảnh/mô tả),
                          lịch sử bán để hiển thị passport, bí mật reveal của bid,
                          fingerprint AI chống trùng lặp
```

Nguyên tắc thiết kế: **mọi thứ liên quan tới tiền và quyền sở hữu NFT (giá, người thắng, cọc, thanh toán, chuyển NFT) đều do chương trình Anchor trên Solana quyết định.** MongoDB chỉ lưu dữ liệu off-chain phụ trợ (ảnh, tên tác phẩm, lịch sử hiển thị, fingerprint AI) — không phải nguồn dữ liệu giá/tiền.

- **`BackEnd/`** — Solana Anchor program viết bằng Rust (`programs/mintly-marketplace`).
- **`FrontEnd/`** — Ứng dụng Next.js 16 (App Router) + TypeScript + Tailwind + Solana Wallet Adapter + MongoDB driver.

---

## 3. Chi tiết các tính năng & mức độ hoàn thiện

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Escrow PDA cọc 10%, auto-refund người bị vượt giá, thanh toán 90% + nhận NFT, phạt bùng kèo | ✅ Đã nối thật vào chương trình Anchor (`place_bid`, `pay_balance`, `default_winner`) | Tiền phạt bùng kèo vào **quỹ xử phạt của sàn** (`config.forfeiture_recipient`), không tự động chuyển cho Seller |
| 2 | Cơ chế Commit-Reveal đấu giá kín (SHA-256) | ⚙️ Có sẵn on-chain (`commit_bid.rs`, `reveal_bid.rs`) nhưng **không dùng trong luồng đấu giá hiện tại** | UI hiện tại hiển thị giá cao nhất công khai theo thời gian thực (English auction), không tương thích với mô hình "giấu giá tới khi hết giờ". Có thể làm tiếp ở bản v2 nếu muốn |
| 3 | AI kiểm tra trùng lặp ảnh trước khi mint | ✅ Hoạt động | Đa tín hiệu: perceptual hash (pHash + dHash, nhận diện cả ảnh lật/cắt/resize/nén lại) + layout + màu + embedding CLIP chạy ngay trên trình duyệt. Chỉ cảnh báo, không chặn mint. Xem mục 5.1 |
| 4 | NFT Passport + đấu giá lại nhiều vòng | ✅ Hoạt động | Passport hiển thị dữ liệu mint thật từ Solana + chuỗi lịch sử chuyển nhượng thật từ MongoDB. Vòng đấu giá lại tạo **Auction on-chain thật**, tái sử dụng cùng PDA khi vòng trước đã `SETTLED`/`CANCELLED` |
| 5 | Bán giá cố định qua tab `/market` | ✅ Hoạt động | Seller đăng giá cứng từ `/portfolio`, NFT khóa trong listing escrow; buyer mua ngay, smart contract chia 5% phí sàn và 95% cho seller |
| 6 | Trang quản trị `/admin` (pause/unpause sàn), hủy đấu giá khi chưa có ai đặt giá | ✅ Hoạt động | Chỉ ví `authority` của `MarketplaceConfig` mới thấy nút quản trị |
| 7 | Test tự động (`anchor test`) | ❌ Chưa làm | `BackEnd/tests/marketplace.ts` hiện chỉ có test giả (`assert.ok(true)`); các script trong `BackEnd/scripts/` là script test tay trên devnet, không phải test suite CI |

### Vì sao dữ liệu giá/đấu giá không còn nằm trong database?
Ban đầu một phần dữ liệu (bid, đấu giá lại, hộ chiếu) được giả lập bằng `localStorage`/bộ nhớ tạm để demo nhanh. Toàn bộ phần này đã được:
- Chuyển các dữ liệu **off-chain thật cần lưu lâu dài** (metadata tác phẩm, lịch sử bán để hiển thị, fingerprint AI, bí mật reveal bid) sang **MongoDB Atlas**.
- Chuyển các dữ liệu **quyết định tiền/quyền sở hữu** (giá hiện tại, người thắng, trạng thái đấu giá, cọc, thanh toán) về **đọc/ghi trực tiếp trên Solana**, bỏ hoàn toàn cơ chế giả lập song song từng có trong database.

---

## 4. Cấu trúc repository

```
BackEnd/
  programs/mintly-marketplace/src/
    instructions/   # create_auction, place_bid, pay_deposit, pay_balance, default_winner,
                     # cancel_auction, cancel_listing, commit_bid, reveal_bid,
                     # create_listing, buy_listing, pause/unpause_marketplace, manage_token...
    state/           # Auction, Bid, BidCommitment, Listing, MarketplaceConfig, TokenConfig
    constants.rs / errors.rs / events.rs / utils.rs
  tests/             # test suite Anchor (hiện là placeholder)
  scripts/           # script chạy tay trên devnet (initialize, create-auction, place-bid...)

FrontEnd/
  src/app/           # Next.js App Router: /, /market, /create, /auctions, /auctions/[id],
                     # /portfolio, /passport/[mint], /admin, /api/*
  src/lib/
    marketplace.ts   # gọi trực tiếp chương trình Anchor (đặt giá, thanh toán, hủy, admin...)
    data.ts          # đọc dữ liệu đấu giá/listing từ Solana
    artworkCache.ts  # cache MongoDB cho metadata tác phẩm & lịch sử bán (KHÔNG chứa giá/đấu giá)
    auction-crypto.ts# bí mật reveal bid + tiện ích commitment hash
    visionSimilarity.ts # engine kiểm tra trùng lặp ảnh (hash + embedding)
    ai.ts            # client: thu nhỏ ảnh, SHA-256, embedding CLIP trên trình duyệt
    fingerprint/     # features.ts (sharp, pHash/dHash...), embedding.client.ts (CLIP)
  src/data/site-fingerprints.json # fingerprint tính sẵn của tác phẩm trong public/assets
  src/lib/db/        # các module MongoDB (artworks, sales, bidSecrets, fingerprints)
  src/app/api/       # API route Next.js làm cầu nối tới MongoDB
```

---

## 5. Cài đặt & chạy thử

### FrontEnd
```bash
cd FrontEnd
npm install
```

Tạo file `FrontEnd/.env.local` (không commit lên git):
```bash
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/MINTLY"
MONGODB_DB="MINTLY"

# Tuỳ chọn — mặc định đã trỏ tới devnet + program đã deploy sẵn
NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID="Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq"
NEXT_PUBLIC_PAYMENT_MINT="So11111111111111111111111111111111111111112"
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
NEXT_PUBLIC_SOLANA_NETWORK="devnet"
```

```bash
npm run dev
```

Mở `http://localhost:3000`, kết nối ví Phantom (chuyển sang **Devnet**) để dùng thử.

### BackEnd (chương trình Anchor)
Yêu cầu: Rust, Solana CLI, Anchor CLI đã cài trên máy (xem script cài đặt tham khảo trong `BackEnd/scripts/install-solana.sh`).

```bash
cd BackEnd
anchor build
anchor deploy         # deploy lên cluster khai báo trong Anchor.toml (mặc định: devnet)
```

Chương trình đã deploy sẵn ở địa chỉ `Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq` trên Devnet — không cần deploy lại nếu chỉ chạy thử FrontEnd.

### 5.1. Kiểm tra trùng lặp ảnh (AI Similarity)

Cách hoạt động (tối ưu cho Vercel, không chạy model nặng trong serverless function):

1. **Trình duyệt** thu nhỏ ảnh ≤768px, tính SHA-256 và chạy **CLIP (ViT-B/32, int8)** bằng `@huggingface/transformers` → vector 512 chiều. Model (~90MB) tải một lần từ Hugging Face rồi được trình duyệt cache.
2. Gửi thumbnail + SHA-256 + embedding tới `POST /api/ai/similarity`.
3. **Server** (`sharp`) tính pHash, dHash (kể cả bản lật và các vùng cắt), layout 16×16, histogram màu, rồi đối chiếu với: catalogue có sẵn (`src/data/site-fingerprints.json`) + mọi NFT đã mint (MongoDB `artwork_fingerprints`).
4. Điểm cuối = tín hiệu mạnh nhất trong hash / embedding / tổ hợp layout+màu. Ngưỡng: ≥75% cảnh báo cao, ≥40% trung bình. Kết quả phân loại: bản sao y hệt / ảnh chỉnh sửa / nhái phong cách.
5. Trước khi mint, hệ thống quét lại đúng ảnh sắp mint và ghi pHash + điểm nguyên bản vào metadata NFT. Sau khi mint thành công, fingerprint được đăng ký (`action: "register"`).

**Khi thêm/đổi ảnh trong `public/assets`**, tạo lại fingerprint (lần đầu sẽ tải model ~90MB) rồi commit file JSON:

```bash
cd FrontEnd
npm run fingerprints
```

Biến môi trường tuỳ chọn: `MINTLY_AI_PROVIDER_URL` — nếu đặt, API sẽ ưu tiên gọi `${URL}/analyze` (cùng định dạng response), lỗi thì quay về engine tích hợp.

---

## 6. Quy trình đấu giá (end-to-end)

1. **Tạo tác phẩm** (`/create`): vẽ hoặc upload ảnh → AI quét trùng lặp → mint NFT lên Solana (Metaplex) → lưu metadata vào MongoDB.
2. **Đưa lên đấu giá** (từ `/portfolio`): gọi `create_auction` — NFT bị khoá vào escrow PDA, tạo Auction on-chain, trạng thái `LIVE`.
3. **Đặt giá** (`/auctions/[id]`): gọi `place_bid` — 10% giá đặt được chuyển vào escrow; người bị vượt giá trước đó được tự động hoàn 100% cọc ngay trong cùng transaction.
4. **Hết giờ, người thắng thanh toán** (`pay_balance`): trả phần còn lại (giá thắng trừ cọc đã nạp) → sàn tự động chia phí (5%) cho treasury, phần còn lại cho seller, và chuyển NFT cho người thắng — tất cả trong 1 transaction.
5. **Bùng kèo** (`default_winner`): nếu quá hạn thanh toán, ai cũng có thể gọi để tịch thu cọc 10% vào quỹ xử phạt của sàn.
6. **Đấu giá lại**: seller (chủ mới) có thể đưa NFT đó lên đấu giá vòng tiếp — tái sử dụng đúng Auction PDA của NFT này.

---

## 7. Hạn chế đã biết (để làm tiếp nếu phát triển thêm)

- Chưa có test suite tự động cho chương trình Anchor.
- AI kiểm tra trùng lặp: chưa bắt được ảnh vừa lật vừa đổi màu, hoặc ảnh thêm viền dày; embedding do trình duyệt tính nên có thể bị giả mạo (chấp nhận được vì chỉ cảnh báo). So sánh đang duyệt tuyến tính — khi có hàng chục nghìn NFT nên chuyển sang MongoDB Atlas Vector Search. NFT mint trước bản nâng cấp chỉ khớp theo SHA-256.
- Commit-reveal sealed-bid đã có sẵn on-chain nhưng chưa được tích hợp vào UI đấu giá (đang dùng mô hình đấu giá công khai kiểu English auction).
- Chưa có UI hủy listing (`cancel_listing`) — chỉ có hủy auction.

---

## 8. Công nghệ sử dụng

- **On-chain**: Rust, Anchor Framework, SPL Token, Solana Devnet.
- **FrontEnd**: Next.js 16 (App Router), TypeScript, Tailwind CSS, `@coral-xyz/anchor`, `@solana/wallet-adapter-react`, `@solana/web3.js`.
- **Off-chain data**: MongoDB Atlas (driver `mongodb` native, không dùng ORM).
