import useSWR from "swr";
import { api } from "../../lib/api";

interface Organization {
  id: string;
  name: string;
  region: string;
}

interface Settings {
  organization_id: string | null;
  features: Record<string, boolean>;
  ca_region: string;
  storage_bucket: string;
}

const fetcher = <T,>(url: string) => api.get<T>(url);

const OrgSettingsPage = () => {
  const { data: settings } = useSWR<Settings>("/settings/", fetcher);
  const organizationId = settings ? settings.organization_id : null;
  const {
    data: org,
    error: orgError,
    isLoading: isOrgLoading,
  } = useSWR<Organization>(organizationId ? `/org/${organizationId}/` : null, fetcher);

  return (
    <div className="space-y-6">
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Organization Profile</h2>
        {!settings ? (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        ) : !organizationId ? (
          <p className="mt-4 text-sm text-red-600">Organization information is not available.</p>
        ) : isOrgLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        ) : org ? (
          <dl className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">Name</dt>
              <dd>{org.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Region</dt>
              <dd>{org.region}</dd>
            </div>
          </dl>
        ) : orgError ? (
          <p className="mt-4 text-sm text-red-600">Unable to load organization details.</p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Loading...</p>
        )}
      </section>
      <section className="rounded bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-700">Security Features</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {settings ? (
            Object.entries(settings.features).map(([name, enabled]) => (
              <li key={name} className="flex items-center justify-between">
                <span className="capitalize">{name.replace(/_/g, " ")}</span>
                <span className={`text-xs ${enabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {enabled ? "enabled" : "disabled"}
                </span>
              </li>
            ))
          ) : (
            <li>Loading...</li>
          )}
        </ul>
      </section>
      {settings && (
        <section className="rounded bg-white p-6 shadow text-sm text-slate-600">
          <h2 className="text-lg font-semibold text-slate-700">Data Residency</h2>
          <p className="mt-2">Storage bucket: {settings.storage_bucket}</p>
          <p>Canadian region: {settings.ca_region}</p>
        </section>
      )}
    </div>
  );
};

export default OrgSettingsPage;
