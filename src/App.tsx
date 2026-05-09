import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ExternalLink, FileUp, Layers3, Sparkles, Trash2 } from "lucide-react";
import { formatBytes, getContentKind, getContentLabel, normalizeTitle } from "./content";
import { assetBooks } from "./data/assetBooks";
import { getDocument } from "./pdf";
import { FlipbookViewer } from "./components/FlipbookViewer";
import type { ContentPage, FlipbookItem } from "./types";

const makeUploadId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
};

const createUploadDescription = (contentKind: ContentPage["contentKind"], scope: "book" | "page", title?: string) => {
  const label = getContentLabel(contentKind).toLowerCase();
  if (scope === "page" && title) {
    return `Local ${label} added to ${title}.`;
  }
  return `Local ${label} uploaded in the standalone app.`;
};

const cloneBook = (book: FlipbookItem) => {
  if (typeof structuredClone === "function") {
    return structuredClone(book);
  }
  return JSON.parse(JSON.stringify(book)) as FlipbookItem;
};

export default function App() {
  const [books, setBooks] = useState<FlipbookItem[]>(assetBooks);
  const [selectedBookId, setSelectedBookId] = useState<string>(assetBooks[0]?.id ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftBook, setDraftBook] = useState<FlipbookItem | null>(null);
  const [editorPageId, setEditorPageId] = useState("");
  const [recentlyAddedPageId, setRecentlyAddedPageId] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const uploadUrlsRef = useRef<Map<string, string>>(new Map());

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );

  const workspaceBook = isEditing && draftBook?.id === selectedBookId ? draftBook : selectedBook;

  const totalPagesAcrossBooks = useMemo(
    () => books.reduce((total, book) => total + (book.pageCount || 0), 0),
    [books]
  );

  const uploadedBooksCount = useMemo(
    () => books.filter((book) => book.source === "upload").length,
    [books]
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

  const revokeUploadUrl = useCallback((entityId: string) => {
    const uploadUrl = uploadUrlsRef.current.get(entityId);
    if (!uploadUrl) {
      return;
    }

    URL.revokeObjectURL(uploadUrl);
    uploadUrlsRef.current.delete(entityId);
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

      if (selectedBook?.contentKind === "magazine") {
        const nextPage: ContentPage = {
          id: makeUploadId(),
          title: normalizeTitle(file.name),
          description: createUploadDescription(contentKind, "page", selectedBook.title),
          contentUrl: fileUrl,
          contentKind,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size
        };

        uploadUrlsRef.current.set(nextPage.id, fileUrl);
        setBooks((current) =>
          current.map((book) =>
            book.id === selectedBook.id
              ? {
                  ...book,
                  pages: [...(book.pages ?? []), nextPage],
                  pageCount: (book.pageCount || 0) + (contentKind === "pdf" ? pageCount : 1),
                  sizeBytes: (book.sizeBytes ?? 0) + file.size
                }
              : book
          )
        );
        setDraftBook((current) =>
          current && current.id === selectedBook.id
            ? {
                ...current,
                pages: [...(current.pages ?? []), nextPage],
                pageCount: (current.pageCount || 0) + (contentKind === "pdf" ? pageCount : 1),
                sizeBytes: (current.sizeBytes ?? 0) + file.size
              }
            : current
        );
        setSelectedBookId(selectedBook.id);
        setEditorPageId(nextPage.id);
        setRecentlyAddedPageId(nextPage.id);
        return;
      }

      const nextBook: FlipbookItem = {
        id: makeUploadId(),
        title: normalizeTitle(file.name),
        description: createUploadDescription(contentKind, "book"),
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
      setRecentlyAddedPageId(null);
    } catch (error) {
      console.error("Failed to load uploaded file", error);
      setUploadError("Failed to read this file.");
    } finally {
      setIsUploading(false);
    }
  }, [selectedBook]);

  const handleRemoveBook = useCallback((bookId: string) => {
    revokeUploadUrl(bookId);
    setBooks((current) => {
      const remaining = current.filter((book) => book.id !== bookId);
      setSelectedBookId((currentSelected) => (currentSelected === bookId ? remaining[0]?.id ?? "" : currentSelected));
      return remaining;
    });
    setDraftBook((current) => (current?.id === bookId ? null : current));
    if (selectedBookId === bookId) {
      setIsEditing(false);
      setEditorPageId("");
    }
  }, [revokeUploadUrl, selectedBookId]);

  const handleViewerLoaded = useCallback((pageCount: number) => {
    const activeBookId = presentationBookId || selectedBookId;
    setBooks((current) =>
      current.map((book) => (book.id === activeBookId && book.pageCount !== pageCount ? { ...book, pageCount } : book))
    );
  }, [presentationBookId, selectedBookId]);

  const handleUpdateBook = useCallback((updatedBook: FlipbookItem) => {
    setBooks((current) =>
      current.map((book) => {
        if (book.id !== updatedBook.id) {
          return book;
        }

        const nextPageIds = new Set((updatedBook.pages ?? []).map((page) => page.id));
        for (const page of book.pages ?? []) {
          if (!nextPageIds.has(page.id) && updatedBook.coverImageUrl !== page.contentUrl) {
            revokeUploadUrl(page.id);
          }
        }

        return updatedBook;
      })
    );
    setDraftBook(null);
    setIsEditing(false);
    setEditorPageId("");
    setRecentlyAddedPageId(null);
  }, [revokeUploadUrl]);

  const handleStartEditing = useCallback(() => {
    if (!selectedBook) {
      return;
    }

    const nextDraft = cloneBook(selectedBook);
    setDraftBook(nextDraft);
    setEditorPageId(nextDraft.pages?.[0]?.id ?? "");
    setIsEditing(true);
  }, [selectedBook]);

  const handleCancelEditing = useCallback(() => {
    setDraftBook(null);
    setEditorPageId("");
    setIsEditing(false);
    setRecentlyAddedPageId(null);
  }, []);

  const handleDraftBookChange = useCallback((updatedBook: FlipbookItem) => {
    setDraftBook(updatedBook);
  }, []);

  const handleDraftPageUpdate = useCallback((pageId: string, updater: (page: ContentPage) => ContentPage) => {
    setDraftBook((current) =>
      current
        ? {
            ...current,
            pages: (current.pages ?? []).map((page) => (page.id === pageId ? updater(page) : page))
          }
        : current
    );
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
      <div className="scene" aria-hidden="true">
        <div className="scene__blob scene__blob--1" />
        <div className="scene__blob scene__blob--2" />
        <div className="scene__blob scene__blob--3" />
      </div>

      <section className="app-hero">
        <div className="hero-backdrop" />
        <header className="app-masthead">
          <div>
            <p className="eyebrow">Aureus Edition</p>
            <div className="brand-lockup">
              <span className="brand-mark">A</span>
              <div>
                <h1>FlipSystem</h1>
                <p>Build and present Aureus magazines.</p>
              </div>
            </div>
          </div>

          <div className="masthead-meta">
            <span>Library {books.length}</span>
            <span>Pages {totalPagesAcrossBooks}</span>
          </div>
        </header>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Magazine Builder</p>
            <h2>Create, arrange, and present your magazine.</h2>
            <p className="hero-text">
              Add pages, choose the cover, set the order, and open a clean presentation view when it is ready.
            </p>

            <div className="hero-stats" aria-label="Library summary">
              <div className="glass-stat">
                <strong>{books.length}</strong>
                <span>Issues in library</span>
              </div>
              <div className="glass-stat">
                <strong>{uploadedBooksCount}</strong>
                <span>Local uploads</span>
              </div>
              <div className="glass-stat">
                <strong>{totalPagesAcrossBooks}</strong>
                <span>Total pages staged</span>
              </div>
            </div>

            <div className="hero-actions">
              {workspaceBook && !isEditing ? (
                <button type="button" className="secondary-action glass-action" onClick={handleStartEditing}>
                  <Sparkles size={16} />
                  <span>Edit issue</span>
                </button>
              ) : null}

              {workspaceBook ? (
                <button type="button" className="presentation-launch glass-action" onClick={() => navigateToPresentation(workspaceBook.id)}>
                  <ExternalLink size={16} />
                  <span>Present magazine</span>
                </button>
              ) : null}

              <label className={`upload-cta glass-action ${isUploading ? "disabled" : ""}`}>
                <input type="file" onChange={handleFileUpload} disabled={isUploading} />
                <FileUp size={18} />
                <span>
                  {isUploading
                    ? "Reading file..."
                    : workspaceBook?.contentKind === "magazine"
                      ? "Add file as page"
                      : "Upload file"}
                </span>
              </label>
            </div>
          </div>

          <aside className="hero-spotlight">
            <div className="spotlight-kicker">
              <Layers3 size={16} />
              <span>Current selection</span>
            </div>
            {workspaceBook ? (
              <>
                <div className="spotlight-body">
                  <div>
                    <p className="spotlight-label">{workspaceBook.source === "upload" ? "Uploaded" : "Current issue"}</p>
                    <h3>{workspaceBook.title}</h3>
                    <p>{workspaceBook.description || "Ready to review."}</p>
                  </div>
                  <div className="spotlight-metrics">
                    <span>{workspaceBook.pageCount || "--"} pages</span>
                    <span>{workspaceBook.contentKind === "magazine" ? "Magazine" : getContentLabel(workspaceBook.contentKind)}</span>
                  </div>
                </div>
                <div className="spotlight-footer">
                  <span>{workspaceBook.fileName ?? "Curated from assets"}</span>
                  <span>{formatBytes(workspaceBook.sizeBytes) || new Date(workspaceBook.createdAt).toLocaleDateString()}</span>
                </div>
              </>
            ) : (
              <div className="spotlight-empty">
                <BookOpen size={18} />
                <span>Select a magazine to get started.</span>
              </div>
            )}
          </aside>
        </div>
      </section>

      {uploadError ? <div className="upload-error">{uploadError}</div> : null}

      {!selectedBook ? (
        <section className="empty-state">
          <BookOpen size={28} />
          <h2>No magazines yet</h2>
          <p>Upload a file to start.</p>
        </section>
      ) : (
        <div className="app-grid">
          <aside className="library-panel">
            <div className="library-header">
              <div>
                <p className="panel-label">Library</p>
                <h2>Magazines</h2>
                <p>{books.length} issue{books.length === 1 ? "" : "s"}</p>
              </div>
            </div>

            <div className="library-list">
              {books.map((book, index) => {
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
                      <span className="library-card-index">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{book.title}</strong>
                      <p>{book.description || "Ready to review."}</p>

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

          <div className="workspace-panel">
            <FlipbookViewer
              book={workspaceBook ?? selectedBook}
              onLoaded={handleViewerLoaded}
              editor={
                isEditing && draftBook
                  ? {
                      book: draftBook,
                      selectedPageId: editorPageId,
                      onSelectPage: setEditorPageId,
                      onChange: handleDraftBookChange,
                      onUpdatePage: handleDraftPageUpdate,
                      onSave: () => handleUpdateBook(draftBook),
                      onClose: handleCancelEditing
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </main>
  );
}
