import { useState } from "react";
import useSWR from "swr";
import { api } from "../../lib/api";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";

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

const DeadlinesCalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate date range for API call
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const { data: deadlines, isLoading } = useSWR<CaseDeadline[]>(
    `/deadlines/calendar/?start=${startOfMonth.toISOString().split('T')[0]}&end=${endOfMonth.toISOString().split('T')[0]}`,
    fetcher
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid
  const generateCalendarDays = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getDeadlinesForDate = (date: Date) => {
    if (!deadlines) return [];
    const dateStr = date.toISOString().split('T')[0];
    return deadlines.filter(deadline => 
      deadline.due_date.split('T')[0] === dateStr
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-700">Deadlines Calendar</h2>
        <div className="flex flex-1 items-center gap-3 sm:justify-end">
          <Button variant="secondary" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = '/deadlines'}
          >
            List View
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-700">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className="rounded border border-slate-300 px-3 py-1 text-sm transition-colors hover:border-primary-500 hover:text-primary-600"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className="rounded border border-slate-300 px-3 py-1 text-sm transition-colors hover:border-primary-500 hover:text-primary-600"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
            {/* Header row */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-slate-50 p-2 text-center text-xs font-medium text-slate-600">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((date, index) => {
              const dayDeadlines = getDeadlinesForDate(date);
              const isCurrentMonthDay = isCurrentMonth(date);
              const isTodayDate = isToday(date);
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] bg-white p-2 ${
                    !isCurrentMonthDay ? 'text-slate-400 bg-slate-50' : ''
                  }`}
                >
                  <div className={`text-sm font-medium mb-2 ${
                    isTodayDate 
                      ? 'text-white bg-primary-600 rounded-full w-6 h-6 flex items-center justify-center' 
                      : isCurrentMonthDay ? 'text-slate-900' : 'text-slate-400'
                  }`}>
                    {date.getDate()}
                  </div>
                  
                  <div className="space-y-1">
                    {dayDeadlines.slice(0, 3).map(deadline => (
                      <div
                        key={deadline.id}
                        className={`text-xs p-1 rounded truncate ${getPriorityColor(deadline.priority)}`}
                        title={`${deadline.title} - ${deadline.matter_reference}`}
                      >
                        {deadline.title}
                      </div>
                    ))}
                    {dayDeadlines.length > 3 && (
                      <div className="text-xs text-slate-500">
                        +{dayDeadlines.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Priority Legend</h4>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                <span>Critical</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div>
                <span>High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                <span>Low</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeadlinesCalendarPage;