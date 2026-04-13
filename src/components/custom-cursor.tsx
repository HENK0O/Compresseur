"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);
  const visibleRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(false);

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    targetRef.current = { x: event.clientX, y: event.clientY };

    if (!visibleRef.current) {
      visibleRef.current = true;
      setVisible(true);
    }

    const element = event.target as HTMLElement | null;
    const hoverTarget = element?.closest<HTMLElement>("[data-cursor]");
    const nextActive = Boolean(hoverTarget);

    setLabel(hoverTarget?.dataset.cursor ?? "");
    activeRef.current = nextActive;
    setIsActive(nextActive);
  });

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    let frameId = 0;

    const onPointerDown = () => {
      activeRef.current = true;
      setIsActive(true);
    };
    const onPointerUp = () => {
      activeRef.current = false;
      setIsActive(false);
    };
    const onPointerLeave = () => {
      visibleRef.current = false;
      setVisible(false);
    };
    const onPointerEnter = () => {
      visibleRef.current = true;
      setVisible(true);
    };

    const render = () => {
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * 0.18;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * 0.18;

      const dot = dotRef.current;
      const ring = ringRef.current;

      if (dot) {
        dot.style.transform = `translate3d(${targetRef.current.x - 5}px, ${targetRef.current.y - 5}px, 0)`;
      }

      if (ring) {
        ring.style.transform = `translate3d(${currentRef.current.x - 28}px, ${currentRef.current.y - 28}px, 0) scale(${activeRef.current ? 1.2 : 1})`;
      }

      frameId = window.requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerenter", onPointerEnter);

    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerenter", onPointerEnter);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[60] h-[10px] w-[10px] rounded-full bg-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.85)]"
      />
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[59] flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] px-2 text-center text-[10px] uppercase tracking-[0.24em] text-cyan-50 backdrop-blur-md transition-[width,height,background-color,border-color] duration-200"
      >
        {isActive ? label : ""}
      </div>
    </>
  );
}
