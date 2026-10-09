# MINTLY — Sàn Đấu Giá NFT 1/1 "Chống Bùng Kèo" trên Solana

> Sàn giao dịch & đấu giá NFT 1/1 phi tập trung trên Solana, với escrow cọc 10% chống bùng kèo bằng smart contract, kiểm tra trùng lặp tác phẩm bằng AI trước khi mint, và hộ chiếu (passport) truy xuất nguồn gốc on-chain cho từng NFT.

Dự án làm cho **Mini Hackathon Solana**.

> **Định vị:** Mintly là sàn đấu giá tác phẩm số 1/1 với *bằng chứng nguyên bản* — không phải game, DEX hay sản phẩm yield; không có LP/staking/play-to-earn. Số liệu hiển thị là **Devnet, dữ liệu thử nghiệm, không phải traction**. Xem [kinh tế đơn vị](docs/ECONOMICS.md), [định vị & GTM](docs/GTM.md) và trang `/legal` (rủi ro pháp lý tại Việt Nam).


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
- **Bảo hiểm bùng kèo**: cọc bị tịch thu chia 70% cho tác giả/seller, 30% cho quỹ sàn *(cần deploy hợp đồng mới)*.
- **Chống bid sát giờ**: bid trong 60 giây cuối tự gia hạn thêm 60 giây *(cần deploy hợp đồng mới)*.
- **Đấu giá realtime**: giá và thời gian cập nhật ngay khi tài khoản Auction trên Solana thay đổi; thông báo khi bị vượt giá hoặc phiên được gia hạn.
- **Proof-of-Creation**: Studio ghi time-lapse quá trình vẽ; mã băm SHA-256 được neo on-chain bằng SPL Memo trong giao dịch mint; passport phát lại quá trình vẽ và đối chiếu Memo.
- **Vẽ trực tiếp (`/live`)**: phát canvas theo thời gian thực để người xem theo dõi và đặt giá khi tác phẩm lên sàn.
- **Chặn sao chép khi mint**: ảnh trùng khớp bị từ chối; ảnh giống nhiều phải cam kết và ký bằng ví.
- **Kiểm tra nguyên bản miễn phí (`/originality`)**: không cần ví, không mint.
- **Uy tín người mua, nhãn nguyên bản, khiếu nại đạo nhái, thưởng báo cáo, QR hộ chiếu** — xem bảng ở mục 3.
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
| 1 | Escrow PDA cọc 10%, auto-refund người bị vượt giá, thanh toán 90% + nhận NFT, phạt bùng kèo | Đã nối thật vào chương trình Anchor (`place_bid`, `pay_balance`, `default_winner`) | Sau khi deploy bản mới: 70% tiền phạt chuyển cho Seller, 30% vào quỹ sàn (`config.forfeiture_recipient`) |
| 2 | Cơ chế Commit-Reveal đấu giá kín (SHA-256) | Có sẵn on-chain (`commit_bid.rs`, `reveal_bid.rs`) nhưng **không dùng trong luồng đấu giá hiện tại** | UI hiện tại hiển thị giá cao nhất công khai theo thời gian thực (English auction), không tương thích với mô hình "giấu giá tới khi hết giờ". Có thể làm tiếp ở bản v2 nếu muốn |
| 3 | AI kiểm tra trùng lặp ảnh trước khi mint | Hoạt động | Đa tín hiệu: perceptual hash (pHash + dHash, nhận diện cả ảnh lật/cắt/resize/nén lại) + layout + màu + embedding CLIP chạy ngay trên trình duyệt. Chỉ cảnh báo, không chặn mint. Xem mục 5.1 |
| 4 | NFT Passport + đấu giá lại nhiều vòng | Hoạt động | Passport hiển thị dữ liệu mint thật từ Solana + chuỗi lịch sử chuyển nhượng thật từ MongoDB. Vòng đấu giá lại tạo **Auction on-chain thật**, tái sử dụng cùng PDA khi vòng trước đã `SETTLED`/`CANCELLED` |
| 5 | Bán giá cố định qua tab `/market` | Hoạt động | Seller đăng giá cứng từ `/portfolio`, NFT khóa trong listing escrow; buyer mua ngay, smart contract chia 5% phí sàn và 95% cho seller |
| 6 | Trang quản trị `/admin` (pause/unpause sàn), hủy đấu giá khi chưa có ai đặt giá | Hoạt động | Chỉ ví `authority` của `MarketplaceConfig` mới thấy nút quản trị |
| 8 | **Bảo hiểm bùng kèo** | Đã sửa code Rust, **chưa build/deploy** | `default_winner` chia cọc bị tịch thu: 70% cho seller (`SELLER_FORFEIT_BPS`), 30% cho quỹ sàn. Thêm account `seller_payment_account` (IDL + frontend đã cập nhật). Cần `anchor build && anchor deploy` mới dùng được |
| 9 | **Chống bid sát giờ** | Đã sửa code Rust, **chưa build/deploy** | Bid trong 60s cuối đẩy `end_time` thành `now + 60s` (`place_bid.rs`) |
| 10 | Đấu giá realtime | Hoạt động | `connection.onAccountChange` trên Auction PDA + thông báo gia hạn / bị vượt giá |
| 11 | Proof-of-Creation | Hoạt động | Studio ghi time-lapse nét vẽ; SHA-256 của trace được neo on-chain bằng **SPL Memo** trong chính giao dịch mint; passport replay và đối chiếu mã băm với Memo đọc từ chain. Chỉ là bằng chứng bổ sung, vẫn có thể dựng trace giả bằng kỹ thuật |
| 12 | Uy tín người mua | Hoạt động (hiển thị) | Đếm auction `DEFAULTED` đọc từ chain + giao dịch đã thanh toán. Chưa ép buộc on-chain (cọc thích ứng cần sửa hợp đồng) |
| 13 | Nhãn nguyên bản + khiếu nại | Hoạt động | Điểm AI hiện trên passport; khiếu nại ký bằng ví (Ed25519 `signMessage`); admin xử lý bằng chữ ký của `authority` đọc từ MarketplaceConfig |
| 14 | Royalty bán lại | Chưa làm | NFT hiện là SPL mint thường, **không có Metaplex Token Metadata** (metadata chỉ là data-URI giả, chưa lên IPFS/Arweave). Muốn có royalty đúng chuẩn Solana phải tạo Token Metadata (`seller_fee_basis_points`, `creators`) khi mint rồi đọc trong `pay_balance` |
| 15 | **Vẽ trực tiếp (Live Drawing)** | Hoạt động | Studio phát khung canvas ~1.5s/lần (`/api/live`, MongoDB, ký ví Ed25519 để bắt đầu); người xem vào `/live/[ví]`, thấy đấu giá đang mở của nghệ sĩ đọc từ Solana. Polling, chưa phải WebSocket |
| 16 | **Chặn sao chép khi mint** | Hoạt động | Ảnh trùng khớp hoàn toàn (`EXACT`) bị chặn; giống cao phải tick cam kết và ký `MINTLY_ATTEST` bằng ví, chữ ký ghi vào metadata. Kiểm tra ở frontend, người dùng kỹ thuật vẫn có thể mint thẳng qua chương trình SPL |
| 17 | **Hộ chiếu QR** | Hoạt động | Passport có mã QR tải được dẫn tới trang xác thực |
| 18 | **Thưởng báo cáo đạo nhái** | Ghi sổ | Khiếu nại được chấp nhận ghi 0.05 SOL cho người báo cáo; admin chi trả thủ công, chưa tự động on-chain |
| 19 | **Studio nhiều cọ** | Hoạt động | 9 cọ (bút chì, bút mực, bút dạ, phun sơn, **màu nước**, **sáp màu**, than, bụi sơn, pixel) + công cụ **blend/smudge**, tẩy, đổ màu, lấy màu, chữ. Nhận lực nhấn bút cảm ứng (`pressure`). Engine tự viết trong `src/lib/paint/brushes.ts` |
| 20 | **Layers** | Hoạt động | Thêm/xóa/nhân bản/gộp lớp, ẩn hiện, độ mờ, chế độ hòa trộn (multiply, screen, overlay…), đổi tên, sắp xếp; hoàn tác/làm lại cho cả thao tác lớp |
| 21 | **Bản nháp + xác nhận rời trang** | Hoạt động | Lưu nháp vào IndexedDB (tự lưu mỗi 20 giây khi có thay đổi), khôi phục khi quay lại; hộp thoại xác nhận khi bấm link rời Studio và cảnh báo khi đóng tab. Chưa chặn được nút Back của trình duyệt (Next.js App Router) |
| 7 | Test tự động (`anchor test`) | Chưa làm | `BackEnd/tests/marketplace.ts` hiện chỉ có test giả (`assert.ok(true)`); các script trong `BackEnd/scripts/` là script test tay trên devnet, không phải test suite CI |

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

