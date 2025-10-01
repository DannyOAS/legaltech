import { FormEvent, useState } from "react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";

interface ContractAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName?: string;
}

interface AnalysisResult {
  jurisdiction: string;
  missing_clauses: string[];
  risky_terms: string[];
}

const defaultText = "";

const ContractAnalysisModal = ({ isOpen, onClose, documentName }: ContractAnalysisModalProps) => {
  const toast = useToast();
  const [text, setText] = useState(defaultText);
  const [jurisdiction, setJurisdiction] = useState("ON");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      toast.error("Analysis requires text", "Paste a portion of the contract to analyze.");
      return;
    }
    setIsAnalyzing(true);
    setResult(null);
    try {
      const response = await api.post<AnalysisResult>("/contracts/analyze/", {
        text: text.trim(),
        jurisdiction,
      });
      setResult(response);
    } catch (error) {
      const message = error instanceof ApiError ? error.payload.detail ?? "Unable to analyze contract" : "Unable to analyze contract";
      toast.error("Analysis failed", message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isAnalyzing}>
        Close
      </Button>
      <Button type="submit" form="contract-analysis-form" isLoading={isAnalyzing}>
        Analyze
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={documentName ? `Analyze ${documentName}` : "Analyze Contract"}
      footer={footer}
      size="lg"
      loading={false}
    >
      <form id="contract-analysis-form" className="space-y-4 text-sm text-slate-600" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-slate-600">Jurisdiction</label>
          <select
            value={jurisdiction}
            onChange={(event) => setJurisdiction(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
          >
            <option value="ON">Ontario (ONSC)</option>
            <option value="BC">British Columbia</option>
            <option value="QC">Quebec</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-slate-600">Paste contract text</label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-primary-500 focus:outline-none"
            placeholder="Paste a section of the contract to scan for missing clauses and risky terms."
          />
        </div>
        {result ? (
          <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Missing Clauses</h4>
              {result.missing_clauses.length === 0 ? (
                <p className="text-xs text-emerald-600">No missing clauses detected.</p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                  {result.missing_clauses.map((clause) => (
                    <li key={clause}>{clause}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Risky Terms</h4>
              {result.risky_terms.length === 0 ? (
                <p className="text-xs text-emerald-600">No risky terms flagged.</p>
              ) : (
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                  {result.risky_terms.map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
};

export default ContractAnalysisModal;
