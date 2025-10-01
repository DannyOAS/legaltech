import { ChangeEvent, FormEvent, useState } from "react";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import TextAreaField from "../../components/ui/TextAreaField";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";

interface DocumentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: PortalDocument;
  onVersionUploaded: () => void;
}

export interface PortalDocument {
  id: string;
  filename: string;
  mime: string;
  size: number;
  uploaded_at: string;
  client_visible: boolean;
  version: number;
  scan_status: string;
  scan_message?: string | null;
}

interface DocumentVersion {
  id: string;
  version_number: number;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  uploaded_at: string;
  uploaded_by?: string | null;
  download_url: string;
}

interface DocumentComment {
  id: string;
  body: string;
  created_at: string;
  author: string | null;
  author_name: string;
}

interface CommentResponse {
  results: DocumentComment[];
  count: number;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const formatBytes = (size: number) => {
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(size) / Math.log(1024));
  const value = size / Math.pow(1024, index);
  return `${value.toFixed(2)} ${units[index]}`;
};

const statusBadgeClass: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  clean: "bg-emerald-100 text-emerald-700",
  infected: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

const DocumentDetailsModal = ({ isOpen, onClose, document, onVersionUploaded }: DocumentDetailsModalProps) => {
  const toast = useToast();
  const {
    data: versions,
    mutate: mutateVersions,
  } = useSWR<DocumentVersion[]>(
    isOpen ? `/documents/${document.id}/versions/` : null,
    fetcher,
    { suspense: false },
  );
  const { data: commentsData, mutate: mutateComments } = useSWR<CommentResponse>(
    isOpen ? `/document-comments/?document=${document.id}` : null,
    fetcher,
  );
  const comments = commentsData?.results ?? [];
  const [commentBody, setCommentBody] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const closeModal = () => {
    setFile(null);
    setUploadStatus(null);
    setUploadProgress(0);
    setCommentBody("");
    onClose();
  };

  const handleCommentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!commentBody.trim()) {
      toast.error("Unable to post comment", "Comment cannot be empty.");
      return;
    }
    setIsPostingComment(true);
    try {
      await api.post("/document-comments/", { document: document.id, body: commentBody.trim() });
      setCommentBody("");
      await mutateComments();
      toast.success("Comment added", "Your note has been saved.");
    } catch (error) {
      toast.error("Unable to post comment", error instanceof ApiError ? error.payload.detail ?? "Try again later." : "Unexpected error");
    } finally {
      setIsPostingComment(false);
    }
  };

  const uploadNewVersion = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error("Select a file", "Choose a file to upload a new version.");
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("Preparing upload...");
    try {
      const buffer = await file.arrayBuffer();
      const sha = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(sha));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      setUploadStatus("Requesting upload URL...");
      const init = await api.post<{ upload_url: { url: string; headers: Record<string, string> } }>(
        `/documents/${document.id}/upload-version/`,
        {
          filename: file.name,
          mime: file.type,
          size: file.size,
          sha256: hashHex,
        },
      );
      if (!init.upload_url?.url) {
        throw new Error("No upload URL returned");
      }
      setUploadStatus("Uploading...");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.addEventListener("timeout", () => reject(new Error("Upload timeout")));
        xhr.open("PUT", init.upload_url.url);
        Object.entries(init.upload_url.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.timeout = 300000;
        xhr.send(file);
      });
      setUploadStatus("Finalizing...");
      await mutateVersions();
      await onVersionUploaded();
      toast.success("New version uploaded", `${file.name} uploaded successfully.`);
      setFile(null);
      setUploadStatus(null);
      setUploadProgress(0);
    } catch (error) {
      toast.error("Unable to upload version", error instanceof Error ? error.message : "Unexpected error");
      setUploadStatus("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={`Document Details`} size="lg" footer={null}>
      <div className="space-y-6 text-sm text-slate-600">
        <section className="rounded border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
          <dl className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">Filename</dt>
              <dd>{document.filename}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Current Version</dt>
              <dd>{document.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Size</dt>
              <dd>{formatBytes(document.size)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Scan Status</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    statusBadgeClass[document.scan_status] ?? "bg-slate-200 text-slate-700"
                  }`}
                >
                  {document.scan_status}
                </span>
                {document.scan_message ? <span className="ml-2 text-xs text-slate-500">{document.scan_message}</span> : null}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Version History</h3>
          </div>
          {!versions ? (
            <div className="flex justify-center py-6">
              <Spinner size="md" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-slate-500">No versions recorded yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-slate-600">Version</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-600">Filename</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-600">Size</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-600">Uploaded</th>
                  <th className="px-2 py-1 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td className="px-2 py-1">{version.version_number}</td>
                    <td className="px-2 py-1 text-slate-600">{version.filename}</td>
                    <td className="px-2 py-1">{formatBytes(version.size)}</td>
                    <td className="px-2 py-1">{new Date(version.uploaded_at).toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const link = window.document.createElement("a");
                          link.href = version.download_url;
                          link.download = version.filename;
                          link.target = "_blank";
                          window.document.body.appendChild(link);
                          link.click();
                          window.document.body.removeChild(link);
                        }}
                      >
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form className="mt-4 space-y-2" onSubmit={uploadNewVersion}>
            <label className="block text-xs font-medium text-slate-600">Upload New Version</label>
            <input
              type="file"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setFile(event.target.files?.[0] ?? null);
                setUploadStatus(null);
                setUploadProgress(0);
              }}
              className="w-full text-sm"
              disabled={isUploading}
            />
            {uploadStatus ? <p className="text-xs text-slate-500">{uploadStatus}</p> : null}
            {isUploading ? (
              <div className="text-xs text-slate-500">{uploadProgress}%</div>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!file || isUploading}>
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
          <div className="mt-3 space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-500">No comments yet.</p>
            ) : (
              <ul className="space-y-3 text-xs">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{comment.author_name}</span>
                      <time className="text-[11px] text-slate-400">{new Date(comment.created_at).toLocaleString()}</time>
                    </div>
                    <p className="mt-2 text-slate-600">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleCommentSubmit} className="space-y-2">
              <TextAreaField
                label="Add Comment"
                name="comment"
                rows={3}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" isLoading={isPostingComment}>
                  {isPostingComment ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default DocumentDetailsModal;