> **Trang & API mới:** `/live`, `/live/[ví]`, `/originality`, `/legal`; API `/api/proofs`, `/api/disputes`, `/api/live` (đều dùng MongoDB, cần `MONGODB_URI`).
> **Thư viện mới:** `qrcode` (+ `@types/qrcode`) — chạy `npm install` sau khi pull.

### Kiểm thử thủ công
Xem [docs/TESTING.md](docs/TESTING.md) để chạy từng luồng chính và từng tính năng mới.

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

1. **Tạo tác phẩm** (`/create`): vẽ hoặc upload ảnh → AI quét trùng lặp → mint NFT lên Solana (SPL Token 1/1 + Memo bằng chứng sáng tác) → lưu metadata vào MongoDB.
2. **Đưa lên đấu giá** (từ `/portfolio`): gọi `create_auction` — NFT bị khoá vào escrow PDA, tạo Auction on-chain, trạng thái `LIVE`.
3. **Đặt giá** (`/auctions/[id]`): gọi `place_bid` — 10% giá đặt được chuyển vào escrow (bid trong 60 giây cuối sẽ gia hạn phiên thêm 60 giây); người bị vượt giá trước đó được tự động hoàn 100% cọc ngay trong cùng transaction.
4. **Hết giờ, người thắng thanh toán** (`pay_balance`): trả phần còn lại (giá thắng trừ cọc đã nạp) → sàn tự động chia phí (5%) cho treasury, phần còn lại cho seller, và chuyển NFT cho người thắng — tất cả trong 1 transaction.
5. **Bùng kèo** (`default_winner`): nếu quá hạn thanh toán, ai cũng có thể gọi để tịch thu cọc 10%: **70% bồi thường cho seller, 30% vào quỹ sàn** (sau khi deploy hợp đồng mới).
6. **Đấu giá lại**: seller (chủ mới) có thể đưa NFT đó lên đấu giá vòng tiếp — tái sử dụng đúng Auction PDA của NFT này.

