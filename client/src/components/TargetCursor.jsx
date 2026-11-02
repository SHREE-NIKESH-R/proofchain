import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import "./TargetCursor.css";

const getContainingBlock = (element) => {
  let node = element?.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (
      style.transform !== "none" ||
      style.perspective !== "none" ||
      style.filter !== "none" ||
      style.willChange.includes("transform") ||
      style.willChange.includes("perspective") ||
      style.willChange.includes("filter") ||
      /paint|layout|strict|content/.test(style.contain)
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

const getContainingBlockOffset = (block) => {
  if (!block) return { x: 0, y: 0 };
  const rect = block.getBoundingClientRect();
  return { x: rect.left + block.clientLeft, y: rect.top + block.clientTop };
};

/**
 * Global desktop cursor that expands around interactive elements selected by
 * `targetSelector`. It is intentionally disabled for touch/coarse pointers.
 */
export default function TargetCursor({
  targetSelector = ".cursor-target",
  spinDuration = 2,
  hideDefaultCursor = true,
  hoverDuration = 0.2,
  parallaxOn = true,
  cursorColor = "#10632E",
  cursorColorOnTarget,
}) {
  const cursorRef = useRef(null);
  const cornersRef = useRef(null);
  const dotRef = useRef(null);
  const spinTimelineRef = useRef(null);
  const containingBlockRef = useRef(null);
  const targetCornerPositionsRef = useRef(null);
  const tickerRef = useRef(null);
  const activeStrengthRef = useRef(0);

  const supportsFinePointer = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  const constants = useMemo(() => ({ borderWidth: 3, cornerSize: 12 }), []);

  const moveCursor = useCallback((x, y) => {
    if (!cursorRef.current) return;
    const offset = getContainingBlockOffset(containingBlockRef.current);
    gsap.to(cursorRef.current, {
      x: x - offset.x,
      y: y - offset.y,
      duration: 0.1,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, []);

  useEffect(() => {
    if (!supportsFinePointer || !cursorRef.current) return undefined;

    const cursor = cursorRef.current;
    const corners = Array.from(cursor.querySelectorAll(".target-cursor-corner"));
    cornersRef.current = corners;
    containingBlockRef.current = getContainingBlock(cursor);

    const originalBodyCursor = document.body.style.cursor;
    if (hideDefaultCursor) {
      document.documentElement.classList.add("target-cursor-enabled");
      document.body.style.cursor = "none";
    }

    const getOffset = () => getContainingBlockOffset(containingBlockRef.current);
    const initialOffset = getOffset();
    gsap.set(cursor, {
      xPercent: -50,
      yPercent: -50,
      x: window.innerWidth / 2 - initialOffset.x,
      y: window.innerHeight / 2 - initialOffset.y,
    });

    const startSpin = () => {
      spinTimelineRef.current?.kill();
      spinTimelineRef.current = gsap
        .timeline({ repeat: -1 })
        .to(cursor, { rotation: "+=360", duration: spinDuration, ease: "none" });
    };
    startSpin();

    let activeTarget = null;
    let leaveHandler = null;
    let resumeTimeout = null;

    const clearTargetListener = (target) => {
      if (leaveHandler && target) target.removeEventListener("mouseleave", leaveHandler);
      leaveHandler = null;
    };

    const updateCorners = () => {
      if (!targetCornerPositionsRef.current || !cornersRef.current) return;
      const strength = activeStrengthRef.current;
      if (strength === 0) return;

      const cursorX = gsap.getProperty(cursor, "x");
      const cursorY = gsap.getProperty(cursor, "y");
      cornersRef.current.forEach((corner, index) => {
        const target = targetCornerPositionsRef.current[index];
        const nextX = gsap.getProperty(corner, "x") + (target.x - cursorX - gsap.getProperty(corner, "x")) * strength;
        const nextY = gsap.getProperty(corner, "y") + (target.y - cursorY - gsap.getProperty(corner, "y")) * strength;
        const duration = strength >= 0.99 ? (parallaxOn ? 0.2 : 0) : 0.05;
        gsap.to(corner, {
          x: nextX,
          y: nextY,
          duration,
          ease: duration === 0 ? "none" : "power1.out",
          overwrite: "auto",
        });
      });
    };
    tickerRef.current = updateCorners;

    const onMove = (event) => moveCursor(event.clientX, event.clientY);
    const onMouseDown = () => {
      if (!dotRef.current) return;
      gsap.to(dotRef.current, { scale: 0.7, duration: 0.3 });
      gsap.to(cursor, { scale: 0.9, duration: 0.2 });
    };
    const onMouseUp = () => {
      if (!dotRef.current) return;
      gsap.to(dotRef.current, { scale: 1, duration: 0.3 });
      gsap.to(cursor, { scale: 1, duration: 0.2 });
    };

    const resetCursor = (target) => {
      gsap.ticker.remove(tickerRef.current);
      targetCornerPositionsRef.current = null;
      gsap.set(activeStrengthRef, { current: 0, overwrite: true });
      activeTarget = null;

      if (cursorColorOnTarget && cornersRef.current) {
        gsap.to(cornersRef.current, { borderColor: cursorColor, duration: 0.15, ease: "power2.out" });
        if (dotRef.current) {
          gsap.to(dotRef.current, { backgroundColor: cursorColor, duration: 0.15, ease: "power2.out" });
        }
      }

      const restingPositions = [
        { x: -constants.cornerSize * 1.5, y: -constants.cornerSize * 1.5 },
        { x: constants.cornerSize * 0.5, y: -constants.cornerSize * 1.5 },
        { x: constants.cornerSize * 0.5, y: constants.cornerSize * 0.5 },
        { x: -constants.cornerSize * 1.5, y: constants.cornerSize * 0.5 },
      ];
      const timeline = gsap.timeline();
      cornersRef.current?.forEach((corner, index) => {
        timeline.to(
          corner,
          {
            x: restingPositions[index].x,
            y: restingPositions[index].y,
            duration: 0.3,
            ease: "power3.out",
          },
          0,
        );
      });

      resumeTimeout = window.setTimeout(() => {
        if (!activeTarget && spinTimelineRef.current) {
          const rotation = Number(gsap.getProperty(cursor, "rotation")) || 0;
          const normalizedRotation = ((rotation % 360) + 360) % 360;
          startSpin();
          gsap.set(cursor, { rotation: normalizedRotation });
        }
        resumeTimeout = null;
      }, 50);

      clearTargetListener(target);
    };

    const onTargetEnter = (event) => {
      const target = event.target.closest?.(targetSelector);
      if (!target || target === activeTarget || !cursorRef.current) return;

      if (activeTarget) clearTargetListener(activeTarget);
      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
        resumeTimeout = null;
      }

      activeTarget = target;
      cornersRef.current?.forEach((corner) => gsap.killTweensOf(corner, "x,y"));
      gsap.killTweensOf(cursor, "rotation");
      spinTimelineRef.current?.pause();
      gsap.set(cursor, { rotation: 0 });

      if (cursorColorOnTarget) {
        gsap.to(cornersRef.current, { borderColor: cursorColorOnTarget, duration: 0.15, ease: "power2.out" });
        if (dotRef.current) {
          gsap.to(dotRef.current, { backgroundColor: cursorColorOnTarget, duration: 0.15, ease: "power2.out" });
        }
      }

      const rect = target.getBoundingClientRect();
      const offset = getOffset();
      const cursorX = gsap.getProperty(cursor, "x");
      const cursorY = gsap.getProperty(cursor, "y");
      targetCornerPositionsRef.current = [
        { x: rect.left - constants.borderWidth - offset.x, y: rect.top - constants.borderWidth - offset.y },
        { x: rect.right + constants.borderWidth - constants.cornerSize - offset.x, y: rect.top - constants.borderWidth - offset.y },
        { x: rect.right + constants.borderWidth - constants.cornerSize - offset.x, y: rect.bottom + constants.borderWidth - constants.cornerSize - offset.y },
        { x: rect.left - constants.borderWidth - offset.x, y: rect.bottom + constants.borderWidth - constants.cornerSize - offset.y },
      ];

      gsap.ticker.add(tickerRef.current);
      gsap.to(activeStrengthRef, { current: 1, duration: hoverDuration, ease: "power2.out" });
      cornersRef.current?.forEach((corner, index) => {
        gsap.to(corner, {
          x: targetCornerPositionsRef.current[index].x - cursorX,
          y: targetCornerPositionsRef.current[index].y - cursorY,
          duration: 0.2,
          ease: "power2.out",
        });
      });

      leaveHandler = () => resetCursor(target);
      target.addEventListener("mouseleave", leaveHandler);
    };

    const onScroll = () => {
      if (!activeTarget) return;
      const offset = getOffset();
      const mouseX = Number(gsap.getProperty(cursor, "x")) + offset.x;
      const mouseY = Number(gsap.getProperty(cursor, "y")) + offset.y;
      const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
      if (!elementUnderMouse || elementUnderMouse.closest(targetSelector) !== activeTarget) {
        leaveHandler?.();
      }
    };

    const onResize = () => {
      containingBlockRef.current = getContainingBlock(cursor);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onTargetEnter, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", onResize);

    return () => {
      gsap.ticker.remove(tickerRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onTargetEnter);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onResize);
      clearTargetListener(activeTarget);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      spinTimelineRef.current?.kill();
      if (hideDefaultCursor) {
        document.documentElement.classList.remove("target-cursor-enabled");
        document.body.style.cursor = originalBodyCursor;
      }
      targetCornerPositionsRef.current = null;
      activeStrengthRef.current = 0;
    };
  }, [
    constants,
    cursorColor,
    cursorColorOnTarget,
    hideDefaultCursor,
    hoverDuration,
    moveCursor,
    parallaxOn,
    spinDuration,
    supportsFinePointer,
    targetSelector,
  ]);

  if (!supportsFinePointer || typeof document === "undefined") return null;

  return createPortal(
    <div ref={cursorRef} className="target-cursor-wrapper" aria-hidden="true">
      <div ref={dotRef} className="target-cursor-dot" style={{ backgroundColor: cursorColor }} />
      <div className="target-cursor-corner corner-tl" style={{ borderColor: cursorColor }} />
      <div className="target-cursor-corner corner-tr" style={{ borderColor: cursorColor }} />
      <div className="target-cursor-corner corner-br" style={{ borderColor: cursorColor }} />
      <div className="target-cursor-corner corner-bl" style={{ borderColor: cursorColor }} />
    </div>,
    document.body,
  );
}
