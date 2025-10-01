import { ChangeEvent, FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import useSWR from "swr";
import Button from "../../components/ui/Button";
import { api, ApiError } from "../../lib/api";

interface Matter {
  id: string;
  title: string;
  practice_area: string;
  status: string;
  reference_code: string;
  opened_at: string;
  closed_at?: string;
}

interface CaseDeadline {
  id: string;
  title: string;
  deadline_type: string;
  due_date: string;
  priority: string;
  status: string;
  matter_title: string;
  matter_reference: string;
  created_at: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const MatterDetailPage = () => {
  const { id } = useParams();
  const { data } = useSWR<Matter>(id ? `/matters/${id}/` : null, fetcher);
  const { data: existingDeadlines, mutate: mutateDeadlines } = useSWR<CaseDeadline[]>(
    id ? `/deadlines/?matter__id=${id}` : null, 
    fetcher
  );
  const [eventType, setEventType] = useState("statement_of_claim");
  const [filingDate, setFilingDate] = useState(new Date().toISOString().slice(0, 10));
  const [deadlines, setDeadlines] = useState<Array<{ name: string; due_date: string; rule_reference: string }>>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSavingDeadlines, setIsSavingDeadlines] = useState(false);

  if (!data) {
    return <div className="rounded bg-white p-6 shadow">Loading matter...</div>;
  }

  const handleCalculate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setIsCalculating(true);
      setStatus(null);
      const response = await api.post<{ 
        deadlines: Array<{ name: string; due_date: string; rule_reference: string }>; 
      }>(
        "/case-rules/calc/",
        {
          event_type: eventType,
          filing_date: filingDate,
          court: "ONSC",
        },
      );
      setDeadlines(response.deadlines);
      if (!response.deadlines.length) {
        setStatus("No deadlines calculated.");
      } else {
        setStatus(`${response.deadlines.length} deadlines calculated.`);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.payload.detail ?? "Unable to calculate deadlines" : "Unable to calculate deadlines";
      setStatus(message);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveDeadlines = async () => {
    try {
      setIsSavingDeadlines(true);
      const payload = {
        event_type: eventType,
        filing_date: filingDate,
        court: "ONSC",
        matter_id: id,
        save_deadlines: true,
      };
      console.log("DEBUG: Sending save payload:", payload);
      const response = await api.post<{ 
        deadlines: Array<{ name: string; due_date: string; rule_reference: string }>; 
        saved_deadline_ids?: string[] 
      }>(
        "/case-rules/calc/",
        payload,
      );
      console.log("DEBUG: Save response:", response);
      if (response.saved_deadline_ids && response.saved_deadline_ids.length > 0) {
        setStatus(`${response.saved_deadline_ids.length} deadlines saved to this matter.`);
        mutateDeadlines(); // Refresh existing deadlines list
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.payload.detail ?? "Unable to save deadlines" : "Unable to save deadlines";
      setStatus(message);
    } finally {
      setIsSavingDeadlines(false);
    }
  };

  const handleMarkCompleted = async (deadlineId: string) => {
    try {
      await api.post(`/deadlines/${deadlineId}/mark_completed/`);
      mutateDeadlines();
    } catch (error) {
      console.error("Failed to mark deadline as completed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-700">{data.title}</h2>
        <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Reference</dt>
            <dd>{data.reference_code}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Practice Area</dt>
            <dd>{data.practice_area}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Status</dt>
            <dd>{data.status}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Opened</dt>
            <dd>{new Date(data.opened_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded bg-white p-6 shadow">
        <h3 className="text-lg font-semibold text-slate-700">Case Deadlines (Beta)</h3>
        <p className="mt-1 text-sm text-slate-500">Quickly estimate upcoming dates based on Ontario rules.</p>
        <form className="mt-4 space-y-4" onSubmit={handleCalculate}>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-slate-600">Event</span>
              <select
                value={eventType}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setEventType(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
              >
                <option value="statement_of_claim">Statement of Claim</option>
                <option value="statement_of_defence">Statement of Defence</option>
                <option value="motion">Motion</option>
                <option value="examination_for_discovery">Examination for Discovery</option>
                <option value="trial_scheduling">Trial Scheduling</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-600">Filing Date</span>
              <input
                type="date"
                value={filingDate}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFilingDate(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" isLoading={isCalculating}>
                Calculate
              </Button>
            </div>
          </div>
        </form>
        {status ? <p className="mt-3 text-xs text-slate-500">{status}</p> : null}
        {deadlines.length > 0 ? (
          <>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {deadlines.map((deadline) => (
                <li key={`${deadline.name}-${deadline.due_date}`} className="rounded border border-slate-200 p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-700">{deadline.name}</p>
                      <p className="text-xs text-slate-500">Rule: {deadline.rule_reference}</p>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-primary-600 sm:mt-0">
                      {new Date(deadline.due_date).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                These deadlines are calculated estimates based on Ontario Rules of Civil Procedure.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveDeadlines}
                isLoading={isSavingDeadlines}
              >
                Save to Matter
              </Button>
            </div>
          </>
        ) : null}
      </section>

      {existingDeadlines && existingDeadlines.length > 0 && (
        <section className="rounded bg-white p-6 shadow">
          <h3 className="text-lg font-semibold text-slate-700">Saved Deadlines</h3>
          <p className="mt-1 text-sm text-slate-500">Deadlines saved for this matter.</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {existingDeadlines.map((deadline) => (
              <li key={deadline.id} className="rounded border border-slate-200 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">{deadline.title}</p>
                    <p className="text-xs text-slate-500">
                      {deadline.deadline_type} • Priority: {deadline.priority}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 sm:mt-0">
                    <div className="text-sm font-semibold text-primary-600">
                      {new Date(deadline.due_date).toLocaleDateString()}
                    </div>
                    {deadline.status === "pending" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkCompleted(deadline.id)}
                      >
                        Mark Complete
                      </Button>
                    )}
                    {deadline.status === "completed" && (
                      <span className="text-xs text-emerald-600 font-medium">Completed</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default MatterDetailPage;