---

## 7. Hạn chế đã biết (để làm tiếp nếu phát triển thêm)

- Chưa có test suite tự động cho chương trình Anchor.
- AI kiểm tra trùng lặp: chưa bắt được ảnh vừa lật vừa đổi màu, hoặc ảnh thêm viền dày; embedding do trình duyệt tính nên có thể bị giả mạo (chấp nhận được vì chỉ cảnh báo). So sánh đang duyệt tuyến tính — khi có hàng chục nghìn NFT nên chuyển sang MongoDB Atlas Vector Search. NFT mint trước bản nâng cấp chỉ khớp theo SHA-256.
- Commit-reveal sealed-bid đã có sẵn on-chain nhưng chưa được tích hợp vào UI đấu giá (đang dùng mô hình đấu giá công khai kiểu English auction).
- Phiên mô phỏng của script `devnet_sim.mjs` không xóa được khỏi chuỗi (chương trình không có lệnh đóng account), nên bị loại khỏi mọi danh sách và thống kê qua `SIMULATED_SELLERS` trong `config.ts`; vẫn mở được bằng link trực tiếp.
- Xóa tác phẩm ở `/portfolio` yêu cầu ví ký tin nhắn `MINTLY_DELETE`, burn NFT (đóng token account, hoàn rent) rồi xóa bản ghi trong MongoDB.
- Hợp đồng deployed tạo PDA phiên đấu giá bằng `init` (không phải `init_if_needed` như mã nguồn), nên **mỗi NFT chỉ có một phiên duy nhất**: mint đã từng có phiên (mở, hủy hoặc chốt) không thể đấu giá lại, giao dịch thất bại với "account already in use" (Phantom báo "Unexpected error"). Frontend kiểm tra trước và báo rõ lý do; muốn đấu giá lại cần deploy hợp đồng mới.
- Chặn người bán tự đặt giá vào phiên của mình: đã chặn ở frontend; ràng buộc on-chain (`SellerCannotBid` trong `place_bid.rs`) chỉ có hiệu lực sau khi deploy lại hợp đồng, nên gọi trực tiếp bản deployed vẫn bypass được.
- Chưa có UI hủy listing (`cancel_listing`) — chỉ có hủy auction.
- **Hợp đồng đã sửa nhưng chưa build/deploy** (bảo hiểm bùng kèo 70/30, chống bid sát giờ): cần `anchor build && anchor deploy`; tới khi đó nút xử lý bùng kèo trên frontend sẽ lỗi vì IDL đã thêm account `seller_payment_account`.
- NFT là SPL mint thường, **không có Metaplex Token Metadata**; metadata hiện là data-URI (chưa lên IPFS/Arweave). Vì vậy chưa có royalty bán lại.
- Cọc thích ứng theo uy tín chưa có (`place_bid` cố định 10%); điểm uy tín chỉ hiển thị, không ép buộc on-chain.
- Chặn sao chép khi mint chỉ ở frontend; thưởng báo cáo đạo nhái mới ghi sổ, admin chi trả thủ công.
- Phát trực tiếp dùng polling (~1.5s), chưa phải WebSocket.
- Proof-of-Creation chứng minh tính toàn vẹn của dữ liệu quá trình vẽ, không chống được việc dựng dữ liệu giả có chủ đích.
- Số liệu hiển thị là **Devnet / dữ liệu thử nghiệm**, không phải traction thị trường.
- **Chương trình đang chạy trên Devnet khác với mã nguồn trong repo** (phát hiện khi chạy `devnet_sim.mjs`): bản deployed thu cọc **100%** giá đặt (nguồn: 10%), chỉ cho **một lượt đặt giá mỗi phiên** (account escrow đòi chữ ký keypair → lỗi `ConstraintSigner` ở lượt thứ hai), `fee_bps` on-chain là 250 (2.5%) trong khi hằng số frontend/UI ghi 5%, và IDL `pay_balance` không có tham số. Frontend đã được chỉnh để tương thích (`placeBidOnChain` không yêu cầu escrow ký khi đã tồn tại; `payBalance()` không tham số). Muốn khớp hoàn toàn cần `anchor build && anchor deploy` lại từ mã nguồn.
- Script mô phỏng `FrontEnd/scripts/devnet_sim.mjs` chạy trọn vòng đời trên Devnet: mint → tạo phiên → đặt giá → `finalize_auction` → `pay_deposit` → `pay_balance` (8 phiên đã settle thật). Hợp đồng deployed bắt buộc `finalize_auction` trước khi thanh toán; trang `/settlement` đã tự gọi bước này. Dữ liệu mô phỏng luôn gắn `simulated: true`.
- `FrontEnd/scripts/init_marketplace.mjs` chứa secret key ghi cứng của ví Devnet dùng để khởi tạo — chỉ dùng cho Devnet, không dùng cho Mainnet và nên thay bằng biến môi trường.

