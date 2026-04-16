/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

type InitialFillState = "filling" | "settling" | "done";

function logTimelineLiveEdge(...parts: Array<string | number | boolean | null | undefined>): void {
    console.log("[TimelineLiveEdge]", ...parts);
}

const MAX_LIVE_EDGE_APPEND_CORRECTION_FRAMES = 8;
const REQUIRED_STABLE_LIVE_EDGE_APPEND_FRAMES = 2;
const REQUIRED_INITIAL_LIVE_EDGE_SETTLE_QUIET_PERIOD_MS = 200;
const MAX_INITIAL_LIVE_EDGE_SETTLE_DURATION_MS = 2000;

interface UseTimelineLiveEdgeParams {
    initialFillState: InitialFillState;
    scrollerElement: HTMLElement | null;
    isAtLiveEdge: boolean;
    canPaginateForward: boolean;
    hasScrollTarget: boolean;
    followOutputEnabled: boolean;
    setInitialFillState: Dispatch<SetStateAction<InitialFillState>>;
}

function getEffectiveScrollerElement(scrollerElement: HTMLElement | null): HTMLElement | null {
    return scrollerElement ?? document.querySelector<HTMLElement>("[data-virtuoso-scroller='true']");
}

/**
 * Manages live-edge specific settling and append correction.
 *
 * During startup it waits for the timeline DOM to stop resizing before marking
 * initial fill as done, and during steady state it keeps the scroller pinned to
 * exact bottom while live-edge intent is still active.
 */
