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

// 推薦色票，可直接複製到Sheet使用
// #2196f3 (藍), #4caf50 (綠), #ffeb3b (黃), #ff9800 (橘), #f44336 (紅)
// #9c27b0 (紫), #00bcd4 (青), #607d8b (灰), #263238 (深灰)
const personColors: Record<string, string> = {
  "RD": "#4caf50",
  "UI": "#2196f3",
  "PM": "#ff9800",
  "": "#607d8b",
};
function getColor(e: EventRow) {
  if (e.Color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(e.Color)) return e.Color;
  if (e.Color && personColors[e.Color]) return personColors[e.Color];
  return personColors[e.Person] || "#607d8b";
}

function getDefaultDate(v?: string, plusDays?: number) {
  if (v && !isNaN(Date.parse(v))) return v;
  const d = new Date();
  if (plusDays) d.setDate(d.getDate() + plusDays);
  return d.toISOString().slice(0, 10);
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

  const personList = Array.from(new Set(events.map((e) => e.Person))).filter(Boolean);
  const statusList = Array.from(new Set(events.map((e) => e.Status))).filter(Boolean);

  // Milestone優先排序
  const milestonePeople = Array.from(new Set(filtered.filter(e => e.Type === "Milestone").map(e => e.Person)));
  const normalPeople = personList.filter(p => !milestonePeople.includes(p));
  const sortedPeople = [...milestonePeople, ...normalPeople];
  const resources = sortedPeople.map((p) => ({ id: p, title: p }));

  // 甘特圖事件資料
  const calendarEvents = filtered.map((e, idx) => {
    // 無日期的任務預設今天~明天
    const start = getDefaultDate(e.Start, 0);
    const end = getDefaultDate(e.End, 1);
    return {
      id: `${idx}`,
      resourceId: e.Person,
      title: e.Task,
      start,
      end,
      backgroundColor: getColor(e),
      classNames: [e.Status.replace(/\s/g, "")],
      extendedProps: { ...e }
    };
  });

  // 里程碑
  const milestoneEvents = filtered
    .filter((e) => e.Type === "Milestone")
    .map((e, idx) => ({
      id: `m-${idx}`,
      start: getDefaultDate(e.Start, 0),
      resourceId: e.Person,
      display: "background",
      backgroundColor: "#d32f2f",
      borderColor: "#d32f2f"
    }));

  // 覆蓋可視範圍：自動涵蓋所有日期
  const allDates = [
    ...filtered.map(e => new Date(getDefaultDate(e.Start, 0))),
    ...filtered.map(e => new Date(getDefaultDate(e.End, 1))),
    today,
  ].filter(d => !isNaN(d.getTime()));
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 7);

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
        <div className="mb-4">
          <div className="font-bold mb-2">推薦色票（複製貼入 Color 欄）：</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {["#2196f3","#4caf50","#ffeb3b","#ff9800","#f44336","#9c27b0","#00bcd4","#607d8b","#263238"].map(c=>
              <div key={c} style={{background:c, width:22,height:22,borderRadius:3,border:'1px solid #aaa'}} title={c}></div>
            )}
          </div>
          <div className="text-xs mt-1">如：#2196f3、#4caf50…</div>
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
            start: minDate.toISOString().slice(0, 10),
            end: maxDate.toISOString().slice(0, 10)
          }}
          resourceAreaWidth="15%"
          eventContent={arg => {
            const { extendedProps } = arg.event;
            const url = extendedProps.URL || extendedProps.Note;
            const isLink = !!url && url.startsWith('http');
            return (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  cursor: isLink ? "pointer" : "default",
                  textDecoration: isLink ? "underline dotted #2196f3" : "none",
                  color: isLink ? "#1976d2" : undefined,
                  fontWeight: isLink ? 600 : 400,
                  display: "flex", alignItems: "center"
                }}
                title={isLink ? "點擊可前往外部連結" : ""}
              >
                {arg.event.title}
                {isLink && (
                  <span style={{
                    fontSize: 14, marginLeft: 4,
                    color: "#2196f3"
                  }}>🔗</span>
                )}
              </div>
            );
          }}
          eventClick={info => {
            const url = info.event.extendedProps.URL || info.event.extendedProps.Note;
            if (url && url.startsWith('http')) {
              window.open(url, '_blank');
            }
          }}
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