---

## 7.1. Hệ thiết kế ("Proof of Hand")

- Mực đen + giấy xương + một màu nhấn đỏ cam; chữ **Fraunces** (tiêu đề), **JetBrains Mono** (nhãn/số liệu), **Be Vietnam Pro** (nội dung, hỗ trợ tiếng Việt).
- Chuyển động bằng **GSAP + ScrollTrigger** (hero reveal, cuộn ngang ghim, parallax, chữ sáng dần theo cuộn) và **Lenis** (cuộn mượt). Tôn trọng `prefers-reduced-motion`.
- Thành phần dùng chung: `components/motion/*` (Reveal, Parallax, Marquee, Cursor), `components/layout/PageHero`, `ArtworkCard` (nhãn bảo tàng). Token màu và tiện ích (`.btn`, `.mega`, `.eyebrow`, `.reg`, `.scan`) nằm trong `src/app/globals.css`.
- Lưu ý: nếu tab trình duyệt bị ẩn, hiệu ứng GSAP tạm dừng (trình duyệt ngừng `requestAnimationFrame`) và tiếp tục khi hiện lại.

## 8. Tài liệu bổ sung

- [docs/ECONOMICS.md](docs/ECONOMICS.md) — kinh tế đơn vị, điểm hòa vốn.
- [docs/GTM.md](docs/GTM.md) — định vị và lộ trình tiếp cận thị trường.
- [docs/TESTING.md](docs/TESTING.md) — hướng dẫn kiểm thử thủ công.
- Trang `/legal` — ranh giới pháp lý và rủi ro (không phải cờ bạc, không phải chứng khoán).

## 9. Công nghệ sử dụng

- **On-chain**: Rust, Anchor Framework, SPL Token, Solana Devnet.
- **FrontEnd**: Next.js 16 (App Router), TypeScript, Tailwind CSS, `@coral-xyz/anchor`, `@solana/wallet-adapter-react`, `@solana/web3.js`.
- **Off-chain data**: MongoDB Atlas (driver `mongodb` native, không dùng ORM).
