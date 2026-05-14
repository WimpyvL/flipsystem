import React, { useRef } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Save, Trash2, X } from "lucide-react";
import { getContentLabel } from "../content";
import { PAGE_LAYOUT_PRESETS, PAGE_LAYOUT_THEMES } from "../pageLayouts";
import type { ContentPage, FlipbookItem, PageLayoutConfig } from "../types";

type MagazineEditorProps = {
  book: FlipbookItem;
  selectedPageId: string;
  onSelectPage: (pageId: string) => void;
  onChange: (updatedBook: FlipbookItem) => void;
  onCoverUpload: (file: File) => void;
  onSave: () => void;
  onClose: () => void;
};

export function MagazineEditor({ book, selectedPageId, onSelectPage, onChange, onCoverUpload, onSave, onClose }: MagazineEditorProps) {
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const selectedPage = book.pages?.find((page) => page.id === selectedPageId) ?? null;
  const imagePages = (book.pages ?? []).filter((page) => page.contentKind === "image");
  const isCustomUpload = Boolean(book.coverImageUrl) && !imagePages.some((page) => page.contentUrl === book.coverImageUrl);

  const updateBook = (patch: Partial<FlipbookItem>) => onChange({ ...book, ...patch });

  const updatePages = (updater: (pages: ContentPage[]) => ContentPage[]) => {
    updateBook({ pages: updater([...(book.pages ?? [])]) });
  };

  const updatePage = (pageId: string, updater: (page: ContentPage) => ContentPage) => {
    updatePages((pages) => pages.map((page) => (page.id === pageId ? updater(page) : page)));
  };

  const updatePageLayout = (pageId: string, patch: Partial<PageLayoutConfig>) => {
    updatePage(pageId, (page) => ({
      ...page,
      layout: {
        preset: page.layout?.preset ?? "auto",
        theme: page.layout?.theme ?? "cool",
        kicker: page.layout?.kicker ?? "",
        headline: page.layout?.headline ?? "",
        body: page.layout?.body ?? "",
        ...patch
      }
    }));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= (book.pages?.length ?? 0)) {
      return;
    }

    updatePages((pages) => {
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePage = (pageId: string) => {
    updatePages((pages) => {
      const remaining = pages.filter((page) => page.id !== pageId);
      if (selectedPageId === pageId) {
        onSelectPage(remaining[0]?.id ?? "");
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

  return (
    <div className="magazine-editor-panel">
      <div className="editor-header">
        <div>
          <h3>Edit Magazine</h3>
          <p className="editor-hint">The live page tools are in the preview above. Use this panel for structure and metadata.</p>
        </div>
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="editor-section">
        <label>Front Cover</label>
        <p className="editor-hint">Choose an image from the issue, upload a custom cover, or leave it on the default cover.</p>

        <div className="cover-preview-large">
          {book.coverImageUrl ? (
            <img src={book.coverImageUrl} alt="Selected cover" />
          ) : (
            <div className="cover-preview-default">
              <span className="cover-preview-default-label">Default Cover</span>
              <span className="cover-preview-default-title">{book.title}</span>
            </div>
          )}
        </div>

        <div className="cover-selector">
          <button type="button" className={`cover-option ${!book.coverImageUrl ? "active" : ""}`} onClick={() => updateBook({ coverImageUrl: undefined })}>
            <div className="cover-preview-placeholder">Default</div>
          </button>

          {imagePages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={`cover-option ${book.coverImageUrl === page.contentUrl ? "active" : ""}`}
              onClick={() => updateBook({ coverImageUrl: page.contentUrl })}
              title={page.title}
            >
              <img src={page.contentUrl} alt={page.title} className="cover-preview-img" />
            </button>
          ))}

          <button
            type="button"
            className={`cover-option cover-option-upload ${isCustomUpload ? "active" : ""}`}
            onClick={() => coverUploadRef.current?.click()}
            title="Upload custom cover image"
          >
            <ImagePlus size={20} />
            <span className="cover-upload-label">Upload</span>
          </button>
          <input ref={coverUploadRef} type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: "none" }} />
        </div>
      </div>

      <div className="editor-section">
        <label>Title</label>
        <input className="editor-input" value={book.title} onChange={(event) => updateBook({ title: event.target.value })} />
      </div>

      <div className="editor-section">
        <label>Description</label>
        <textarea className="editor-input" value={book.description} onChange={(event) => updateBook({ description: event.target.value })} />
      </div>

      {(book.pages?.length ?? 0) > 0 ? (
        <div className="editor-section">
          <label>Page Order</label>
          <div className="page-order-list">
            {book.pages?.map((page, index) => {
              const selected = page.id === selectedPageId;
              return (
                <div key={page.id} className={`page-order-item ${selected ? "selected" : ""}`}>
                  <button type="button" className="page-order-main" onClick={() => onSelectPage(page.id)}>
                    <div className="page-order-info">
                      {page.contentKind === "image" ? (
                        <img src={page.contentUrl} alt="" className="page-order-thumb" />
                      ) : (
                        <div className="page-order-thumb page-order-thumb-placeholder">{getContentLabel(page.contentKind).slice(0, 3)}</div>
                      )}
                      <span className="page-order-title">{index + 1}. {page.title}</span>
                    </div>
                  </button>

                  <div className="page-order-actions">
                    <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => movePage(index, 1)} disabled={index === (book.pages?.length ?? 0) - 1}>
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" onClick={() => removePage(page.id)} className="danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedPage ? (
        <div className="editor-section">
          <label>Page Layout</label>
          <p className="editor-hint">Set the base page layout here. Use the live canvas above for block placement and linked overlays.</p>

          <div className="layout-editor-card">
            <div className="layout-editor-head">
              <div>
                <strong>{selectedPage.title}</strong>
                <p>{getContentLabel(selectedPage.contentKind)} page</p>
              </div>
            </div>

            {selectedPage.contentKind === "pdf" ? (
              <div className="layout-editor-note">
                PDF pages keep their document layout. Reorder them here, but edit overlays on the non-PDF pages.
              </div>
            ) : (
              <div className="layout-editor-grid">
                <div>
                  <label>Layout Preset</label>
                  <select
                    className="editor-input"
                    value={selectedPage.layout?.preset ?? "auto"}
                    onChange={(event) => updatePageLayout(selectedPage.id, { preset: event.target.value as PageLayoutConfig["preset"] })}
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
                    value={selectedPage.layout?.theme ?? "cool"}
                    onChange={(event) => updatePageLayout(selectedPage.id, { theme: event.target.value as PageLayoutConfig["theme"] })}
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
                    placeholder="Optional section label"
                    value={selectedPage.layout?.kicker ?? ""}
                    onChange={(event) => updatePageLayout(selectedPage.id, { kicker: event.target.value })}
                  />
                </div>

                <div className="layout-editor-wide">
                  <label>Headline Override</label>
                  <input
                    className="editor-input"
                    placeholder={selectedPage.title}
                    value={selectedPage.layout?.headline ?? ""}
                    onChange={(event) => updatePageLayout(selectedPage.id, { headline: event.target.value })}
                  />
                </div>

                <div className="layout-editor-wide">
                  <label>Body Copy Override</label>
                  <textarea
                    className="editor-input"
                    placeholder={selectedPage.description}
                    value={selectedPage.layout?.body ?? ""}
                    onChange={(event) => updatePageLayout(selectedPage.id, { body: event.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="editor-footer">
        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="save-btn" onClick={onSave}>
          <Save size={16} /> Save Changes
        </button>
      </div>
    </div>
  );
}
