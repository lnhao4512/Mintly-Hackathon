"use client";

import { useEffect, useState } from "react";

type Time = { hrs: number; min: number; sec: number };

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function Countdown({
  initial,
}: {
  initial: { hrs: string; min: string; sec: string };
}) {
  const [time, setTime] = useState<Time>({
    hrs: Number(initial.hrs),
    min: Number(initial.min),
    sec: Number(initial.sec),
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTime((t) => {
        let total = t.hrs * 3600 + t.min * 60 + t.sec - 1;
        if (total < 0) total = 0;
        return {
          hrs: Math.floor(total / 3600),
          min: Math.floor((total % 3600) / 60),
          sec: total % 60,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { value: pad(time.hrs), label: "Hrs" },
    { value: pad(time.min), label: "Min" },
    { value: pad(time.sec), label: "Sec" },
  ];

  return (
    <div className="flex items-start gap-4">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <span className="font-display text-[32px] leading-10 text-text tabular-nums">
              {u.value}
            </span>
            <span className="eyebrow">{u.label}</span>
          </div>
          {i < units.length - 1 && (
            <span className="font-display text-[32px] leading-10 text-line">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
