<script setup lang="ts">
import { RouterLink } from 'vue-router'

const updated = '24/09/2026'
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 class="font-serif text-2xl font-bold text-brand sm:text-3xl">
      Chính sách quyền riêng tư
    </h1>
    <p class="mt-2 text-sm text-muted">Cập nhật: {{ updated }}</p>

    <div class="prose-legal mt-8 space-y-6 text-[0.95rem] leading-relaxed text-ink">
      <p>
        Ứng dụng và trang web
        <strong>Tổ Sư Thiền</strong>
        (bao gồm ứng dụng Android
        <code class="rounded bg-black/5 px-1 text-sm">net.tosuthien.app</code>,
        website
        <a class="font-semibold text-brand underline" href="https://tosuthien.net">tosuthien.net</a>
        và
        <a class="font-semibold text-brand underline" href="https://tosuthien.com">tosuthien.com</a>)
        cung cấp hỏi đáp kinh sách, đọc kinh sách, nghe pháp âm và danh sách thiền đường.
      </p>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">1. Dữ liệu chúng tôi thu thập</h2>
        <ul class="list-disc space-y-1 pl-5">
          <li>
            <strong>Mã thiết bị (device ID)</strong>
            — tạo trên thiết bị để lưu tiến độ đọc sách, không gắn tên tuổi của bạn.
          </li>
          <li>
            <strong>Nội dung hỏi đáp</strong>
            — câu hỏi bạn gửi chatbot và câu trả lời, để cung cấp dịch vụ tra cứu kinh sách.
          </li>
          <li>
            <strong>Nhật ký kỹ thuật</strong>
            — có thể gồm địa chỉ IP, loại trình duyệt/máy, thời điểm truy cập, phục vụ vận hành
            và bảo mật máy chủ.
          </li>
        </ul>
        <p class="mt-2">
          Chúng tôi <strong>không</strong> yêu cầu tạo tài khoản bắt buộc, không thu thập số
          chứng minh thư, và không bán dữ liệu cá nhân cho bên thứ ba để quảng cáo.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">2. Mục đích sử dụng</h2>
        <ul class="list-disc space-y-1 pl-5">
          <li>Cung cấp chức năng hỏi đáp, đọc kinh sách, phát pháp âm, xem thiền đường.</li>
          <li>Ghi nhớ tiến độ đọc trên cùng thiết bị.</li>
          <li>Bảo trì, khắc phục sự cố và cải thiện dịch vụ.</li>
          <li>Tuân thủ yêu cầu pháp luật khi cần thiết.</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">3. Lưu trữ và bảo mật</h2>
        <p>
          Dữ liệu được lưu trên máy chủ do chúng tôi quản lý. Chúng tôi áp dụng biện pháp hợp lý
          để hạn chế truy cập trái phép. Không có hệ thống nào an toàn tuyệt đối; bạn nên tránh
          gửi thông tin nhạy cảm không cần thiết qua chatbot.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">4. Chia sẻ dữ liệu</h2>
        <p>
          Chúng tôi không bán dữ liệu người dùng. Có thể chia sẻ với nhà cung cấp hạ tầng
          (máy chủ, lưu trữ) chỉ để vận hành dịch vụ, hoặc khi pháp luật yêu cầu.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">5. Quyền của bạn</h2>
        <p>
          Bạn có thể yêu cầu xóa dữ liệu liên quan đến thiết bị hoặc nội dung hỏi đáp bằng cách
          liên hệ email bên dưới. Chúng tôi sẽ xử lý trong thời gian hợp lý, trừ khi phải lưu
          theo nghĩa vụ pháp lý.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">6. Trẻ em</h2>
        <p>
          Dịch vụ hướng tới người lớn tìm hiểu Phật pháp / Tổ Sư Thiền. Chúng tôi không cố ý thu
          thập dữ liệu của trẻ em. Nghiêm cấm nội dung xâm hại hoặc bóc lột trẻ em (CSAE).
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">7. Liên hệ</h2>
        <ul class="list-none space-y-1 pl-0">
          <li>
            Email:
            <a class="font-semibold text-brand underline" href="mailto:thoaidau1980@gmail.com"
              >thoaidau1980@gmail.com</a
            >
          </li>
          <li>
            Điện thoại:
            <a class="font-semibold text-brand underline" href="tel:0908400155">0908 400 155</a>
          </li>
          <li>Địa chỉ liên hệ: B15/20, Quốc Lộ 50, xã Bình Hưng, Tp.HCM</li>
        </ul>
      </section>
    </div>

    <p class="mt-10 text-sm text-muted">
      Xem thêm
      <RouterLink class="font-semibold text-brand underline" to="/dieu-khoan"
        >Điều khoản sử dụng</RouterLink
      >.
    </p>
  </article>
</template>
