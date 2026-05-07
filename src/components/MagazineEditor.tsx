import React, { useRef } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Save, Trash2, X } from "lucide-react";
import { getContentLabel } from "../content";
import type { FlipbookItem, ContentPage } from "../types";

type MagazineEditorProps = {
  book: FlipbookItem;
  onSave: (updatedBook: FlipbookItem) => void;
  onClose: () => void;
};

export function MagazineEditor({ book, onSave, onClose }: MagazineEditorProps) {
  const [title, setTitle] = React.useState(book.title);
  const [description, setDescription] = React.useState(book.description);
  const [coverImageUrl, setCoverImageUrl] = React.useState(book.coverImageUrl || "");
  const [pages, setPages] = React.useState<ContentPage[]>(book.pages || []);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const uploadedCoverUrlRef = useRef<string | null>(null);

  const handleSave = () => {
    onSave({
      ...book,
      title,
      description,
      coverImageUrl: coverImageUrl || undefined,
      pages,
    });
    onClose();
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    // Revoke old uploaded URL if exists
    if (uploadedCoverUrlRef.current) {
      URL.revokeObjectURL(uploadedCoverUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    uploadedCoverUrlRef.current = url;
    setCoverImageUrl(url);
  };

  const movePageUp = (index: number) => {
    if (index === 0) return;
    const next = [...pages];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setPages(next);
  };

  const movePageDown = (index: number) => {
    if (index === pages.length - 1) return;
    const next = [...pages];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setPages(next);
  };

  const removePage = (id: string) => {
    setPages(pages.filter((p) => p.id !== id));
  };

  // All image pages can serve as cover options
  const imagePages = pages.filter((p) => p.contentKind === "image");
  // Check if the current cover is a custom upload (not from any image page)
  const isCustomUpload = coverImageUrl && !imagePages.some((p) => p.contentUrl === coverImageUrl);

  return (
    <div className="magazine-editor-panel">
      <div className="editor-header">
        <h3>Edit Magazine</h3>
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* --- Front Cover Section --- */}
      <div className="editor-section">
        <label>Front Cover</label>
        <p className="editor-hint">Choose an image from your magazine pages, upload a custom cover, or use the default.</p>

        {/* Current cover preview */}
        <div className="cover-preview-large">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="Selected cover" />
          ) : (
            <div className="cover-preview-default">
              <span className="cover-preview-default-label">Default Cover</span>
              <span className="cover-preview-default-title">{title}</span>
            </div>
          )}
        </div>

        {/* Cover options */}
        <div className="cover-selector">
          <button
            type="button"
            className={`cover-option ${!coverImageUrl ? "active" : ""}`}
            onClick={() => setCoverImageUrl("")}
          >
            <div className="cover-preview-placeholder">Default</div>
          </button>

          {imagePages.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cover-option ${coverImageUrl === p.contentUrl ? "active" : ""}`}
              onClick={() => setCoverImageUrl(p.contentUrl)}
              title={p.title}
            >
              <img src={p.contentUrl} alt={p.title} className="cover-preview-img" />
            </button>
          ))}

          {/* Upload custom cover */}
          <button
            type="button"
            className={`cover-option cover-option-upload ${isCustomUpload ? "active" : ""}`}
            onClick={() => coverUploadRef.current?.click()}
            title="Upload custom cover image"
          >
            <ImagePlus size={20} />
            <span className="cover-upload-label">Upload</span>
          </button>
          <input
            ref={coverUploadRef}
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            style={{ display: "none" }}
          />
        </div>

        {coverImageUrl && (
          <button
            type="button"
            className="cover-clear-btn"
            onClick={() => setCoverImageUrl("")}
          >
            Remove cover image
          </button>
        )}
      </div>

      {/* --- Title & Description --- */}
      <div className="editor-section">
        <label>Title</label>
        <input className="editor-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="editor-section">
        <label>Description</label>
        <textarea className="editor-input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {/* --- Page Order --- */}
      {pages.length > 0 && (
        <div className="editor-section">
          <label>Page Order</label>
          <div className="page-order-list">
            {pages.map((p, i) => (
              <div key={p.id} className="page-order-item">
                <div className="page-order-info">
                  {p.contentKind === "image" ? (
                    <img src={p.contentUrl} alt="" className="page-order-thumb" />
                  ) : (
                    <div className="page-order-thumb page-order-thumb-placeholder">
                      {getContentLabel(p.contentKind).slice(0, 3)}
                    </div>
                  )}
                  <span className="page-order-title">{i + 1}. {p.title}</span>
                </div>
                <div className="page-order-actions">
                  <button type="button" onClick={() => movePageUp(i)} disabled={i === 0}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => movePageDown(i)} disabled={i === pages.length - 1}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" onClick={() => removePage(p.id)} className="danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="editor-footer">
        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="save-btn" onClick={handleSave}>
          <Save size={16} /> Save Changes
        </button>
      </div>
    </div>
  );
}
