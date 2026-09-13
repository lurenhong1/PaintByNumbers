import { useEffect, useRef, useState } from 'react';

export default function useScrollHint(bottomTolerance = 4) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [showHint, setShowHint] = useState(false);

    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;

        let animationFrame = 0;

        const updateVisibility = () => {
            const distanceFromBottom =
                panel.scrollHeight -
                panel.clientHeight -
                panel.scrollTop;

            setShowHint(distanceFromBottom > bottomTolerance);
        };

        const scheduleUpdate = () => {
            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(updateVisibility);
        };

        const resizeObserver = new ResizeObserver(scheduleUpdate);

        const observeSizes = () => {
            resizeObserver.disconnect();
            resizeObserver.observe(panel);

            for (const child of panel.children) {
                resizeObserver.observe(child);
            }

            scheduleUpdate();
        };

        const mutationObserver = new MutationObserver(observeSizes);

        mutationObserver.observe(panel, {
            childList: true,
        });

        panel.addEventListener("scroll", scheduleUpdate, {
            passive: true,
        });

        observeSizes();

        return () => {
            cancelAnimationFrame(animationFrame);
            panel.removeEventListener("scroll", scheduleUpdate);
            mutationObserver.disconnect();
            resizeObserver.disconnect();
        };
    }, [bottomTolerance]);

    return {
        panelRef,
        showHint,
    };
}
