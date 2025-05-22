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
  URL?: string;
}

// 狀態色票
const statusColors: Record<string, string> = {
  "已完成": "#4caf50",
  "進行中": "#2196f3",
  "待辦": "#ff9800",
  "重要會議": "#d32f2f",
  "Milestone": "#d32f2f", // 兼容英文字
};

function getStatusColor(e: EventRow) {
  // 里程碑一定紅色
  if (e.Type === "Milestone") return "#d32f2f";
  return statusColors[e.Status] || "#607d8b";
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

  // 有里程碑的角色排最前
  const milestonePeople = Array.from(
    new Set(filtered.filter(e => e.Type === "Milestone").map(e => e.Person))
  );
  const others = personList.filter(p => !milestonePeople.includes(p));
  const sortedPersons = [...milestonePeople, ...others];
  const resources = sortedPersons.map((p) => ({ id: p, title: p }));

  // FullCalendar Events
  const calendarEvents = filtered.map((e, idx) => ({
    id: `${idx}`,
    resourceId: e.Person,
    title: e.Task,
    start: e.Start,
    end: e.End,
    backgroundColor: getStatusColor(e),
    classNames: [e.Status.replace(/\s/g, "")],
    extendedProps: { ...e }
  }));

  // 里程碑 events
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

  // 計算資料範圍
  const allDates = [
    ...filtered.map(e => new Date(e.Start)),
    ...filtered.map(e => new Date(e.End)),
  ].filter(d => !isNaN(d.getTime()));
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : today;
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : today;

  // 預設 initialDate 為 today（或資料最早那天）
  const initialDate = (today >= minDate && today <= maxDate) ? today : minDate;

  // 自動置中 today（只有任務足夠多才有用）
  function handleDatesSet() {
    const scrollElem = document.querySelector('.fc-scroller-harness .fc-scroller');
    if (scrollElem) {
      setTimeout(() => {
        const days = (maxDate.getTime() - minDate.getTime()) / 86400000;
        const colWidth = 150;
        const todayOffset = (initialDate.getTime() - minDate.getTime()) / 86400000;
        let left = (todayOffset - days/2) * colWidth;
        if(left < 0) left = 0;
        scrollElem.scrollLeft = left;
      }, 100);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 p-4 bg-white border-r">
        <h1 className="text-xl font-bold mb-4 text-[#26a269]">PiggerTimeline</h1>
        {/* 狀態圖例 */}
        <div className="flex flex-col gap-2 mb-6">
          <span>
            <span className="inline-block w-4 h-4 rounded-full align-middle mr-2" style={{background:"#4caf50"}} /> 已完成
          </span>
          <span>
            <span className="inline-block w-4 h-4 rounded-full align-middle mr-2" style={{background:"#2196f3"}} /> 進行中
          </span>
          <span>
            <span className="inline-block w-4 h-4 rounded-full align-middle mr-2" style={{background:"#ff9800"}} /> 待辦
          </span>
          <span>
            <span className="inline-block w-4 h-4 rounded-full align-middle mr-2" style={{background:"#d32f2f"}} /> 重要會議/里程碑
          </span>
        </div>
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
          initialDate={initialDate}
          slotDuration={{ days: 1 }}
          slotMinWidth={150}
          height="auto"
          headerToolbar={{
            left: "",
            center: "",
            right: ""
          }}
          visibleRange={{
            start: minDate.toISOString().slice(0, 10),
            end: maxDate.toISOString().slice(0, 10)
          }}
          resourceAreaWidth="15%"
          eventClick={info => {
            // 支援 Note 或 URL 欄位
            const url = info.event.extendedProps.URL || info.event.extendedProps.Note;
            if (url && url.startsWith('http')) {
              window.open(url, '_blank');
            }
          }}
          datesSet={handleDatesSet}
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
