import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  FileQuestion,
  Loader2,
  Plus,
  X
} from "lucide-react";
import { formatBytes, getContentLabel, isVimeoEmbedUrl } from "../content";
import { resolvePageLayout } from "../pageLayouts";
import { getDocument } from "../pdf";
import type { ContentPage, FlipbookItem } from "../types";
import { PageDesignEditor } from "./PageDesignEditor";

const PageFlipBook = HTMLFlipBook as unknown as React.ComponentType<Record<string, unknown>>;

type FlipEvent = {
  data: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type LensPosition = {
  x: number;
  y: number;
};

type PageMetrics = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type CoverProps = {
  title: string;
  subtitle?: string;
  isBack?: boolean;
  coverImage?: string;
};

type PdfCanvasPageProps = {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  showPageNumber?: boolean;
};

type NativeContentPreviewProps = {
  book: FlipbookItem;
};

type PageContentPreviewProps = {
  page: ContentPage;
  showMeta?: boolean;
};

type PdfSource = {
  id: string;
  title: string;
  contentUrl: string;
};

type LoadedPdfSource = PdfSource & {
  doc: PDFDocumentProxy;
};

type RenderablePage =
  | {
      id: string;
      kind: "pdf";
      title: string;
      pdfDoc: PDFDocumentProxy;
      pageNumber: number;
      displayPageNumber: number;
    }
  | {
      id: string;
      kind: Exclude<ContentPage["contentKind"], "pdf">;
      title: string;
      page: ContentPage;
      displayPageNumber: number;
    };

const getViewportSize = (): ViewportSize => ({
  width: window.innerWidth,
  height: window.innerHeight
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const CoverPage = React.forwardRef<HTMLDivElement, CoverProps>(function CoverPage(
  { title, subtitle, isBack = false, coverImage },
  ref
) {
  if (coverImage && !isBack) {
    return (
      <div ref={ref} className="flip-cover magazine-cover-image">
        <img className="magazine-cover-img" src={coverImage} alt="Cover" />
        <div className="magazine-cover-gloss" />
        <div className="magazine-spine-edge" />
      </div>
    );
  }

  return (
    <div ref={ref} className={`flip-cover ${isBack ? "flip-cover-back" : ""}`}>
      <div className="flip-cover-overlay" />
      <div className="flip-cover-content">
        <p className="flip-cover-label">Aureus Magazine</p>
        <h2>{title}</h2>
        {subtitle ? <p className="flip-cover-subtitle">{subtitle}</p> : null}
      </div>
      <div className="magazine-spine-edge" />
      <div className="magazine-cover-gloss" />
    </div>
  );
});

const PdfCanvasPage = React.forwardRef<HTMLDivElement, PdfCanvasPageProps>(function PdfCanvasPage(
  { pdfDoc, pageNumber, pageWidth, pageHeight, showPageNumber = true },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: { cancel?: () => void; promise: Promise<void> } | null = null;

    const renderPage = async () => {
      try {
        setIsRendering(true);
        const page = await pdfDoc.getPage(pageNumber);

        if (isCancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(pageWidth / baseViewport.width, pageHeight / baseViewport.height);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });

        if (!canvas || !context) {
          return;
        }

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport
        }) as unknown as { cancel?: () => void; promise: Promise<void> };

        await renderTask.promise;
      } catch (error) {
        const renderError = error as { name?: string };
        if (renderError?.name !== "RenderingCancelledException") {
          console.error(`Failed to render PDF page ${pageNumber}`, error);
        }
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderPage();

    return () => {
      isCancelled = true;
      renderTask?.cancel?.();
    };
  }, [pageHeight, pageNumber, pageWidth, pdfDoc]);

  return (
    <div ref={ref} className="flip-page">
      <div className="flip-page-frame">
        {isRendering ? <div className="flip-page-loading">Rendering page {pageNumber}...</div> : null}
        <canvas ref={canvasRef} className="flip-page-canvas" />
      </div>
      {showPageNumber ? <div className="flip-page-number">{pageNumber}</div> : null}
    </div>
  );
});

