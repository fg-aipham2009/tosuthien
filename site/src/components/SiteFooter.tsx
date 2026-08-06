import Link from "next/link";

const PDF_DANH_SACH =
  "https://tosuthien.com/wp-content/uploads/2026/07/1-Danh-sach-Chu-Ton-Duc-Tang-Ni-Tông-Phong.pdf";

function FooterTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-base font-bold uppercase tracking-wide text-white">
      {children}
      <span className="mt-2 block h-px w-12 bg-white/30" />
    </h3>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div className="bg-primary py-8 text-white">
        <div className="mx-auto grid max-w-[1080px] gap-8 px-4 md:grid-cols-3">
          <div>
            <FooterTitle>Tổ Sư Thiền</FooterTitle>
            <ul className="space-y-1 text-sm leading-8">
              <li>Cố vấn: HT Thích Minh Hiền</li>
              <li>Tổng biên tập: HT Thích Huệ Minh</li>
              <li>Địa chỉ: B15/20, Quốc Lộ 50, xã Bình Hưng, Tp.HCM</li>
              <li>
                Điện thoại:{" "}
                <a href="tel:0908400155" className="hover:text-success">
                  0908 400 155
                </a>
              </li>
              <li>
                Email:{" "}
                <a
                  href="mailto:thoaidau1980@gmail.com"
                  className="hover:text-success"
                >
                  thoaidau1980@gmail.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <FooterTitle>Văn phòng liên lạc</FooterTitle>
            <ul className="space-y-1 text-sm leading-8">
              <li>
                Chùa Phật Đà, địa chỉ: 362/46, Nguyễn Đình Chiểu, phường Bàn Cờ,
                Tp.HCM
              </li>
              <li>Trang tin điện tử Tổ Sư Thiền</li>
              <li>Chịu trách nhiệm nội dung: HT Thích Huệ Minh</li>
            </ul>
          </div>

          <div>
            <FooterTitle>Thông tin liên quan</FooterTitle>
            <div className="space-y-3 text-base leading-relaxed">
              <p>
                <a
                  href={PDF_DANH_SACH}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:text-success hover:underline"
                >
                  Danh Sách Chư Tôn Đức trụ trì các Chùa trong Tông Phong Tổ Sư
                  Thiền
                </a>
              </p>
              <p>
                <Link
                  href="/hoi-dap"
                  className="underline-offset-4 hover:text-success hover:underline"
                >
                  Hỏi Đáp Tổ Sư Thiền (Chatbot)
                </Link>
              </p>
              <p>
                <Link
                  href="/phap-am"
                  className="underline-offset-4 hover:text-success hover:underline"
                >
                  Pháp Âm MP3
                </Link>
              </p>
              <p>
                <Link
                  href="/kinh-sach"
                  className="underline-offset-4 hover:text-success hover:underline"
                >
                  Kinh Sách
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-primary-deep py-4 text-center text-sm text-white/70">
        Copyright {new Date().getFullYear()} ©{" "}
        <strong className="text-white/90">Tông Phong Tổ Sư Thiền</strong>
      </div>
    </footer>
  );
}
