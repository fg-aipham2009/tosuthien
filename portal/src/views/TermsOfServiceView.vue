<script setup lang="ts">
import { RouterLink } from 'vue-router'

const updated = '24/09/2026'
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 class="font-serif text-2xl font-bold text-brand sm:text-3xl">Điều khoản sử dụng</h1>
    <p class="mt-2 text-sm text-muted">Cập nhật: {{ updated }}</p>

    <div class="mt-8 space-y-6 text-[0.95rem] leading-relaxed text-ink">
      <p>
        Khi sử dụng ứng dụng và website
        <strong>Tổ Sư Thiền</strong>
        (<code class="rounded bg-black/5 px-1 text-sm">net.tosuthien.app</code>,
        <a class="font-semibold text-brand underline" href="https://tosuthien.net">tosuthien.net</a>,
        <a class="font-semibold text-brand underline" href="https://tosuthien.com">tosuthien.com</a>),
        bạn đồng ý với các điều khoản sau.
      </p>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">1. Mục đích dịch vụ</h2>
        <p>
          Cung cấp tài liệu học Phật / Tổ Sư Thiền: hỏi đáp theo kinh sách, đọc chữ và PDF, pháp
          âm MP3, thông tin thiền đường. Nội dung mang tính tham khảo tu học, không thay thế tư
          vấn y tế, pháp lý hay chuyên môn khác.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">2. Hành vi được phép / bị cấm</h2>
        <ul class="list-disc space-y-1 pl-5">
          <li>Không gửi nội dung bất hợp pháp, lừa đảo, quấy rối, thù địch.</li>
          <li>
            <strong
              >Nghiêm cấm mọi nội dung hoặc hành vi liên quan đến xâm hại, bóc lột tình dục trẻ em
              (Child Sexual Abuse and Exploitation — CSAE), bao gồm CSAM.</strong
            >
            Vi phạm sẽ bị chặn và có thể báo cáo cơ quan chức năng.
          </li>
          <li>Không lạm dụng chatbot để spam hoặc phá hoại hệ thống.</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">3. Báo cáo vi phạm</h2>
        <p>
          Nếu phát hiện nội dung hoặc hành vi vi phạm (kể cả liên quan an toàn trẻ em), hãy báo
          cáo ngay qua email
          <a class="font-semibold text-brand underline" href="mailto:thoaidau1980@gmail.com"
            >thoaidau1980@gmail.com</a
          >
          hoặc gọi
          <a class="font-semibold text-brand underline" href="tel:0908400155">0908 400 155</a>.
          Đây cũng là điểm liên hệ Child Safety cho Google Play.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">4. Sở hữu trí tuệ</h2>
        <p>
          Kinh sách, pháp âm và nội dung thuộc quyền của chủ sở hữu tương ứng / Tông Phong Tổ Sư
          Thiền. Không được sao chép thương mại trái phép.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">5. Giới hạn trách nhiệm</h2>
        <p>
          Dịch vụ cung cấp “như hiện có”. Chúng tôi không chịu trách nhiệm thiệt hại phát sinh từ
          việc sử dụng hoặc không sử dụng được dịch vụ, trong phạm vi pháp luật cho phép.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">6. Thay đổi điều khoản</h2>
        <p>
          Chúng tôi có thể cập nhật điều khoản; bản mới sẽ đăng trên trang này kèm ngày cập nhật.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-lg font-bold text-brand">7. Liên hệ</h2>
        <p>
          Email:
          <a class="font-semibold text-brand underline" href="mailto:thoaidau1980@gmail.com"
            >thoaidau1980@gmail.com</a
          >
        </p>
      </section>
    </div>

    <p class="mt-10 text-sm text-muted">
      Xem
      <RouterLink class="font-semibold text-brand underline" to="/chinh-sach-bao-mat"
        >Chính sách quyền riêng tư</RouterLink
      >.
    </p>
  </article>
</template>
