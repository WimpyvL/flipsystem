import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Grip,
  ImagePlus,
  LayoutTemplate,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  SquareStack,
  Trash2,
  Type,
  Video,
  X
} from "lucide-react";
import { getContentLabel, isVimeoEmbedUrl } from "../content";
import { PAGE_LAYOUT_PRESETS, PAGE_LAYOUT_THEMES, resolvePageLayout } from "../pageLayouts";
import type { ContentBlock, ContentBlockKind, ContentPage, FlipbookItem, PageLayoutConfig } from "../types";

type PageDesignEditorProps = {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const makeBlockId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};

const createBlock = (kind: ContentBlockKind, page: ContentPage): ContentBlock => {
  switch (kind) {
    case "text":
      return {
        id: makeBlockId(),
        kind,
        x: 8,
        y: 10,
        width: 36,
        height: 18,
        label: "Text block",
        body: "Add a short supporting message."
      };
    case "link":
      return {
        id: makeBlockId(),
        kind,
        x: 10,
        y: 72,
        width: 28,
        height: 12,
        label: "Open link",
        url: "https://"
      };
    case "button":
      return {
        id: makeBlockId(),
        kind,
        x: 42,
        y: 72,
        width: 24,
        height: 12,
        label: "Learn more",
        url: "https://"
      };
    case "video":
      return {
        id: makeBlockId(),
        kind,
        x: 56,
        y: 10,
        width: 30,
        height: 24,
        label: "Video block",
        body: "Optional linked video panel",
        mediaUrl: page.contentKind === "video" ? page.embedUrl ?? page.contentUrl : "",
        url: page.externalUrl ?? "https://"
      };
  }
};

