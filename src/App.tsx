import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ExternalLink, FileUp, Trash2 } from "lucide-react";
import { formatBytes, getContentKind, getContentLabel, normalizeTitle } from "./content";
import { assetBooks } from "./data/assetBooks";
import { getDocument } from "./pdf";
import { FlipbookViewer } from "./components/FlipbookViewer";
import { MagazineEditor } from "./components/MagazineEditor";
import type { FlipbookItem } from "./types";

const makeUploadId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};

export default function App() {
  const [books, setBooks] = useState<FlipbookItem[]>(assetBooks);
  const [selectedBookId, setSelectedBookId] = useState<string>(assetBooks[0]?.id ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const uploadUrlsRef = useRef<Map<string, string>>(new Map());

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );

  const presentationBookId = routePath.startsWith("/magazine/")
    ? decodeURIComponent(routePath.replace(/^\/magazine\//, ""))
    : "";

  const presentationBook = useMemo(
    () => (presentationBookId ? books.find((book) => book.id === presentationBookId) ?? null : null),
    [books, presentationBookId]
  );

  const navigateToPresentation = useCallback((bookId: string) => {
    const nextPath = `/magazine/${encodeURIComponent(bookId)}`;
    window.history.pushState(null, "", nextPath);
    setRoutePath(nextPath);
  }, []);

  const navigateToDashboard = useCallback(() => {
    window.history.pushState(null, "", "/");
    setRoutePath("/");
  }, []);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileUrl = URL.createObjectURL(file);
      const contentKind = getContentKind(file.name, file.type);
      let pageCount = 0;

      if (contentKind === "pdf") {
        const documentTask = getDocument({ data: await file.arrayBuffer() });
        const documentProxy = await documentTask.promise;
        pageCount = documentProxy.numPages;
        await documentProxy.destroy();
      }

      const nextBook: FlipbookItem = {
        id: makeUploadId(),
        title: normalizeTitle(file.name),
        description: `Local ${getContentLabel(contentKind).toLowerCase()} uploaded in the standalone app.`,
        contentUrl: fileUrl,
        contentKind,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        pageCount,
        source: "upload",
        createdAt: new Date().toISOString()
      };

      uploadUrlsRef.current.set(nextBook.id, fileUrl);
      setBooks((current) => [nextBook, ...current]);
      setSelectedBookId(nextBook.id);
    } catch (error) {
      console.error("Failed to load uploaded file", error);
      setUploadError("Failed to read this file.");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleRemoveBook = useCallback((bookId: string) => {
    const uploadUrl = uploadUrlsRef.current.get(bookId);
    if (uploadUrl) {
      URL.revokeObjectURL(uploadUrl);
      uploadUrlsRef.current.delete(bookId);
    }
    setBooks((current) => {
      const remaining = current.filter((book) => book.id !== bookId);
      setSelectedBookId((currentSelected) => (currentSelected === bookId ? remaining[0]?.id ?? "" : currentSelected));
      return remaining;
    });
  }, []);

  const handleViewerLoaded = useCallback((pageCount: number) => {
    setBooks((current) =>
      current.map((book) => (book.id === selectedBookId && book.pageCount !== pageCount ? { ...book, pageCount } : book))
    );
  }, [selectedBookId]);

  const handleUpdateBook = useCallback((updatedBook: FlipbookItem) => {
    setBooks((current) => current.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoutePath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    return () => {
      for (const uploadUrl of uploadUrlsRef.current.values()) {
        URL.revokeObjectURL(uploadUrl);
      }
      uploadUrlsRef.current.clear();
    };
  }, []);

  if (presentationBookId) {
    return (
      <main className="presentation-page">
        {presentationBook ? (
          <FlipbookViewer book={presentationBook} variant="presentation" onLoaded={handleViewerLoaded} />
        ) : (
          <section className="presentation-missing">
            <h1>Magazine not found</h1>
            <button type="button" onClick={navigateToDashboard}>
              Back to dashboard
            </button>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="app-hero">
        <div className="hero-copy">
          <p className="eyebrow">Asset-backed flipbook system</p>
          <h1>Aureus magazine viewer</h1>
          <p className="hero-text">
            The assets folder is folded into one magazine. The brochure pages, images, video, audio, and text live
            inside the same page-turning viewer instead of showing as separate library items.
          </p>
        </div>

        <div className="hero-actions">
          {selectedBook && !isEditing ? (
            <button type="button" className="presentation-launch" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }} onClick={() => setIsEditing(true)}>
              <span>Edit Magazine</span>
            </button>
          ) : null}

          {selectedBook ? (
            <button type="button" className="presentation-launch" onClick={() => navigateToPresentation(selectedBook.id)}>
              <ExternalLink size={16} />
              <span>Present magazine</span>
            </button>
          ) : null}

          <label className={`upload-cta ${isUploading ? "disabled" : ""}`}>
            <input type="file" onChange={handleFileUpload} disabled={isUploading} />
            <FileUp size={18} />
            <span>{isUploading ? "Reading file..." : "Upload file"}</span>
          </label>
        </div>
      </section>

      {uploadError ? <div className="upload-error">{uploadError}</div> : null}

      {!selectedBook ? (
        <section className="empty-state">
          <BookOpen size={28} />
          <h2>No flipbooks loaded</h2>
          <p>Upload a file to start using the standalone viewer.</p>
        </section>
      ) : (
        <div className="app-grid">
          <aside className="library-panel">
            <div className="library-header">
              <div>
                <h2>Library</h2>
                <p>{books.length} magazine{books.length === 1 ? "" : "s"} available</p>
              </div>
            </div>

            <div className="library-list">
              {books.map((book) => {
                const active = book.id === selectedBookId;
                return (
                  <article key={book.id} className={`library-card ${active ? "active" : ""}`}>
                    <div className="library-card-top">
                      <span className="source-pill">{book.source === "upload" ? "Upload" : getContentLabel(book.contentKind)}</span>
                      {book.source === "upload" ? (
                        <button
                          type="button"
                          className="delete-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveBook(book.id);
                          }}
                          aria-label={`Remove ${book.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>

                    <button type="button" className="library-card-body" onClick={() => setSelectedBookId(book.id)}>
                      <strong>{book.title}</strong>
                      <p>{book.description || "Interactive content item"}</p>

                      <div className="library-card-meta">
                        <span>
                          {book.contentKind === "pdf" || book.contentKind === "magazine"
                            ? `${book.pageCount || "--"} pages`
                            : getContentLabel(book.contentKind)}
                        </span>
                        <span>{formatBytes(book.sizeBytes) || new Date(book.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </aside>

          <div>
            <FlipbookViewer book={selectedBook} onLoaded={handleViewerLoaded} />
            {isEditing && (
              <MagazineEditor 
                book={selectedBook} 
                onSave={handleUpdateBook} 
                onClose={() => setIsEditing(false)} 
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
