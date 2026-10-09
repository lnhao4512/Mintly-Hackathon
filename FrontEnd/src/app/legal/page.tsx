"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/layout/PageHero";
import { FadeUp } from "@/components/motion/Reveal";
import { useI18n } from "@/lib/i18n";

const content = {
  vi: {
    title: "Pháp lý & Rủi ro",
    sections: [
      ["Mintly là gì — và không là gì", "Mintly là sàn đấu giá tác phẩm số 1/1 có kiểm tra nguyên bản và hộ chiếu nguồn gốc. Mintly KHÔNG phải trò chơi may rủi, KHÔNG có cơ chế play-to-earn, KHÔNG cung cấp staking, pool thanh khoản (LP), lợi suất (yield) hay bất kỳ sản phẩm đầu tư nào. Không có token của Mintly và không có lời hứa sinh lời."],
      ["Không phải cờ bạc", "Kết quả đấu giá do giá người mua tự đặt quyết định, không có yếu tố ngẫu nhiên. Tiền cọc 10% chỉ bị tịch thu khi người thắng tự bỏ không thanh toán (70% bồi thường cho tác giả/seller, 30% vào quỹ sàn); đây là cơ chế bảo đảm thực hiện hợp đồng, không phải tiền thưởng."],
      ["Không phải chứng khoán", "Mỗi NFT là một tác phẩm độc bản, không chia nhỏ quyền sở hữu, không cam kết lợi nhuận và không gắn với doanh nghiệp nào. Người mua mua tác phẩm để sở hữu/sưu tầm, không phải để nhận cổ tức."],
      ["Phạm vi hiện tại: Devnet", "Sản phẩm đang chạy trên Solana Devnet. SOL trên Devnet không có giá trị thật; mọi số liệu giao dịch là dữ liệu thử nghiệm, không phải traction thị trường."],
      ["Khung pháp lý Việt Nam", "Việt Nam chưa công nhận tiền mã hóa là phương tiện thanh toán hợp pháp; tài sản số đang được thí điểm quản lý theo Nghị quyết 05/2025/NQ-CP. Trước khi chạy mainnet với tiền thật, Mintly sẽ: (1) xin ý kiến tư vấn pháp lý, (2) chặn địa lý các khu vực hạn chế, (3) hạn mức giao dịch thấp giai đoạn đầu, (4) chỉ bán tác phẩm nghệ thuật, không bán công cụ đầu cơ."],
      ["Dữ liệu cá nhân", "Mintly chỉ lưu địa chỉ ví, metadata tác phẩm và fingerprint ảnh. Không thu thập CCCD, ngân hàng hay thông tin tài chính."],
      ["Rủi ro bạn cần biết", "Giá NFT có thể về 0; giao dịch on-chain không thể hoàn tác; AI kiểm tra trùng lặp chỉ mang tính cảnh báo, không phải kết luận pháp lý về bản quyền; hợp đồng thông minh chưa được kiểm toán độc lập."],
    ],
  },
  en: {
    title: "Legal & Risk",
    sections: [
      ["What Mintly is — and is not", "Mintly is a 1/1 digital-art auction house with originality checks and provenance passports. It is NOT a game of chance, has NO play-to-earn, and offers NO staking, liquidity pools, yield or any investment product. There is no Mintly token and no promise of returns."],
      ["Not gambling", "Auction outcomes are decided by prices buyers choose; there is no randomness. The 10% deposit is only forfeited if a winner walks away (70% compensates the seller, 30% goes to the platform); it is performance security, not a prize."],
      ["Not a security", "Each NFT is a unique artwork: no fractional ownership, no profit promise, no link to any enterprise. Buyers acquire art to own or collect, not to receive dividends."],
      ["Current scope: Devnet", "The product runs on Solana Devnet. Devnet SOL has no real value; all transaction figures are test data, not market traction."],
      ["Vietnam regulatory context", "Vietnam does not recognise crypto as legal tender; digital assets are under a pilot regime (Resolution 05/2025/NQ-CP). Before any mainnet launch with real money Mintly will: (1) obtain legal counsel, (2) geo-block restricted regions, (3) cap early transaction sizes, (4) sell art only, never speculative instruments."],
      ["Personal data", "Mintly stores only wallet addresses, artwork metadata and image fingerprints. No national ID, banking or financial data is collected."],
      ["Risks you should know", "NFT prices can go to zero; on-chain transactions are irreversible; AI duplicate detection is a warning, not a legal copyright finding; the smart contract has not been independently audited."],
    ],
  },
} as const;

export default function LegalPage() {
  const { locale } = useI18n();
  const c = content[locale];
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-bg text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <PageHero
          eyebrow="Fine print"
          index="05 / Legal"
          lines={[c.title.split(" & ")[0] + " &", <em key="r">{c.title.split(" & ")[1]}</em>]}
        />
        <div className="border-t border-line">
          {c.sections.map(([h, p], i) => (
            <FadeUp key={h}>
              <section className="grid gap-4 border-b border-line py-8 md:grid-cols-12 md:gap-10 md:py-10">
                <span className="font-mono-ui text-[11px] tracking-[0.16em] text-text-dim md:col-span-1">0{i + 1}</span>
                <h2 className="font-display text-2xl font-light leading-tight tracking-[-0.03em] md:col-span-4 md:text-3xl">{h}</h2>
                <p className="text-[15px] leading-relaxed text-text-dim-2 md:col-span-6 md:col-start-7">{p}</p>
              </section>
            </FadeUp>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
