import { ChangeEvent, FormEvent, useState } from "react";
import useSWR from "swr";
import { api } from "../../lib/api";

interface Document {
  id: string;
  filename: string;
  uploaded_at: string;
  client_visible: boolean;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const PortalPage = () => {
  const { data, mutate } = useSWR<{ results: Document[] }>("/documents/", fetcher);
  const [fileMeta, setFileMeta] = useState<{ matter: string; file: File | null }>({ matter: "", file: null });
  const [status, setStatus] = useState<string | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFileMeta((prev) => ({ ...prev, file }));
  };

  const submitDoc = async (event: FormEvent) => {
    event.preventDefault();
    if (!fileMeta.file) return;
    const buffer = await fileMeta.file.arrayBuffer();
    const sha = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(sha));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const init = await api.post<{ document: Document; upload_url: { url: string; headers: Record<string, string> } }>(
      "/documents/",
      {
        matter: fileMeta.matter,
        filename: fileMeta.file.name,
        mime: fileMeta.file.type,
        size: fileMeta.file.size,
        sha256: hashHex,
      }
    );
    await fetch(init.upload_url.url, {
      method: "PUT",
      headers: init.upload_url.headers,
      body: fileMeta.file,
    });
    setStatus("Upload complete");
    setFileMeta({ matter: "", file: null });
    mutate();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Document Upload</h2>
        <form onSubmit={submitDoc} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block text-slate-600">Matter ID</label>
            <input
              value={fileMeta.matter}
              onChange={(e) => setFileMeta((prev) => ({ ...prev, matter: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              required
            />
          </div>
          <div>
            <label className="block text-slate-600">File</label>
            <input type="file" onChange={onFileChange} className="mt-1 w-full text-sm" required />
          </div>
          <button className="rounded bg-primary-600 px-3 py-2 text-white">Generate Upload URL</button>
          {status && <p className="text-emerald-600">{status}</p>}
        </form>
      </section>
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Recent Documents</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {data?.results?.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between rounded border border-slate-200 p-3">
              <span>{doc.filename}</span>
              <span className="text-xs text-slate-500">{new Date(doc.uploaded_at).toLocaleString()}</span>
            </li>
          )) ?? <li className="text-slate-500">No documents yet.</li>}
        </ul>
      </section>
    </div>
  );
};

export default PortalPage;
