
import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import zhTwLocale from "@fullcalendar/core/locales/zh-tw";
import { parse } from "csv-parse/sync";

interface EventRow {
  Person: string;
  Task: string;
  Start: string;
  End: string;
  Type: string;
  Status: string;
  Progress: string;
  Color: string;
  Note: string;
}

async function fetchCSVData(url: string): Promise<EventRow[]> {
  const res = await fetch(url);
  const text = await res.text();
  const records = parse(text, { columns: true, skip_empty_lines: true });
  return records;
}

export default function Home({ events }: { events: EventRow[] }) {
  const [filtered, setFiltered] = useState(events);
  const [showMilestone, setShowMilestone] = useState(true);
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const today = new Date();

  useEffect(() => {
    setFiltered(
      events.filter(
        (e) =>
          (showMilestone || e.Type !== "Milestone") &&
          (!person || e.Person === person) &&
          (!status || e.Status === status)
      )
    );
  }, [person, status, showMilestone, events]);

  // 自動更新
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(process.env.CSV_URL as string);
      const text = await res.text();
      const records = parse(text, { columns: true, skip_empty_lines: true });
      setFiltered(
        records.filter(
          (e: EventRow) =>
            (showMilestone || e.Type !== "Milestone") &&
            (!person || e.Person === person) &&
            (!status || e.Status === status)
        )
      );
    }, 60000);
    return () => clearInterval(id);
  }, [showMilestone, person, status]);

  // 篩選器選項
  const personList = Array.from(new Set(events.map((e) => e.Person))).filter(Boolean);
  const statusList = Array.from(new Set(events.map((e) => e.Status))).filter(Boolean);

  // 轉 FullCalendar 格式
  const calendarEvents = filtered.map((e, idx) => ({
    id: `${idx}`,
    resourceId: e.Person,
    title: e.Task,
    start: e.Start,
    end: e.End,
    backgroundColor: e.Color || "#607d8b",
    classNames: [e.Status.replace(/\s/g, "")],
    extendedProps: { ...e }
  }));

  // resources
  const resources = personList.map((p) => ({ id: p, title: p }));

  // 里程碑
  const milestoneEvents = filtered
    .filter((e) => e.Type === "Milestone")
    .map((e, idx) => ({
      id: `m-${idx}`,
      start: e.Start,
      resourceId: e.Person,
      display: "background",
      backgroundColor: "#d32f2f",
      borderColor: "#d32f2f"
    }));

  // 視窗範圍
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 7);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(today.getDate() + 7);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 p-4 bg-white border-r">
        <h1 className="text-xl font-bold mb-6 text-[#26a269]">PiggerTimeline</h1>
        <div className="mb-4">
          <label>人員：</label>
          <select className="w-full border p-1" value={person} onChange={e => setPerson(e.target.value)}>
            <option value="">全部</option>
            {personList.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label>狀態：</label>
          <select className="w-full border p-1" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">全部</option>
            {statusList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="mb-4 flex items-center">
          <input
            id="milestone"
            type="checkbox"
            checked={showMilestone}
            onChange={() => setShowMilestone((v) => !v)}
          />
          <label htmlFor="milestone" className="ml-2">顯示里程碑</label>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-4">
        <FullCalendar
          plugins={[resourceTimelinePlugin]}
          locale={zhTwLocale}
          initialView="resourceTimeline"
          nowIndicator
          resources={resources}
          events={[...calendarEvents, ...milestoneEvents]}
          initialDate={today}
          slotDuration={{ days: 1 }}
          slotMinWidth={150}
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: ""
          }}
          visibleRange={{
            start: rangeStart.toISOString().slice(0, 10),
            end: rangeEnd.toISOString().slice(0, 10)
          }}
          resourceAreaWidth="15%"
        />
      </main>
      <style jsx global>{`
        .fc-now-indicator-line { background: #26a269 !important; border-style: dashed; }
        .fc-event { border-radius: 4px !important; opacity: 0.85 !important; }
      `}</style>
    </div>
  );
}

export async function getServerSideProps() {
  const url = process.env.CSV_URL as string;
  const events = await fetchCSVData(url);
  return { props: { events } };
}
