import { Combobox, Transition } from "@headlessui/react";
import { ArrowDownTrayIcon, DocumentMagnifyingGlassIcon, LinkIcon } from "@heroicons/react/24/outline";
import { Fragment, ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import ContractAnalysisModal from "./ContractAnalysisModal";
import DocumentDetailsModal, { PortalDocument } from "./DocumentDetailsModal";
import { api } from "../../lib/api";

interface MatterOption {
  id: string;
  title: string;
  reference_code: string;
}

type PortalDoc = PortalDocument;

const fetcher = <T,>(url: string) => api.get<T>(url);
const PAGE_SIZE = 10;

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

const renderDocumentSkeleton = (rows = 5) =>
  Array.from({ length: rows }).map((_, index) => (
    <li key={`doc-skeleton-${index}`} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <span className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            <span className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="flex items-center gap-2 sm:gap-3">
            {Array.from({ length: 3 }).map((__, actionIndex) => (
              <span
                key={actionIndex}
                className="inline-flex h-9 w-9 animate-pulse rounded-full bg-slate-200"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>
    </li>
  ));
const PortalPage = () => {
  const [page, setPage] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const offset = page * PAGE_SIZE;
  const documentsKey = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (searchValue.trim()) {
      params.set("search", searchValue.trim());
    }
    return `/documents/?${params.toString()}`;
  }, [offset, searchValue]);
  const { data, mutate, isLoading } = useSWR<PaginatedResponse<PortalDoc>>(documentsKey, fetcher);
  const [matterSearch, setMatterSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(matterSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [matterSearch]);

  const mattersKey = useMemo(() => {
    const params = new URLSearchParams({ limit: "10" });
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    return `/matters/?${params.toString()}`;
  }, [debouncedSearch]);

  const {
    data: mattersData,
    isLoading: isMattersLoading,
  } = useSWR<PaginatedResponse<MatterOption>>(mattersKey, fetcher);

  const matters = mattersData?.results ?? [];
  const documents = data?.results ?? [];
  const totalDocuments = data?.count ?? 0;
  const hasPrevious = page > 0;
  const hasNext = offset + documents.length < totalDocuments;
  const [fileMeta, setFileMeta] = useState<{ matter: string; file: File | null }>({ matter: "", file: null });
  const [selectedMatter, setSelectedMatter] = useState<MatterOption | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [togglingDocumentId, setTogglingDocumentId] = useState<string | null>(null);
  const [analysisDoc, setAnalysisDoc] = useState<PortalDoc | null>(null);
  const [detailsDocument, setDetailsDocument] = useState<PortalDoc | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    
    // Reset status when new file is selected
    setStatus(null);
    setUploadProgress(0);
    
    // Basic file validation
    if (file) {
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        setStatus("❌ File too large. Maximum size is 100MB.");
        return;
      }
      
      // Clear any previous error
      if (status?.includes('❌')) {
        setStatus(null);
      }
    }
    
    setFileMeta((prev) => ({ ...prev, file }));
  };

  const resetForm = () => {
    setFileMeta({ matter: "", file: null });
    setSelectedMatter(null);
    setMatterSearch("");
    setStatus(null);
    setUploadProgress(0);
    setIsUploading(false);
    
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const submitDoc = async (event: FormEvent) => {
    event.preventDefault();
    if (!fileMeta.file || !fileMeta.matter || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setStatus("Preparing upload...");

    try {
      // Step 1: Calculate file hash
      setStatus("Calculating file hash...");
      const buffer = await fileMeta.file.arrayBuffer();
      const sha = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(sha));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      setUploadProgress(10);

      // Step 2: Create document record and get presigned URL
      setStatus("Creating document record...");
      const init = await api.post<{ 
        document: Document; 
        upload_url: { url: string; headers: Record<string, string> } 
      }>("/documents/", {
        matter: fileMeta.matter,
        filename: fileMeta.file.name,
        mime: fileMeta.file.type,
        size: fileMeta.file.size,
        sha256: hashHex,
      });
      setUploadProgress(20);

      if (!init.upload_url?.url) {
        throw new Error("No upload URL received from server");
      }

      // Step 3: Upload file to MinIO using presigned URL with progress tracking
      setStatus("Uploading file to storage...");
      
      const uploadResponse = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 70) + 20; // 20-90%
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.response, { 
              status: xhr.status, 
              statusText: xhr.statusText 
            }));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });

        xhr.open('PUT', init.upload_url.url);
        
        // Set headers from presigned URL
        Object.entries(init.upload_url.headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.timeout = 300000; // 5 minute timeout
        xhr.send(fileMeta.file);
      });

      setUploadProgress(90);

      // Step 4: Verify upload was successful
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      setStatus("Verifying upload...");
      setUploadProgress(95);

      // Step 5: Refresh document list to confirm upload
      await mutate();
      setUploadProgress(100);
      setStatus("✅ Upload completed successfully!");

      // Reset to first page to show new document
      setPage(0);

      // Clear success message and reset form after 3 seconds
      setTimeout(() => {
        resetForm();
      }, 3000);

    } catch (error) {
      console.error("Upload failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setStatus(`❌ Upload failed: ${errorMessage}`);
      setUploadProgress(0);
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setStatus(null);
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadDocument = async (documentId: string, filename: string) => {
    try {
      setStatus("Generating download link...");
      const response = await api.get<{ url: { url: string } }>(`/documents/${documentId}/download/`);
      
      if (!response.url?.url) {
        throw new Error("No download URL received");
      }

      // Create a temporary link and trigger download
      const link = window.document.createElement('a');
      link.href = response.url.url;
      link.download = filename;
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      setStatus("✅ Download started!");
      setTimeout(() => setStatus(null), 2000);
    } catch (error) {
      console.error("Download failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Download failed";
      setStatus(`❌ ${errorMessage}`);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const copyDownloadLink = async (documentId: string) => {
    try {
      const response = await api.get<{ url: { url: string } }>(`/documents/${documentId}/download/`);
      
      if (!response.url?.url) {
        throw new Error("No download URL received");
      }

      await navigator.clipboard.writeText(response.url.url);
      setStatus("✅ Download link copied to clipboard!");
      setTimeout(() => setStatus(null), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      setStatus("❌ Failed to copy link");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const toggleClientVisibility = async (doc: PortalDoc) => {
    const nextValue = !doc.client_visible;
    try {
      setTogglingDocumentId(doc.id);
      await api.patch(`/documents/${doc.id}/`, { client_visible: nextValue });
      await mutate();
      setStatus(nextValue ? "✅ Document shared with client" : "✅ Document hidden from client");
      setTimeout(() => setStatus(null), 2000);
    } catch (error) {
      console.error("Visibility toggle failed:", error);
      setStatus("❌ Unable to update client visibility");
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setTogglingDocumentId(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Document Upload</h2>
        <form onSubmit={submitDoc} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block text-slate-600">Matter</label>
            <Combobox
              value={selectedMatter}
              onChange={(value) => {
                setSelectedMatter(value);
                setFileMeta((prev) => ({ ...prev, matter: value?.id ?? "" }));
              }}
              disabled={isMattersLoading && !mattersData}
            >
              <div className="relative mt-1">
                <Combobox.Input
                  className="w-full rounded border border-slate-300 p-2 text-sm focus:border-primary-500 focus:outline-none"
                  placeholder={matters.length ? "Search matters…" : "Create a matter first"}
                  displayValue={(matter: MatterOption | null) =>
                    matter ? `${matter.reference_code} · ${matter.title}` : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    setMatterSearch(value);
                    if (!value) {
                      setSelectedMatter(null);
                      setFileMeta((prev) => ({ ...prev, matter: "" }));
                    }
                  }}
                  required
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Combobox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                  afterLeave={() => {
                    if (!selectedMatter) {
                      setMatterSearch("");
                    }
                  }}
                >
                  <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
                    {isMattersLoading ? (
                      <div className="px-3 py-2 text-slate-500">Loading matters…</div>
                    ) : matters.length === 0 ? (
                      <div className="px-3 py-2 text-slate-500">No matters found</div>
                    ) : (
                      matters.map((matter) => (
                        <Combobox.Option
                          key={matter.id}
                          value={matter}
                          className={({ active }) =>
                            `cursor-pointer select-none px-3 py-2 ${
                              active ? "bg-primary-50 text-primary-700" : "text-slate-700"
                            }`
                          }
                        >
                          {matter.reference_code} · {matter.title}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </Transition>
              </div>
            </Combobox>
          </div>
          <div>
            <label className="block text-slate-600">File</label>
            <input 
              type="file" 
              onChange={onFileChange} 
              className="mt-1 w-full text-sm" 
              required 
              disabled={isUploading}
            />
            {fileMeta.file && (
              <div className="mt-2 text-xs text-slate-500">
                Selected: {fileMeta.file.name} ({(fileMeta.file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>
          <button
            className="rounded bg-primary-600 px-3 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!fileMeta.matter || !fileMeta.file || isUploading}
          >
            {isUploading ? "Uploading..." : "Upload Document"}
          </button>
          
          {/* Progress bar */}
          {isUploading && (
            <div className="w-full">
              <div className="mb-1 text-xs text-slate-600">Upload Progress</div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-slate-500">{uploadProgress}%</div>
            </div>
          )}
          
          {/* Status message */}
          {status && (
            <div className={`p-3 rounded text-sm ${
              status.includes('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 
              status.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <span>{status}</span>
                {status.includes('❌') && !isUploading && (
                  <button
                    onClick={resetForm}
                    className="ml-3 text-xs underline hover:no-underline"
                  >
                    Clear & Try Again
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </section>
      <section className="rounded bg-white p-6 shadow">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold text-slate-700">Recent Documents</h2>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(0);
            }}
            placeholder="Search documents..."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none lg:max-w-xs"
          />
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {isLoading && !data ? (
            renderDocumentSkeleton()
          ) : documents.length ? (
            documents.map((doc) => (
              <li key={doc.id} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="font-medium text-primary-600 hover:underline"
                        onClick={() => setDetailsDocument(doc)}
                      >
                        {doc.filename}
                      </button>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">v{doc.version}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(doc.uploaded_at).toLocaleString()}</span>
                      <span>• {(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          doc.scan_status === "clean"
                            ? "bg-emerald-100 text-emerald-700"
                            : doc.scan_status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {doc.scan_status}
                      </span>
                    </div>
                  </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={doc.client_visible}
                          onChange={() => toggleClientVisibility(doc)}
                          disabled={togglingDocumentId === doc.id}
                        />
                        Portal access
                      </label>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => downloadDocument(doc.id, doc.filename)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                        title="Download file"
                        aria-label="Download document"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        <span className="sr-only">Download</span>
                      </button>
                      <button
                        onClick={() => copyDownloadLink(doc.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                        title="Copy download link"
                        aria-label="Copy download link"
                      >
                        <LinkIcon className="h-4 w-4" />
                        <span className="sr-only">Copy Link</span>
                      </button>
                      <button
                        onClick={() => setAnalysisDoc(doc)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                        title="Analyze contract"
                        aria-label="Analyze contract"
                      >
                        <DocumentMagnifyingGlassIcon className="h-4 w-4" />
                        <span className="sr-only">Analyze</span>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="text-slate-500">No documents yet.</li>
          )}
        </ul>
        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {totalDocuments === 0
              ? "No results"
              : documents.length === 0
              ? `Showing 0 of ${totalDocuments}`
              : `Showing ${offset + 1}-${offset + documents.length} of ${totalDocuments}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={!hasPrevious}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasPrevious ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => (hasNext ? prev + 1 : prev))}
              disabled={!hasNext}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                hasNext ? "border-slate-300 hover:border-primary-500 hover:text-primary-600" : "border-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <ContractAnalysisModal
        isOpen={Boolean(analysisDoc)}
        onClose={() => setAnalysisDoc(null)}
        documentName={analysisDoc?.filename}
      />
      {detailsDocument ? (
        <DocumentDetailsModal
          isOpen={Boolean(detailsDocument)}
          document={detailsDocument}
          onClose={() => setDetailsDocument(null)}
          onVersionUploaded={async () => {
            const updated = await mutate();
            const refreshed = updated?.results?.find((doc: PortalDoc) => doc.id === detailsDocument.id);
            if (refreshed) {
              setDetailsDocument(refreshed);
            }
          }}
        />
      ) : null}
    </div>
  );
};

export default PortalPage;
