import {
  FLIP_SHELF_BOOKS,
  FLIP_SHELF_META,
} from "../../lib/library/flipShelfBooks";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Same-origin FlipHTML5 bookcase embed.
 * Avoids iframe → fliphtml5.com (Cloudflare challenge + X-Frame-Options on challenge page).
 */
export function GET() {
  const bookDataJson = JSON.stringify(FLIP_SHELF_BOOKS);
  const meta = FLIP_SHELF_META;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${meta.title}</title>
  <link rel="stylesheet" href="https://static.fliphtml5.com/resourceFiles/bookcase/css/bookcase.min.css" />
  <style>
    html, body { margin: 0; height: 100%; width: 100%; overflow: hidden; background: #2b1a12; }
    .main-container { width: 100%; height: 100%; }
  </style>
</head>
<body class="red">
  <div class="main-container"></div>
  <script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>
  <script src="https://static.fliphtml5.com/resourceFiles/js/lib/jquery.qrcode.min.js"></script>
  <script src="https://static.fliphtml5.com/resourceFiles/bookcase/js/hammer.min.js"></script>
  <script src="https://static.fliphtml5.com/resourceFiles/js/lib/jquery.mousewheel.js"></script>
  <script src="https://static.fliphtml5.com/resourceFiles/bookcase/js/Bookcase.min.js"></script>
  <script>
    window.fh5 = {
      bookwebsite: "https://online.fliphtml5.com",
      website: "https://fliphtml5.com",
      header: "//newstat.fliphtml5.com",
      hashKey: "fliphtml5",
      prefix: "https://static.fliphtml5.com/resourceFiles/new_bookcase",
      isH5: 1
    };
    (function ($) {
      $(function () {
        if (window.hf_utils && typeof hf_utils.getLabelFilePath === "function") {
          hf_utils.getLabelFilePath = function (e) {
            var t = "";
            switch (String(e)) {
              case "1": t = "label-new.png"; break;
              case "2": t = "label-hot.png"; break;
              case "3": t = "label-featured.png"; break;
              case "4": t = "label-sold.png"; break;
            }
            return t ? "/bookcase/img/" + t : "";
          };
        }
        // Bookcase rewrites reader URLs to /books/{id}/ off fliphtml5.com;
        // force "on Flip" so readers open online.fliphtml5.com (no Cloudflare).
        if (window.Bookcase && Bookcase.prototype && Bookcase.prototype.bindEvents) {
          var origBind = Bookcase.prototype.bindEvents;
          Bookcase.prototype.bindEvents = function () {
            Object.defineProperty(this, "isFlipH5", {
              configurable: true,
              get: function () { return true; },
              set: function () {}
            });
            return origBind.apply(this, arguments);
          };
        }
        var options = {
          name: ${JSON.stringify(meta.name)},
          about: "",
          website: "",
          accountLogo: ${JSON.stringify(meta.accountLogo)},
          uLink: ${JSON.stringify(meta.uLink)},
          uId: ${JSON.stringify(meta.uId)},
          uType: "0",
          isSelf: "",
          AS3BucketName: "https://online.fliphtml5.com",
          shot_domain: "online.fliphtml5.com",
          caseLink: "https://fliphtml5.com/bookcase/${meta.bookcaseLink}/",
          domain: "",
          baseUrl: "https://fliphtml5.com/",
          title: ${JSON.stringify(meta.title)},
          status: "1",
          pass: "0",
          bookcaseLink: ${JSON.stringify(meta.bookcaseLink)},
          logoLink: "",
          logoName: "",
          currency: "USD",
          openType: "1",
          infoShow: "0",
          skin: "red",
          isShowShare: "0",
          isShowContact: "0",
          isShowSearch: "1",
          isShowSkin: "1",
          isShowCategory: "0",
          isShowLogo: "0",
          bMode: "3",
          updateTime: ${JSON.stringify(meta.updateTime)},
          OnlyOpenInIframe: "0",
          bookData: ${bookDataJson},
          folderData: []
        };
        new Bookcase($(".main-container"), options);
      });
    })(window.jQuery);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