const formatDuration = (seconds = 0) => {
  if (!seconds) {
    return "";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export function PageDesignEditor({
  book,
  selectedPageId,
  onSelectPage,
  onChange,
  onUpdatePage,
  catalogPages,
  onAddCatalogPage,
  onCoverUpload,
  onSave,
  onClose
}: PageDesignEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = React.useState("");
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(true);
  const [videoQuery, setVideoQuery] = React.useState("");
  const coverUploadRef = React.useRef<HTMLInputElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const pages = book.pages ?? [];
  const page = pages.find((entry) => entry.id === selectedPageId) ?? null;
  const imagePages = pages.filter((entry) => entry.contentKind === "image");
  const isCustomUpload = Boolean(book.coverImageUrl) && !imagePages.some((entry) => entry.contentUrl === book.coverImageUrl);

  const blocks = page?.blocks ?? [];
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? null;
  const layout = page ? resolvePageLayout(page) : null;
  const pageLabel = page ? getContentLabel(page.contentKind) : "Page";
  const themeClass = layout ? `page-theme-${layout.theme}` : "page-theme-cool";
  const isMediaPage = page?.contentKind === "image" || page?.contentKind === "video";
  const isCoverLayout = layout?.preset === "cover";
  const isSpotlightLayout = layout?.preset === "spotlight";
  const isSplitLayout = layout?.preset === "split";
  const isStackLayout = layout?.preset === "stack";
  const isQuoteLayout = layout?.preset === "quote";
  const isFullPageMedia = Boolean(isMediaPage && (isCoverLayout || isSpotlightLayout));
  const supportsCanvasEditing = Boolean(page && page.contentKind !== "pdf");
  const filteredCatalogPages = React.useMemo(() => {
    const normalizedQuery = videoQuery.trim().toLowerCase();
    return catalogPages.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        entry.title.toLowerCase().includes(normalizedQuery) ||
        entry.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [catalogPages, videoQuery]);

  React.useEffect(() => {
    if (!blocks.length) {
      setSelectedBlockId("");
      return;
    }

    if (!selectedBlockId || !blocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  const updateBook = (patch: Partial<FlipbookItem>) => onChange({ ...book, ...patch });

  const updatePages = (updater: (currentPages: ContentPage[]) => ContentPage[]) => {
    updateBook({ pages: updater([...(book.pages ?? [])]) });
  };

  const updatePageLayout = (pageId: string, patch: Partial<PageLayoutConfig>) => {
    onUpdatePage(pageId, (currentPage) => ({
      ...currentPage,
      layout: {
        preset: currentPage.layout?.preset ?? "auto",
        theme: currentPage.layout?.theme ?? "cool",
        kicker: currentPage.layout?.kicker ?? "",
        headline: currentPage.layout?.headline ?? "",
        body: currentPage.layout?.body ?? "",
        ...patch
      }
    }));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) {
      return;
    }

    updatePages((currentPages) => {
      const next = [...currentPages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePage = (pageId: string) => {
    updatePages((currentPages) => {
      const currentIndex = currentPages.findIndex((entry) => entry.id === pageId);
      const remaining = currentPages.filter((entry) => entry.id !== pageId);
      if (selectedPageId === pageId) {
        const nextSelection = remaining[Math.max(0, currentIndex - 1)] ?? remaining[0] ?? null;
        onSelectPage(nextSelection?.id ?? "");
      }
      return remaining;
    });
  };

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    onCoverUpload(file);
  };

  const patchSelectedBlock = (patch: Partial<ContentBlock>) => {
    if (!page || !selectedBlock) {
      return;
    }

    onUpdatePage(page.id, (currentPage) => ({
      ...currentPage,
      blocks: (currentPage.blocks ?? []).map((block) => (block.id === selectedBlock.id ? { ...block, ...patch } : block))
    }));
  };

  const addBlock = (kind: ContentBlockKind) => {
    if (!page || !supportsCanvasEditing) {
      return;
    }

    const nextBlock = createBlock(kind, page);
    onUpdatePage(page.id, (currentPage) => ({
      ...currentPage,
      blocks: [...(currentPage.blocks ?? []), nextBlock]
    }));
    setSelectedBlockId(nextBlock.id);
  };

  const removeSelectedBlock = () => {
    if (!page || !selectedBlock) {
      return;
    }

    onUpdatePage(page.id, (currentPage) => ({
      ...currentPage,
      blocks: (currentPage.blocks ?? []).filter((block) => block.id !== selectedBlock.id)
    }));
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, blockId: string) => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const block = blocks.find((entry) => entry.id === blockId);
    if (!block) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    dragRef.current = {
      id: blockId,
      offsetX: event.clientX - rect.left - rect.width * (block.x / 100),
      offsetY: event.clientY - rect.top - rect.height * (block.y / 100)
    };
    setSelectedBlockId(blockId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    const dragState = dragRef.current;
    if (!page || !surface || !dragState) {
      return;
    }

    const block = blocks.find((entry) => entry.id === dragState.id);
    if (!block) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    const nextX = clamp(((event.clientX - rect.left - dragState.offsetX) / rect.width) * 100, 0, 100 - block.width);
    const nextY = clamp(((event.clientY - rect.top - dragState.offsetY) / rect.height) * 100, 0, 100 - block.height);

    onUpdatePage(page.id, (currentPage) => ({
      ...currentPage,
      blocks: (currentPage.blocks ?? []).map((entry) =>
        entry.id === dragState.id ? { ...entry, x: nextX, y: nextY } : entry
      )
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className={`canvas-editor-shell ${isDrawerOpen ? "drawer-open" : "drawer-closed"}`}>
      <div className="canvas-editor-stage-shell">
        <div className="canvas-editor-topbar">
          <div>
            <p className="panel-label">Live Canvas Editor</p>
            <h3>{page?.title ?? "Select a page"}</h3>
            <p className="design-editor-copy">
              {supportsCanvasEditing
                ? "Drag and reshape blocks directly on the page. Everything else lives in the drawer."
                : "This page keeps its fixed source layout. Use the drawer for issue structure and page settings."}
            </p>
          </div>

          <div className="canvas-editor-topbar-actions">
            {supportsCanvasEditing ? (
              <div className="design-tool-actions">
                <button type="button" className="design-tool-btn" onClick={() => addBlock("text")}>
                  <Type size={16} />
                  <span>Text</span>
                </button>
                <button type="button" className="design-tool-btn" onClick={() => addBlock("link")}>
                  <Link2 size={16} />
                  <span>Link</span>
                </button>
                <button type="button" className="design-tool-btn" onClick={() => addBlock("button")}>
                  <SquareStack size={16} />
                  <span>Button</span>
                </button>
                <button type="button" className="design-tool-btn" onClick={() => addBlock("video")}>
                  <Video size={16} />
                  <span>Video</span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="canvas-drawer-toggle"
              onClick={() => setIsDrawerOpen((current) => !current)}
              aria-expanded={isDrawerOpen}
              aria-label={isDrawerOpen ? "Hide editor tools" : "Show editor tools"}
            >
              {isDrawerOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
          </div>
        </div>

        <div className="canvas-editor-stage-frame">
          {page ? (
            supportsCanvasEditing && layout ? (
              <div
                ref={surfaceRef}
                className={`flip-page design-editor-page canvas-editor-page ${themeClass} ${isFullPageMedia ? "asset-cover-page" : ""}`}
                onPointerMove={handleDrag}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
              >
                <div className={`flip-page-frame mixed-page-frame layout-${layout.preset}`}>
                  <div
                    className={`mixed-page-layout ${themeClass} ${isSplitLayout ? "is-split" : ""} ${isSpotlightLayout ? "is-spotlight" : ""} ${isStackLayout ? "is-stack" : ""} ${isQuoteLayout ? "is-quote" : ""}`}
                  >
                    <div className="mixed-page-copy">
                      <span className="mixed-page-kicker">{layout.kicker}</span>
                      <h3>{layout.headline}</h3>
                      {layout.body ? <p className="mixed-page-body">{layout.body}</p> : null}
                    </div>

                    <div className="mixed-page-asset">
                      {page.contentKind === "image" ? <img className="mixed-image" src={page.contentUrl} alt={`${pageLabel} page`} /> : null}
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
                    </div>

                    <div className="design-block-layer">
                      {blocks.map((block) => {
                        const active = block.id === selectedBlockId;
                        const style = {
                          left: `${block.x}%`,
                          top: `${block.y}%`,
                          width: `${block.width}%`,
                          minHeight: `${block.height}%`
                        };

                        return (
                          <div
                            key={block.id}
                            className={`design-block design-block-${block.kind} ${active ? "active" : ""}`}
                            style={style}
                            onPointerDown={(event) => beginDrag(event, block.id)}
                            onClick={() => setSelectedBlockId(block.id)}
                          >
                            <div className="design-block-handle">
                              <Grip size={14} />
                              <span>{block.kind}</span>
                            </div>

                            {block.kind === "text" ? (
                              <div className="design-block-copy">
                                <strong>{block.label || "Text"}</strong>
                                {block.body ? <p>{block.body}</p> : null}
                              </div>
                            ) : null}

                            {block.kind === "link" ? (
                              <a href={block.url || "#"} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                                <Link2 size={14} />
                                <span>{block.label || "Open link"}</span>
                              </a>
                            ) : null}

                            {block.kind === "button" ? (
                              <a href={block.url || "#"} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                                <span>{block.label || "Learn more"}</span>
                                <ExternalLink size={14} />
                              </a>
                            ) : null}

                            {block.kind === "video" ? (
                              <div className="design-video-card">
                                <div className="design-video-label">
                                  <Video size={16} />
                                  <span>{block.label || "Video block"}</span>
                                </div>
                                {block.mediaUrl ? (
                                  isVimeoEmbedUrl(block.mediaUrl) ? (
                                    <iframe
                                      className="design-video-embed"
                                      src={block.mediaUrl}
                                      title={block.label || "Video block"}
                                      allow="autoplay; fullscreen; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : (
                                    <video src={block.mediaUrl} muted controls playsInline />
                                  )
                                ) : (
                                  <p>Add a video URL or use the page video.</p>
                                )}
                                {block.url ? (
                                  <a href={block.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                                    <span>{block.body || "Open linked destination"}</span>
                                    <ExternalLink size={14} />
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {blocks.length === 0 ? (
                        <div className="design-editor-empty">
                          <Plus size={18} />
                          <span>Add text, links, buttons, or video cards to this page.</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flip-page-number">{pageLabel}</div>
              </div>
            ) : (
              <div className="canvas-editor-placeholder">
                <div className="canvas-editor-placeholder-card">
                  <LayoutTemplate size={22} />
                  <strong>{page.title}</strong>
                  <p>
                    PDF pages keep their source layout. Use the drawer for cover, issue settings, page order, and page metadata.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="canvas-editor-placeholder">
              <div className="canvas-editor-placeholder-card">
                <LayoutTemplate size={22} />
                <strong>No page selected</strong>
                <p>Choose a page from the drawer or the strip below.</p>
              </div>
            </div>
          )}

          <div className="canvas-page-strip" aria-label="Magazine pages">
            {pages.map((entry, index) => (
              <button
                key={`editor-jump-${entry.id}`}
                type="button"
                className={`page-jump ${selectedPageId === entry.id ? "active" : ""}`}
                onClick={() => onSelectPage(entry.id)}
              >
                <span>Page {index + 1}</span>
                <small>{getContentLabel(entry.contentKind)}</small>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`canvas-editor-edge-toggle ${isDrawerOpen ? "open" : "closed"}`}
          onClick={() => setIsDrawerOpen((current) => !current)}
          aria-expanded={isDrawerOpen}
          aria-controls="canvas-editor-drawer"
          aria-label={isDrawerOpen ? "Collapse editor tools" : "Open editor tools"}
        >
          <span className="canvas-editor-edge-toggle-label">Tools</span>
          {isDrawerOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      <aside
        id="canvas-editor-drawer"
        className={`canvas-editor-drawer ${isDrawerOpen ? "open" : "closed"}`}
        aria-hidden={!isDrawerOpen}
      >
        <div className="canvas-editor-drawer-scroll">
          <div className="canvas-editor-drawer-head">
            <div>
              <p className="panel-label">Editor Tools</p>
              <h4>Magazine Controls</h4>
            </div>
            <button
              type="button"
              className="canvas-drawer-close"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close editor tools"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <section className="drawer-section">
            <label>Issue Settings</label>
            <input className="editor-input" value={book.title} onChange={(event) => updateBook({ title: event.target.value })} placeholder="Magazine title" />
            <textarea className="editor-input" value={book.description} onChange={(event) => updateBook({ description: event.target.value })} placeholder="Magazine description" />

            <div className="cover-preview-large drawer-cover-preview">
              {book.coverImageUrl ? (
                <img src={book.coverImageUrl} alt="Selected cover" />
              ) : (
                <div className="cover-preview-default">
                  <span className="cover-preview-default-label">Default Cover</span>
                  <span className="cover-preview-default-title">{book.title}</span>
                </div>
              )}
            </div>

            <div className="cover-selector drawer-cover-selector">
              <button type="button" className={`cover-option ${!book.coverImageUrl ? "active" : ""}`} onClick={() => updateBook({ coverImageUrl: undefined })}>
                <div className="cover-preview-placeholder">Default</div>
              </button>

              {imagePages.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`cover-option ${book.coverImageUrl === entry.contentUrl ? "active" : ""}`}
                  onClick={() => updateBook({ coverImageUrl: entry.contentUrl })}
                  title={entry.title}
                >
                  <img src={entry.contentUrl} alt={entry.title} className="cover-preview-img" />
                </button>
              ))}

              <button
                type="button"
                className={`cover-option cover-option-upload ${isCustomUpload ? "active" : ""}`}
                onClick={() => coverUploadRef.current?.click()}
                title="Upload custom cover image"
              >
                <ImagePlus size={18} />
                <span className="cover-upload-label">Upload</span>
              </button>
              <input ref={coverUploadRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: "none" }} />
            </div>
          </section>

          <section className="drawer-section">
            <label>Pages</label>
            <div className="page-order-list drawer-page-list">
              {pages.map((entry, index) => {
                const selected = entry.id === selectedPageId;
                return (
                  <div key={entry.id} className={`page-order-item ${selected ? "selected" : ""}`}>
                    <button type="button" className="page-order-main" onClick={() => onSelectPage(entry.id)}>
                      <div className="page-order-info">
                        {entry.contentKind === "image" || (entry.contentKind === "video" && entry.posterUrl) ? (
                          <img src={entry.contentKind === "image" ? entry.contentUrl : entry.posterUrl} alt="" className="page-order-thumb" />
                        ) : (
                          <div className="page-order-thumb page-order-thumb-placeholder">{getContentLabel(entry.contentKind).slice(0, 3)}</div>
                        )}
                        <span className="page-order-title">{index + 1}. {entry.title}</span>
                      </div>
                    </button>

                    <div className="page-order-actions">
                      <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0}>
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1}>
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" onClick={() => removePage(entry.id)} className="danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="drawer-section">
            <label>Vimeo Library</label>
            <p className="editor-hint">Add profile videos to the magazine one by one. They stay selectable instead of being dumped in by default.</p>
            <input
              className="editor-input"
              value={videoQuery}
              onChange={(event) => setVideoQuery(event.target.value)}
              placeholder="Search Vimeo videos"
            />
            <div className="catalog-video-list">
              {filteredCatalogPages.map((entry) => {
                const alreadyAdded = pages.some((pageEntry) => pageEntry.id === entry.id);
                return (
                  <article key={entry.id} className={`catalog-video-card ${alreadyAdded ? "is-added" : ""}`}>
                    <div className="catalog-video-thumb-shell">
                      {entry.posterUrl ? (
                        <img src={entry.posterUrl} alt="" className="catalog-video-thumb" />
                      ) : (
                        <div className="catalog-video-thumb catalog-video-thumb-empty" />
                      )}
                    </div>
                    <div className="catalog-video-copy">
                      <strong>{entry.title}</strong>
                      <span>{formatDuration(entry.durationSeconds)}</span>
                    </div>
                    <button
                      type="button"
                      className={`catalog-video-action ${alreadyAdded ? "is-added" : ""}`}
                      onClick={() => onAddCatalogPage(entry)}
                      disabled={alreadyAdded}
                    >
                      {alreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                      <span>{alreadyAdded ? "Added" : "Add"}</span>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {page ? (
            <section className="drawer-section">
              <label>Page Settings</label>
              <input
                className="editor-input"
                value={page.title}
                onChange={(event) => onUpdatePage(page.id, (currentPage) => ({ ...currentPage, title: event.target.value }))}
                placeholder="Page title"
              />
              <textarea
                className="editor-input"
                value={page.description}
                onChange={(event) => onUpdatePage(page.id, (currentPage) => ({ ...currentPage, description: event.target.value }))}
                placeholder="Page description"
              />
              <div className="layout-editor-grid compact-layout-grid">
                <div>
                  <label>Layout</label>
                  <select
                    className="editor-input"
                    value={page.layout?.preset ?? "auto"}
                    onChange={(event) => updatePageLayout(page.id, { preset: event.target.value as PageLayoutConfig["preset"] })}
                  >
                    {PAGE_LAYOUT_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Theme</label>
                  <select
                    className="editor-input"
                    value={page.layout?.theme ?? "cool"}
                    onChange={(event) => updatePageLayout(page.id, { theme: event.target.value as PageLayoutConfig["theme"] })}
                  >
                    {PAGE_LAYOUT_THEMES.map((theme) => (
                      <option key={theme.value} value={theme.value}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="layout-editor-wide">
                  <label>Kicker</label>
                  <input
                    className="editor-input"
                    value={page.layout?.kicker ?? ""}
                    onChange={(event) => updatePageLayout(page.id, { kicker: event.target.value })}
                    placeholder="Optional section label"
                  />
                </div>

                <div className="layout-editor-wide">
                  <label>Headline</label>
                  <input
                    className="editor-input"
                    value={page.layout?.headline ?? ""}
                    onChange={(event) => updatePageLayout(page.id, { headline: event.target.value })}
                    placeholder={page.title}
                  />
                </div>

                <div className="layout-editor-wide">
                  <label>Body Copy</label>
                  <textarea
                    className="editor-input"
                    value={page.layout?.body ?? ""}
                    onChange={(event) => updatePageLayout(page.id, { body: event.target.value })}
                    placeholder={page.description}
                  />
                </div>
              </div>
            </section>
          ) : null}

          <section className="drawer-section">
            <label>Block Settings</label>
            {selectedBlock ? (
              <>
                <input
                  className="editor-input"
                  value={selectedBlock.label ?? ""}
                  placeholder="Label"
                  onChange={(event) => patchSelectedBlock({ label: event.target.value })}
                />
                <textarea
                  className="editor-input"
                  value={selectedBlock.body ?? ""}
                  placeholder="Supporting copy"
                  onChange={(event) => patchSelectedBlock({ body: event.target.value })}
                />
                {(selectedBlock.kind === "link" || selectedBlock.kind === "button" || selectedBlock.kind === "video") ? (
                  <input
                    className="editor-input"
                    value={selectedBlock.url ?? ""}
                    placeholder="https://"
                    onChange={(event) => patchSelectedBlock({ url: event.target.value })}
                  />
                ) : null}
                {selectedBlock.kind === "video" ? (
                  <input
                    className="editor-input"
                    value={selectedBlock.mediaUrl ?? ""}
                    placeholder="Video URL"
                    onChange={(event) => patchSelectedBlock({ mediaUrl: event.target.value })}
                  />
                ) : null}
                <div className="design-size-grid">
                  <div>
                    <label>X</label>
                    <input
                      className="editor-input"
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(selectedBlock.x)}
                      onChange={(event) => patchSelectedBlock({ x: clamp(Number(event.target.value), 0, 100 - selectedBlock.width) })}
                    />
                  </div>
                  <div>
                    <label>Y</label>
                    <input
                      className="editor-input"
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(selectedBlock.y)}
                      onChange={(event) => patchSelectedBlock({ y: clamp(Number(event.target.value), 0, 100 - selectedBlock.height) })}
                    />
                  </div>
                  <div>
                    <label>W</label>
                    <input
                      className="editor-input"
                      type="number"
                      min={12}
                      max={100}
                      value={Math.round(selectedBlock.width)}
                      onChange={(event) => patchSelectedBlock({ width: clamp(Number(event.target.value), 12, 100) })}
                    />
                  </div>
                  <div>
                    <label>H</label>
                    <input
                      className="editor-input"
                      type="number"
                      min={8}
                      max={100}
                      value={Math.round(selectedBlock.height)}
                      onChange={(event) => patchSelectedBlock({ height: clamp(Number(event.target.value), 8, 100) })}
                    />
                  </div>
                </div>
                <button type="button" className="cover-clear-btn design-remove-btn" onClick={removeSelectedBlock}>
                  <Trash2 size={14} />
                  <span>Remove block</span>
                </button>
              </>
            ) : (
              <p className="editor-hint">
                {supportsCanvasEditing
                  ? "Select a block on the canvas, or add one from the top toolbar."
                  : "Block editing is available on non-PDF pages."}
              </p>
            )}
          </section>
        </div>

        <div className="canvas-editor-drawer-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            <X size={16} />
            <span>Cancel</span>
          </button>
          <button type="button" className="save-btn" onClick={onSave}>
            <Save size={16} />
            <span>Save Changes</span>
          </button>
          <button
            type="button"
            className="canvas-drawer-peek"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </aside>
    </div>
  );
}