export function useTimelineLiveEdge({
    initialFillState,
    scrollerElement,
    isAtLiveEdge,
    canPaginateForward,
    hasScrollTarget,
    followOutputEnabled,
    setInitialFillState,
}: UseTimelineLiveEdgeParams): {
    cancelPendingInitialLiveEdgeSettleCorrection: () => void;
    scheduleInitialLiveEdgeSettleCorrection: () => void;
    scheduleLiveEdgeAppendCorrection: (targetScrollerElement: HTMLElement) => void;
    isLiveEdgeAppendCorrectionInProgress: () => boolean;
} {
    const liveEdgeAppendCorrectionFrameIdsRef = useRef<number[]>([]);
    const liveEdgeAppendCorrectionInProgressRef = useRef(false);
    const initialLiveEdgeSettleObserverRef = useRef<ResizeObserver | null>(null);
    const initialLiveEdgeSettleQuietTimeoutRef = useRef<number | null>(null);
    const initialLiveEdgeSettleMaxTimeoutRef = useRef<number | null>(null);
    const initialLiveEdgeSettleInProgressRef = useRef(false);
    const latestLiveEdgeIntentRef = useRef({
        isAtLiveEdge,
        canPaginateForward,
        followOutputEnabled,
    });

    const cancelPendingLiveEdgeAppendCorrection = useCallback(() => {
        for (const frameId of liveEdgeAppendCorrectionFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        liveEdgeAppendCorrectionFrameIdsRef.current = [];
        liveEdgeAppendCorrectionInProgressRef.current = false;
    }, []);

    const cancelPendingInitialLiveEdgeSettleCorrection = useCallback(() => {
        if (initialLiveEdgeSettleObserverRef.current) {
            initialLiveEdgeSettleObserverRef.current.disconnect();
            initialLiveEdgeSettleObserverRef.current = null;
        }
        if (initialLiveEdgeSettleQuietTimeoutRef.current !== null) {
            window.clearTimeout(initialLiveEdgeSettleQuietTimeoutRef.current);
            initialLiveEdgeSettleQuietTimeoutRef.current = null;
        }
        if (initialLiveEdgeSettleMaxTimeoutRef.current !== null) {
            window.clearTimeout(initialLiveEdgeSettleMaxTimeoutRef.current);
            initialLiveEdgeSettleMaxTimeoutRef.current = null;
        }
        initialLiveEdgeSettleInProgressRef.current = false;
    }, []);

    const scheduleLiveEdgeAppendCorrection = useCallback(
        (targetScrollerElement: HTMLElement) => {
            cancelPendingLiveEdgeAppendCorrection();
            liveEdgeAppendCorrectionInProgressRef.current = true;
            logTimelineLiveEdge(
                "scheduleLiveEdgeAppendCorrection:start",
                "scrollTop",
                targetScrollerElement.scrollTop,
                "scrollHeight",
                targetScrollerElement.scrollHeight,
                "clientHeight",
                targetScrollerElement.clientHeight,
            );

            const scheduleFrame = (
                attempt: number,
                previousExactBottomScrollTop: number | null,
                stableFrameCount: number,
            ): void => {
                const frameId = window.requestAnimationFrame(() => {
                    liveEdgeAppendCorrectionFrameIdsRef.current = liveEdgeAppendCorrectionFrameIdsRef.current.filter(
                        (candidateId) => candidateId !== frameId,
                    );

                    if (!targetScrollerElement.isConnected) {
                        logTimelineLiveEdge("scheduleLiveEdgeAppendCorrection:disconnected", "attempt", attempt);
                        return;
                    }

                    const latestLiveEdgeIntent = latestLiveEdgeIntentRef.current;
                    if (
                        !latestLiveEdgeIntent.isAtLiveEdge ||
                        latestLiveEdgeIntent.canPaginateForward ||
                        !latestLiveEdgeIntent.followOutputEnabled
                    ) {
                        logTimelineLiveEdge(
                            "scheduleLiveEdgeAppendCorrection:abort-intent",
                            "attempt",
                            attempt,
                            "isAtLiveEdge",
                            latestLiveEdgeIntent.isAtLiveEdge,
                            "canPaginateForward",
                            latestLiveEdgeIntent.canPaginateForward,
                            "followOutputEnabled",
                            latestLiveEdgeIntent.followOutputEnabled,
                        );
                        return;
                    }

                    const exactBottomScrollTop = Math.max(
                        0,
                        targetScrollerElement.scrollHeight - targetScrollerElement.clientHeight,
                    );
                    const nextStableFrameCount =
                        targetScrollerElement.scrollTop >= exactBottomScrollTop &&
                        previousExactBottomScrollTop === exactBottomScrollTop
                            ? stableFrameCount + 1
                            : 0;

                    logTimelineLiveEdge(
                        "scheduleLiveEdgeAppendCorrection:frame",
                        "attempt",
                        attempt,
                        "scrollTop",
                        targetScrollerElement.scrollTop,
                        "exactBottomScrollTop",
                        exactBottomScrollTop,
                        "previousExactBottomScrollTop",
                        previousExactBottomScrollTop,
                        "stableFrameCount",
                        stableFrameCount,
                        "nextStableFrameCount",
                        nextStableFrameCount,
                    );

                    if (targetScrollerElement.scrollTop < exactBottomScrollTop) {
                        targetScrollerElement.scrollTo({
                            top: exactBottomScrollTop,
                        });
                    }

                    if (
                        attempt >= MAX_LIVE_EDGE_APPEND_CORRECTION_FRAMES ||
                        nextStableFrameCount >= REQUIRED_STABLE_LIVE_EDGE_APPEND_FRAMES
                    ) {
                        liveEdgeAppendCorrectionInProgressRef.current = false;
                        logTimelineLiveEdge(
                            "scheduleLiveEdgeAppendCorrection:complete",
                            "attempt",
                            attempt,
                            "nextStableFrameCount",
                            nextStableFrameCount,
                        );
                        return;
                    }

                    scheduleFrame(attempt + 1, exactBottomScrollTop, nextStableFrameCount);
                });

                liveEdgeAppendCorrectionFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(1, null, 0);
        },
        [cancelPendingLiveEdgeAppendCorrection],
    );

    const scheduleInitialLiveEdgeSettleCorrection = useCallback(() => {
        if (initialLiveEdgeSettleInProgressRef.current || !isAtLiveEdge || hasScrollTarget) {
            logTimelineLiveEdge(
                "scheduleInitialLiveEdgeSettleCorrection:skip",
                "inProgress",
                initialLiveEdgeSettleInProgressRef.current,
                "isAtLiveEdge",
                isAtLiveEdge,
                "hasScrollTarget",
                hasScrollTarget,
            );
            return;
        }

        const effectiveScrollerElement = getEffectiveScrollerElement(scrollerElement);
        if (!effectiveScrollerElement) {
            logTimelineLiveEdge("scheduleInitialLiveEdgeSettleCorrection:no-scroller");
            setInitialFillState("done");
            return;
        }

        initialLiveEdgeSettleInProgressRef.current = true;

        const settleToExactBottom = (): number => {
            const exactBottomScrollTop = Math.max(
                0,
                effectiveScrollerElement.scrollHeight - effectiveScrollerElement.clientHeight,
            );

            if (effectiveScrollerElement.scrollTop < exactBottomScrollTop) {
                effectiveScrollerElement.scrollTo({
                    top: exactBottomScrollTop,
                });
            }

            return exactBottomScrollTop;
        };

        const finishSettling = (): void => {
            if (!initialLiveEdgeSettleInProgressRef.current) {
                return;
            }

            logTimelineLiveEdge(
                "scheduleInitialLiveEdgeSettleCorrection:finish",
                "scrollTop",
                effectiveScrollerElement.scrollTop,
            );
            settleToExactBottom();
            cancelPendingInitialLiveEdgeSettleCorrection();
            setInitialFillState("done");
        };

        const restartQuietPeriod = (): void => {
            logTimelineLiveEdge(
                "scheduleInitialLiveEdgeSettleCorrection:restartQuietPeriod",
                "scrollTop",
                effectiveScrollerElement.scrollTop,
                "scrollHeight",
                effectiveScrollerElement.scrollHeight,
                "clientHeight",
                effectiveScrollerElement.clientHeight,
            );
            settleToExactBottom();
            if (initialLiveEdgeSettleQuietTimeoutRef.current !== null) {
                window.clearTimeout(initialLiveEdgeSettleQuietTimeoutRef.current);
            }
            initialLiveEdgeSettleQuietTimeoutRef.current = window.setTimeout(() => {
                finishSettling();
            }, REQUIRED_INITIAL_LIVE_EDGE_SETTLE_QUIET_PERIOD_MS);
        };

        const observer = new ResizeObserver(() => {
            restartQuietPeriod();
        });
        initialLiveEdgeSettleObserverRef.current = observer;

        observer.observe(effectiveScrollerElement);
        const viewportElement = effectiveScrollerElement.firstElementChild;
        if (viewportElement instanceof HTMLElement) {
            observer.observe(viewportElement);
            const itemListElement = viewportElement.firstElementChild;
            if (itemListElement instanceof HTMLElement) {
                observer.observe(itemListElement);
            }
        }

        restartQuietPeriod();
        initialLiveEdgeSettleMaxTimeoutRef.current = window.setTimeout(() => {
            finishSettling();
        }, MAX_INITIAL_LIVE_EDGE_SETTLE_DURATION_MS);
    }, [
        cancelPendingInitialLiveEdgeSettleCorrection,
        hasScrollTarget,
        isAtLiveEdge,
        scrollerElement,
        setInitialFillState,
    ]);

    const isLiveEdgeAppendCorrectionInProgress = useCallback(() => {
        return liveEdgeAppendCorrectionInProgressRef.current;
    }, []);

    useEffect(() => {
        latestLiveEdgeIntentRef.current = {
            isAtLiveEdge,
            canPaginateForward,
            followOutputEnabled,
        };
    }, [isAtLiveEdge, canPaginateForward, followOutputEnabled]);

    useEffect(() => {
        if (initialFillState === "filling") {
            return;
        }

        cancelPendingInitialLiveEdgeSettleCorrection();
    }, [cancelPendingInitialLiveEdgeSettleCorrection, initialFillState]);

    useEffect(() => {
        return () => {
            cancelPendingLiveEdgeAppendCorrection();
            cancelPendingInitialLiveEdgeSettleCorrection();
        };
    }, [cancelPendingInitialLiveEdgeSettleCorrection, cancelPendingLiveEdgeAppendCorrection]);

    return {
        cancelPendingInitialLiveEdgeSettleCorrection,
        scheduleInitialLiveEdgeSettleCorrection,
        scheduleLiveEdgeAppendCorrection,
        isLiveEdgeAppendCorrectionInProgress,
    };
}
