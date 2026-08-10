"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import HTMLFlipBook from "react-pageflip";
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const WINDOW = 24;
const WINDOW_HALF = Math.floor(WINDOW / 2);

type Props = {
  url: string;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
};

type BookSize = { width: number; height: number; portrait: boolean };

function useBookSize(): BookSize {
  const [size, setSize] = useState<BookSize>({
    width: 360,
    height: 510,
    portrait: true,
  });

  useEffect(() => {
    function calc() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const portrait = vw < 900;
      const maxH = Math.min(Math.floor(vh * 0.64), 740);
      const pageW = portrait
        ? Math.min(Math.floor(vw - 36), 440)
        : Math.min(Math.floor((vw - 96) / 2), 420);
      const pageH = Math.min(maxH, Math.floor(pageW * 1.414));
      setSize({
        width: Math.max(280, pageW),
        height: Math.max(400, pageH),
        portrait,
      });
    }
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return size;
}

async function renderPdfPage(
  pdf: pdfjs.PDFDocumentProxy,
  pageNum: number,
  targetWidth: number,
): Promise<{ dataUrl: string; height: number }> {
  const page = await pdf.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const scale = (targetWidth * Math.min(window.devicePixelRatio || 1, 1.75)) / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const displayHeight = Math.round((base.height / base.width) * targetWidth);
  return { dataUrl, height: displayHeight };
}

const FlipPage = forwardRef<
  HTMLDivElement,
  { src: string; pageNum: number; width: number; height: number }
>(function FlipPage({ src, pageNum, width, height }, ref) {
  return (
    <div
      ref={ref}
      className="flip-page relative overflow-hidden bg-[#faf6ef]"
      data-density="soft"
      style={{ width, height }}
    >
      <div className="pointer-events-none absolute inset-y-0 z-[1] left-0 w-2.5 bg-gradient-to-r from-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 z-[1] right-0 w-2.5 bg-gradient-to-l from-black/[0.05] to-transparent" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Trang ${pageNum}`}
        draggable={false}
        className="block size-full object-contain bg-[#faf6ef]"
      />
      <span className="pointer-events-none absolute right-2 bottom-1.5 z-[2] rounded bg-black/40 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white/95">
        {pageNum}
      </span>
    </div>
  );
});

type FlipApi = {
  pageFlip: () => {
    flipNext: () => void;
    flipPrev: () => void;
    turnToPage: (pageIndex: number) => void;
  };
};

export function PdfFlipBook({ url, page, onPageChange, className }: Props) {
  const size = useBookSize();
  const flipRef = useRef<FlipApi | null>(null);
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());

  const [numPages, setNumPages] = useState(0);
  const [pageHeight, setPageHeight] = useState(size.height);
  const [windowStart, setWindowStart] = useState(1);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [bookReady, setBookReady] = useState(false);

  const syncing = useRef(false);
  const lastExternalPage = useRef(page);

  const windowEnd = useMemo(() => {
    if (!numPages) return 1;
    return Math.min(numPages, windowStart + WINDOW - 1);
  }, [numPages, windowStart]);

  const pagesInWindow = useMemo(() => {
    const list: number[] = [];
    for (let p = windowStart; p <= windowEnd; p++) list.push(p);
    return list;
  }, [windowStart, windowEnd]);

  const centerWindowOn = useCallback((targetPage: number, total: number) => {
    const clamped = Math.min(total, Math.max(1, targetPage));
    let start = Math.max(1, clamped - WINDOW_HALF);
    if (start + WINDOW - 1 > total) start = Math.max(1, total - WINDOW + 1);
    setWindowStart(start);
    return start;
  }, []);

  /** Load PDF document. */
  useEffect(() => {
    let cancelled = false;
    setLoadingDoc(true);
    setError("");
    setBookReady(false);
    cacheRef.current.clear();
    setImages({});

    pdfjs
      .getDocument({ url, withCredentials: false })
      .promise.then(async (pdf) => {
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        centerWindowOn(page, pdf.numPages);
        setLoadingDoc(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Không mở được PDF");
        setLoadingDoc(false);
      });

    return () => {
      cancelled = true;
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
    // chỉ reload khi đổi URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  /** Render cửa sổ trang thành ảnh JPEG. */
  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf || !numPages || loadingDoc) return;

    let cancelled = false;
    setRendering(true);
    setBookReady(false);
    // Đổi kích thước → render lại (cache theo width)
    const widthKey = size.width;

    (async () => {
      const next: Record<number, string> = {};
      let measuredH = size.height;

      for (const p of pagesInWindow) {
        if (cancelled) return;
        const cacheKey = p * 10000 + widthKey;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
          next[p] = cached;
          continue;
        }
        try {
          const { dataUrl, height } = await renderPdfPage(pdf, p, widthKey);
          if (cancelled) return;
          cacheRef.current.set(cacheKey, dataUrl);
          next[p] = dataUrl;
          if (p === pagesInWindow[0]) measuredH = height;
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Lỗi render trang");
          }
          return;
        }
      }

      if (cancelled) return;
      setPageHeight(measuredH);
      setImages(next);
      setRendering(false);
      setBookReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [numPages, loadingDoc, pagesInWindow, size.width, size.height]);

  /** Đồng bộ trang từ control bên ngoài. */
  useEffect(() => {
    if (!bookReady || !numPages) return;
    if (page === lastExternalPage.current) return;
    lastExternalPage.current = page;

    if (page < windowStart || page > windowEnd) {
      syncing.current = true;
      centerWindowOn(page, numPages);
      return;
    }

    const idx = page - windowStart;
    const api = flipRef.current?.pageFlip?.();
    if (!api) return;
    syncing.current = true;
    try {
      api.turnToPage(idx);
    } finally {
      requestAnimationFrame(() => {
        syncing.current = false;
      });
    }
  }, [page, bookReady, numPages, windowStart, windowEnd, centerWindowOn]);

  useEffect(() => {
    if (!bookReady) return;
    if (page < windowStart || page > windowEnd) return;
    const idx = page - windowStart;
    const t = window.setTimeout(() => {
      const api = flipRef.current?.pageFlip?.();
      if (!api) return;
      syncing.current = true;
      try {
        api.turnToPage(idx);
      } finally {
        requestAnimationFrame(() => {
          syncing.current = false;
        });
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [bookReady, windowStart, windowEnd, page]);

  function onFlip(e: { data: number }) {
    if (syncing.current) return;
    const pdfPage = windowStart + e.data;
    lastExternalPage.current = pdfPage;
    onPageChange(pdfPage);

    if (!numPages) return;
    const nearStart = e.data <= 1 && windowStart > 1;
    const nearEnd = e.data >= pagesInWindow.length - 2 && windowEnd < numPages;
    if (nearStart || nearEnd) centerWindowOn(pdfPage, numPages);
  }

  const flipH = Math.min(pageHeight, size.height);
  const allReady =
    bookReady &&
    pagesInWindow.every((p) => Boolean(images[p])) &&
    !rendering &&
    !loadingDoc;

  if (error) {
    return (
      <p className="py-16 text-center text-alert">
        Không tải được PDF để lật trang: {error}
      </p>
    );
  }

  if (!allReady) {
    return (
      <p className="py-20 text-center text-sm text-white/70">
        {loadingDoc ? "Đang mở sách…" : "Đang dựng trang lật…"}
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col items-center gap-3">
        <div
          style={{
            width: size.portrait ? size.width : size.width * 2,
            minHeight: flipH,
          }}
        >
          <HTMLFlipBook
            key={`flip-${windowStart}-${windowEnd}-${size.width}-${flipH}-${size.portrait ? "p" : "l"}`}
            width={size.width}
            height={flipH}
            size="fixed"
            minWidth={size.width}
            maxWidth={size.width}
            minHeight={flipH}
            maxHeight={flipH}
            drawShadow
            flippingTime={900}
            usePortrait={size.portrait}
            startPage={Math.max(
              0,
              Math.min(page - windowStart, pagesInWindow.length - 1),
            )}
            autoSize={false}
            maxShadowOpacity={0.55}
            showCover={false}
            mobileScrollSupport={false}
            clickEventForward={false}
            useMouseEvents
            swipeDistance={28}
            showPageCorners
            disableFlipByClick={false}
            className="mx-auto"
            style={{ margin: "0 auto" }}
            startZIndex={0}
            onFlip={onFlip}
            ref={flipRef}
          >
            {pagesInWindow.map((p) => (
              <FlipPage
                key={p}
                src={images[p]}
                pageNum={p}
                width={size.width}
                height={flipH}
              />
            ))}
          </HTMLFlipBook>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => flipRef.current?.pageFlip()?.flipPrev()}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            ← Lật
          </button>
          <button
            type="button"
            onClick={() => flipRef.current?.pageFlip()?.flipNext()}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            Lật →
          </button>
        </div>
        {numPages > WINDOW ? (
          <p className="text-center text-xs text-white/55">
            Đang xem trang {windowStart}–{windowEnd} / {numPages} · kéo góc trang
            hoặc vuốt để lật
          </p>
        ) : (
          <p className="text-center text-xs text-white/55">
            Kéo góc trang hoặc vuốt để lật · {numPages} trang
          </p>
        )}
      </div>
    </div>
  );
}