function TextPreview({ contentUrl }: { contentUrl?: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadText = async () => {
      if (!contentUrl) {
        setError("This text file is missing a source.");
        return;
      }

      try {
        setError(null);
        setContent("");
        const response = await fetch(contentUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch (textError) {
        console.error("Failed to load text preview", textError);
        if (!cancelled) {
          setError("This text file could not be previewed.");
        }
      }
    };

    void loadText();

    return () => {
      cancelled = true;
    };
  }, [contentUrl]);

  if (error) {
    return <div className="viewer-error">{error}</div>;
  }

  return <pre className="text-preview">{content || "Loading text..."}</pre>;
}

function NativeContentPreview({ book }: NativeContentPreviewProps) {
  if (!book.contentUrl) {
    return (
      <div className="native-preview-shell">
        <div className="unsupported-preview">
          <FileQuestion size={42} />
          <h3>Preview not available</h3>
          <p>This content item is missing a source file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="native-preview-shell">
      {book.contentKind === "image" ? (
        <img className="image-preview" src={book.contentUrl} alt={book.title} />
      ) : null}

      {book.contentKind === "video" ? (
        <video className="video-preview" src={book.contentUrl} controls playsInline />
      ) : null}

      {book.contentKind === "audio" ? (
        <div className="audio-preview">
          <audio src={book.contentUrl} controls />
        </div>
      ) : null}

      {book.contentKind === "text" ? <TextPreview contentUrl={book.contentUrl} /> : null}

      {book.contentKind === "file" ? (
        <div className="unsupported-preview">
          <FileQuestion size={42} />
          <h3>Preview not available</h3>
          <p>This file is in the library, but the browser cannot render this format directly.</p>
        </div>
      ) : null}

      <div className="native-preview-actions">
        <a className="native-preview-link" href={book.contentUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          <span>Open</span>
        </a>
        <a className="native-preview-link" href={book.contentUrl} download={book.fileName ?? book.title}>
          <Download size={16} />
          <span>Download</span>
        </a>
      </div>
    </div>
  );
}

const PageContentPreview = React.forwardRef<HTMLDivElement, PageContentPreviewProps>(function PageContentPreview(
  { page, showMeta = true },
  ref
) {
  const layout = resolvePageLayout(page);
  const pageLabel = getContentLabel(page.contentKind);
  const isMediaPage = page.contentKind === "image" || page.contentKind === "video";
  const isQuoteLayout = layout.preset === "quote";
  const isCoverLayout = layout.preset === "cover";
  const isSplitLayout = layout.preset === "split";
  const isSpotlightLayout = layout.preset === "spotlight";
  const isStackLayout = layout.preset === "stack";
  const isFullPageMedia = isMediaPage && (isCoverLayout || isSpotlightLayout);
  const themeClass = `page-theme-${layout.theme}`;

  return (
    <div ref={ref} className={`flip-page ${themeClass} ${isFullPageMedia ? "asset-cover-page" : ""}`}>
      <div className={`flip-page-frame mixed-page-frame layout-${layout.preset}`}>
        <div className={`mixed-page-layout ${themeClass} ${isSplitLayout ? "is-split" : ""} ${isSpotlightLayout ? "is-spotlight" : ""} ${isStackLayout ? "is-stack" : ""} ${isQuoteLayout ? "is-quote" : ""}`}>
          {showMeta ? (
            <div className="mixed-page-copy">
              <span className="mixed-page-kicker">{layout.kicker}</span>
              <h3>{layout.headline}</h3>
              {layout.body ? <p className="mixed-page-body">{layout.body}</p> : null}
            </div>
          ) : null}

          <div className="mixed-page-asset">
            {page.contentKind === "image" ? (
              <img className="mixed-image" src={page.contentUrl} alt={`${pageLabel} page`} />
            ) : null}

            {page.contentKind === "video" ? (
              page.embedUrl && isVimeoEmbedUrl(page.embedUrl) ? (
                <iframe
                  className="mixed-video mixed-video-embed"
                  src={page.embedUrl}
                  title={page.title}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video className="mixed-video" src={page.contentUrl} controls playsInline poster={page.posterUrl} />
              )
            ) : null}

            {page.contentKind === "audio" ? <audio className="mixed-audio" src={page.contentUrl} controls /> : null}

            {page.contentKind === "text" ? <TextPreview contentUrl={page.contentUrl} /> : null}

            {page.contentKind === "file" ? (
              <div className="unsupported-preview mixed-unsupported">
                <FileQuestion size={38} />
                <h3>Preview not available</h3>
                <p>This file is part of the magazine, but the browser cannot render it directly.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {showMeta ? <div className="flip-page-number">{pageLabel}</div> : null}
    </div>
  );
});

type ZoomPagePreviewProps = {
  page: RenderablePage;
  pageWidth: number;
  pageHeight: number;
  showMeta?: boolean;
};

function ZoomPagePreview({ page, pageWidth, pageHeight, showMeta = true }: ZoomPagePreviewProps) {
  if (page.kind === "pdf") {
    return (
      <PdfCanvasPage
        pdfDoc={page.pdfDoc}
        pageNumber={page.pageNumber}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        showPageNumber={showMeta}
      />
    );
  }

  return <PageContentPreview page={page.page} showMeta={showMeta} />;
}

type FlipbookViewerProps = {
  book: FlipbookItem;
  onBack?: () => void;
  onLoaded?: (pageCount: number) => void;
  variant?: "dashboard" | "presentation";
  editor?: {
    book: FlipbookItem;
    selectedPageId: string;
    onSelectPage: (pageId: string) => void;
    onChange: (updatedBook: FlipbookItem) => void;
    onUpdatePage: (pageId: string, updater: (page: ContentPage) => ContentPage) => void;
    catalogPages: ContentPage[];
    onAddCatalogPage: (page: ContentPage) => void;
    onCoverUpload: (file: File) => void;
    onSave: () => void;
    onClose: () => void;
  };
};

export function FlipbookViewer({ book, onBack, onLoaded, variant = "dashboard", editor }: FlipbookViewerProps) {
  const [loadedPdfSources, setLoadedPdfSources] = useState<LoadedPdfSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(getViewportSize);
  const [pageAspectRatio, setPageAspectRatio] = useState(1.4142);
  const [isDetailLensOpen, setIsDetailLensOpen] = useState(false);
  const [detailLensPosition, setDetailLensPosition] = useState<LensPosition>({ x: 24, y: 24 });
  const [activePageMetrics, setActivePageMetrics] = useState<PageMetrics | null>(null);
  const bookRef = useRef<{
    pageFlip?: () => { flipPrev: () => void; flipNext: () => void; turnToPage: (index: number) => void };
  } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lensDragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const isPdf = book.contentKind === "pdf";
  const isMagazine = book.contentKind === "magazine";
  const isFlipbook = isPdf || isMagazine;
  const isPresentation = variant === "presentation";
  const legacyNavigator = navigator as Navigator & { msMaxTouchPoints?: number };
  const isTouchCapable =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0 || (legacyNavigator.msMaxTouchPoints ?? 0) > 0);

  const magazinePages = useMemo(() => (isMagazine ? book.pages ?? [] : []), [book.pages, isMagazine]);
  const selectedEditorPage = useMemo(
    () => (editor?.selectedPageId ? magazinePages.find((page) => page.id === editor.selectedPageId) ?? null : null),
    [editor?.selectedPageId, magazinePages]
  );

  const pdfSources = useMemo<PdfSource[]>(() => {
    if (isPdf && book.contentUrl) {
      return [{ id: book.id, title: book.title, contentUrl: book.contentUrl }];
    }

    if (isMagazine) {
      return magazinePages
        .filter((page) => page.contentKind === "pdf")
        .map((page) => ({ id: page.id, title: page.title, contentUrl: page.contentUrl }));
    }

    return [];
  }, [book.contentUrl, book.id, book.title, isMagazine, isPdf, magazinePages]);

  const renderablePages = useMemo<RenderablePage[]>(() => {
    if (!isFlipbook) {
      return [];
    }

    if (isPdf) {
      const pdfSource = loadedPdfSources[0];
      if (!pdfSource) {
        return [];
      }
      return Array.from({ length: pdfSource.doc.numPages }, (_, index) => ({
        id: `${pdfSource.id}-page-${index + 1}`,
        kind: "pdf" as const,
        title: pdfSource.title,
        pdfDoc: pdfSource.doc,
        pageNumber: index + 1,
        displayPageNumber: index + 1
      }));
    }

    const pages: RenderablePage[] = [];
    for (const page of magazinePages) {
      if (page.contentKind === "pdf") {
        const loadedPdf = loadedPdfSources.find((source) => source.id === page.id);
        if (!loadedPdf) {
          continue;
        }
        for (let pageNumber = 1; pageNumber <= loadedPdf.doc.numPages; pageNumber += 1) {
          pages.push({
            id: `${page.id}-page-${pageNumber}`,
            kind: "pdf",
            title: page.title,
            pdfDoc: loadedPdf.doc,
            pageNumber,
            displayPageNumber: pages.length + 1
          });
        }
        continue;
      }

      pages.push({
        id: page.id,
        kind: page.contentKind,
        title: page.title,
        page,
        displayPageNumber: pages.length + 1
      });
    }

    return pages;
  }, [isFlipbook, isPdf, loadedPdfSources, magazinePages]);

  const totalPages = isFlipbook ? renderablePages.length || book.pageCount || 0 : 0;
  const activeRenderablePage =
    currentPageIndex > 0 && currentPageIndex <= renderablePages.length ? renderablePages[currentPageIndex - 1] ?? null : null;

  useEffect(() => {
    const onResize = () => setViewportSize(getViewportSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadingTasks: Array<{ destroy?: () => void; promise: Promise<PDFDocumentProxy> }> = [];
    const activeDocs: PDFDocumentProxy[] = [];

    const loadBook = async () => {
      if (!isFlipbook) {
        setLoading(false);
        setError(null);
        setLoadedPdfSources([]);
        setCurrentPageIndex(0);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setLoadedPdfSources([]);
        setCurrentPageIndex(0);

        const loadedSources = await Promise.all(
          pdfSources.map(async (source) => {
            const loadingTask = getDocument(source.contentUrl) as unknown as {
              destroy?: () => void;
              promise: Promise<PDFDocumentProxy>;
            };
            loadingTasks.push(loadingTask);
            const doc = await loadingTask.promise;
            activeDocs.push(doc);
            return { ...source, doc };
          })
        );

        if (!mounted) {
          await Promise.all(loadedSources.map((source) => source.doc.destroy()));
          return;
        }

        const firstPdf = loadedSources[0];
        if (firstPdf) {
          const firstPage = await firstPdf.doc.getPage(1);
          const baseViewport = firstPage.getViewport({ scale: 1 });

          if (baseViewport.width > 0) {
            setPageAspectRatio(baseViewport.height / baseViewport.width);
          }
        }

        setLoadedPdfSources(loadedSources);

        const loadedPageCount =
          loadedSources.reduce((total, source) => total + source.doc.numPages, 0) +
          (isMagazine ? magazinePages.filter((page) => page.contentKind !== "pdf").length : 0);
        onLoaded?.(loadedPageCount);
      } catch (loadError) {
        if (mounted) {
          console.error("Failed to load flipbook", loadError);
          setError("Failed to load this magazine.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadBook();

    return () => {
      mounted = false;
      for (const loadingTask of loadingTasks) {
        loadingTask.destroy?.();
      }
      for (const activeDoc of activeDocs) {
        void activeDoc.destroy();
      }
    };
  }, [book.id, isFlipbook, isMagazine, magazinePages, onLoaded, pdfSources]);

  const layout = useMemo(() => {
    const isMobile = viewportSize.width < 920;
    const horizontalPadding = isPresentation ? (viewportSize.width < 640 ? 0 : 64) : viewportSize.width < 768 ? 80 : 120;
    const verticalReserve = isPresentation ? (viewportSize.height < 720 ? 20 : 56) : viewportSize.height < 840 ? 340 : 270;
    const availableWidth = Math.max(200, viewportSize.width - horizontalPadding);
    const availableHeight = Math.max(250, viewportSize.height - verticalReserve);
    const spreadColumns = isMobile ? 1 : 2;
    const gap = isMobile ? 0 : isPresentation ? 0 : 20;
    const widthByViewport = (availableWidth - gap) / spreadColumns;
    const widthByHeight = availableHeight / pageAspectRatio;
    const maxPageWidth = isPresentation ? 820 : 620;
    const pageWidth = Math.max(200, Math.min(maxPageWidth, Math.floor(Math.min(widthByViewport, widthByHeight))));
    const pageHeight = Math.max(250, Math.floor(pageWidth * pageAspectRatio));

    return { isMobile, pageWidth, pageHeight };
  }, [isPresentation, pageAspectRatio, viewportSize.height, viewportSize.width]);

  const detailLensSize = useMemo(
    () => (layout.isMobile ? { width: 160, height: 124 } : { width: 240, height: 176 }),
    [layout.isMobile]
  );

  const detailLensZoom = layout.isMobile ? 1.7 : 2;
  const showPresentationDetailLens = isPresentation && !isTouchCapable;

  const displayLabel = useMemo(() => {
    if (totalPages <= 0) {
      return "Loading";
    }
    if (currentPageIndex <= 0) {
      return "Front Cover";
    }
    if (currentPageIndex >= totalPages + 1) {
      return "Back Cover";
    }
    return `Page ${currentPageIndex}`;
  }, [currentPageIndex, totalPages]);

  const flipbookChildren = useMemo(() => {
    const pages = renderablePages.map((page) => {
      if (page.kind === "pdf") {
        return (
          <PdfCanvasPage
            key={page.id}
            ref={(node) => {
              pageRefs.current[page.id] = node;
            }}
            pdfDoc={page.pdfDoc}
            pageNumber={page.pageNumber}
            pageWidth={layout.pageWidth}
            pageHeight={layout.pageHeight}
            showPageNumber={!isPresentation}
          />
        );
      }
      return (
        <PageContentPreview
          key={page.id}
            ref={(node) => {
              pageRefs.current[page.id] = node;
            }}
            page={page.page}
            showMeta={!isPresentation}
          />
        );
      });

    return [
      <CoverPage
        key="front-cover"
        title={book.title}
        subtitle={isMagazine ? "Ready to present" : "Ready to view"}
        coverImage={book.coverImageUrl}
      />,
      ...pages,
      <CoverPage key="back-cover" title="End" subtitle="Aureus Magazine" isBack />
    ];
  }, [book.coverImageUrl, book.title, isMagazine, layout.pageHeight, layout.pageWidth, renderablePages]);

  const getFlipBookApi = () => bookRef.current?.pageFlip?.();
  const handlePrev = () => getFlipBookApi()?.flipPrev();
  const handleNext = () => getFlipBookApi()?.flipNext();
  const handleFirst = () => getFlipBookApi()?.turnToPage(0);
  const handleLast = () => getFlipBookApi()?.turnToPage(totalPages + 1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        if (!isFlipbook) {
          return;
        }
        event.preventDefault();
        handleNext();
      }
      if (event.key === "ArrowLeft") {
        if (!isFlipbook) {
          return;
        }
        event.preventDefault();
        handlePrev();
      }
      if (event.key === "Escape" && onBack) {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFlipbook, onBack, totalPages]);

  useEffect(() => {
    if (!showPresentationDetailLens || !activeRenderablePage || !stageRef.current) {
      setActivePageMetrics(null);
      return;
    }

    const stageRect = stageRef.current.getBoundingClientRect();
    const pageElement = pageRefs.current[activeRenderablePage.id];
    if (!pageElement) {
      setActivePageMetrics(null);
      return;
    }

    const pageRect = pageElement.getBoundingClientRect();
    if (!pageRect.width || !pageRect.height) {
      setActivePageMetrics(null);
      return;
    }

    setActivePageMetrics({
      left: pageRect.left - stageRect.left,
      top: pageRect.top - stageRect.top,
      width: pageRect.width,
      height: pageRect.height
    });
  }, [
    activeRenderablePage,
    currentPageIndex,
    layout.isMobile,
    layout.pageHeight,
    layout.pageWidth,
    showPresentationDetailLens,
    viewportSize.height,
    viewportSize.width
  ]);

  useEffect(() => {
    if (!activePageMetrics) {
      return;
    }

    setDetailLensPosition((current) => ({
      x: clamp(current.x, 0, Math.max(0, activePageMetrics.width - detailLensSize.width)),
      y: clamp(current.y, 0, Math.max(0, activePageMetrics.height - detailLensSize.height))
    }));
  }, [activePageMetrics, detailLensSize.height, detailLensSize.width]);

  useEffect(() => {
    if (!activeRenderablePage) {
      setIsDetailLensOpen(false);
    }
  }, [activeRenderablePage]);

  const beginLensDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!activePageMetrics) {
      return;
    }

    const pageLeft = activePageMetrics.left + detailLensPosition.x;
    const pageTop = activePageMetrics.top + detailLensPosition.y;
    lensDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - pageLeft,
      offsetY: event.clientY - pageTop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleLensDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePageMetrics || !lensDragStateRef.current) {
      return;
    }

    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return;
    }

    const nextX = event.clientX - stageRect.left - activePageMetrics.left - lensDragStateRef.current.offsetX;
    const nextY = event.clientY - stageRect.top - activePageMetrics.top - lensDragStateRef.current.offsetY;

    setDetailLensPosition({
      x: clamp(nextX, 0, Math.max(0, activePageMetrics.width - detailLensSize.width)),
      y: clamp(nextY, 0, Math.max(0, activePageMetrics.height - detailLensSize.height))
    });
  };

  const endLensDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    const dragState = lensDragStateRef.current;
    if (event && dragState && event.pointerId === dragState.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture can already be released if the browser ended the drag first.
      }
    }

    lensDragStateRef.current = null;
  };

  return (
    <section className={`viewer-shell ${isPresentation ? "presentation-viewer" : ""}`}>
      {onBack ? (
        <button type="button" className="back-link" onClick={onBack}>
          Back to library
        </button>
      ) : null}

      {!isPresentation ? <header className="viewer-header">
        <div>
          <h2>{book.title}</h2>
          <p>{book.description || "Ready to review."}</p>
        </div>
        <div className="viewer-meta">
          <span>{isFlipbook ? `${totalPages || "--"} pages` : getContentLabel(book.contentKind)}</span>
          <span>{formatBytes(book.sizeBytes) || (book.source === "upload" ? "Uploaded locally" : "Assets folder")}</span>
        </div>
      </header> : null}

      {isFlipbook && loading && !editor ? (
        <div className="viewer-message">
          <Loader2 className="spin" size={18} />
          <span>Loading magazine...</span>
        </div>
      ) : null}

      {error ? <div className="viewer-error">{error}</div> : null}

      {!isFlipbook && !error ? <NativeContentPreview book={book} /> : null}

      {editor && isMagazine && selectedEditorPage ? (
        <div className="flipbook-shell editor-preview-shell">
          <PageDesignEditor
            book={editor.book}
            selectedPageId={editor.selectedPageId}
            onSelectPage={editor.onSelectPage}
            onChange={editor.onChange}
            onUpdatePage={editor.onUpdatePage}
            catalogPages={editor.catalogPages}
            onAddCatalogPage={editor.onAddCatalogPage}
            onCoverUpload={editor.onCoverUpload}
            onSave={editor.onSave}
            onClose={editor.onClose}
          />
        </div>
      ) : null}

      {!editor && isFlipbook && !loading && !error && renderablePages.length > 0 ? (
        <div className="flipbook-shell">
          <div
            ref={stageRef}
            className={`flipbook-stage ${isPresentation && isDetailLensOpen ? "detail-lens-active" : ""}`}
            onPointerMove={handleLensDrag}
            onPointerUp={endLensDrag}
            onPointerLeave={endLensDrag}
          >
            {showPresentationDetailLens ? (
              <div className="presentation-stage-actions">
                {activeRenderablePage && activePageMetrics ? (
                  <button
                    type="button"
                    className={`presentation-detail-toggle ${isDetailLensOpen ? "active" : ""}`}
                    onClick={() => setIsDetailLensOpen((current) => !current)}
                    aria-pressed={isDetailLensOpen}
                    aria-label={isDetailLensOpen ? "Close zoom box" : "Open zoom box"}
                    title={isDetailLensOpen ? "Close zoom box" : "Open zoom box"}
                  >
                    {isDetailLensOpen ? <X size={18} /> : <Plus size={18} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="presentation-detail-toggle is-idle"
                    aria-label="Zoom box unavailable on cover"
                    title="Open a page to use the zoom box"
                    disabled
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            ) : null}

            <PageFlipBook
              ref={bookRef as never}
              className="flipbook-root"
              width={layout.pageWidth}
              height={layout.pageHeight}
              size="fixed"
              minWidth={200}
              maxWidth={isPresentation ? 860 : 640}
              minHeight={200}
              maxHeight={isPresentation ? 1400 : 1080}
              maxShadowOpacity={isPresentation ? 0.9 : 0.65}
              showCover
              mobileScrollSupport={false}
              useMouseEvents
              flippingTime={isPresentation ? 900 : 700}
              drawShadow
              usePortrait={layout.isMobile}
              swipeDistance={30}
              onFlip={(event: FlipEvent) => setCurrentPageIndex(event.data)}
            >
              {flipbookChildren}
            </PageFlipBook>

            {showPresentationDetailLens && isDetailLensOpen && activeRenderablePage && activePageMetrics ? (
              <div
                className="presentation-detail-lens"
                style={{
                  width: `${detailLensSize.width}px`,
                  height: `${detailLensSize.height}px`,
                  left: `${activePageMetrics.left + detailLensPosition.x}px`,
                  top: `${activePageMetrics.top + detailLensPosition.y}px`
                }}
              >
                <button
                  type="button"
                  className="presentation-detail-lens-handle"
                  onPointerDown={beginLensDrag}
                  aria-label="Move detail lens"
                  title="Move zoom box"
                >
                  <span className="presentation-detail-lens-handle-grip" />
                </button>

                <div className="presentation-detail-lens-viewport">
                  <div
                    className="presentation-detail-lens-surface"
                    style={{
                      width: `${activePageMetrics.width}px`,
                      height: `${activePageMetrics.height}px`,
                      transform: `translate(${-detailLensPosition.x * detailLensZoom}px, ${-detailLensPosition.y * detailLensZoom}px) scale(${detailLensZoom})`
                    }}
                  >
                    <ZoomPagePreview
                      page={activeRenderablePage}
                      pageWidth={Math.round(activePageMetrics.width)}
                      pageHeight={Math.round(activePageMetrics.height)}
                      showMeta={false}
                    />
                  </div>
                </div>
              </div>
            ) : null}

          </div>

          {isPresentation && currentPageIndex <= 0 ? (
            <div className="presentation-hint">
              {isTouchCapable ? "Swipe to open the magazine. Pinch to zoom." : "Click or swipe to open the magazine"}
            </div>
          ) : null}

          {!isPresentation ? <div className="flipbook-toolbar">
            <div className="flipbook-actions">
              <button type="button" onClick={handleFirst} className="flipbook-btn" disabled={currentPageIndex <= 0}>
                <ChevronsLeft size={16} />
                <span>First</span>
              </button>
              <button type="button" onClick={handlePrev} className="flipbook-btn" disabled={currentPageIndex <= 0}>
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flipbook-btn"
                disabled={currentPageIndex >= totalPages + 1}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={handleLast}
                className="flipbook-btn"
                disabled={currentPageIndex >= totalPages + 1}
              >
                <span>Last</span>
                <ChevronsRight size={16} />
              </button>
            </div>

            <div className="flipbook-status">{displayLabel} of {totalPages} pages</div>
          </div> : null}

          {!isPresentation && renderablePages.length > 1 ? (
            <div className="page-jump-list" aria-label="Magazine pages">
              {renderablePages.map((page) => (
                <button
                  key={`jump-${page.id}`}
                  type="button"
                  className={`page-jump ${currentPageIndex === page.displayPageNumber ? "active" : ""}`}
                  onClick={() => getFlipBookApi()?.turnToPage(page.displayPageNumber)}
                >
                  <span>Page {page.displayPageNumber}</span>
                  <small>{page.kind === "pdf" ? "Brochure" : getContentLabel(page.kind)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
