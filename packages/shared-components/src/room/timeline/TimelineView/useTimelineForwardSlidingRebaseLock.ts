/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useRef } from "react";

import type { VisibleRange } from "./types";

function logTimelineForwardSlidingRebaseLock(...parts: Array<string | number | boolean | null | undefined>): void {
    void parts;
}

interface UseTimelineForwardSlidingRebaseLockParams {
    onVisibleRangeChanged: (visibleRange: VisibleRange) => void;
}

/**
 * Temporarily suppresses visible-range reactions while Virtuoso and the presenter
 * cooperate to restore a shifted visible window after forward pagination rebases
 * the rendered range.
 */
export function useTimelineForwardSlidingRebaseLock({
    onVisibleRangeChanged,
}: UseTimelineForwardSlidingRebaseLockParams): {
    cancelPendingForwardPaginationSlidingRebaseLock: () => void;
    armForwardPaginationSlidingRebaseLock: () => void;
    isForwardPaginationSlidingRebaseLockActive: () => boolean;
    isForwardPaginationSlidingRebaseVirtuosoRestoreActive: () => boolean;
    setForwardPaginationSlidingRebaseVirtuosoRestoreActive: (active: boolean) => void;
    setPendingVisibleRangeDuringForwardSlidingRebaseLock: (visibleRange: VisibleRange | null) => void;
    clearPendingVisibleRangeDuringForwardSlidingRebaseLock: () => void;
} {
    const forwardPaginationSlidingRebaseLockFrameIdsRef = useRef<number[]>([]);
    const forwardPaginationSlidingRebaseLockActiveRef = useRef(false);
    const forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef = useRef(false);
    const pendingVisibleRangeDuringForwardSlidingRebaseLockRef = useRef<VisibleRange | null>(null);

    const cancelPendingForwardPaginationSlidingRebaseLock = useCallback(() => {
        logTimelineForwardSlidingRebaseLock(
            "cancel",
            "active",
            forwardPaginationSlidingRebaseLockActiveRef.current,
            "virtuosoRestoreActive",
            forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current,
            "pendingStart",
            pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current?.startIndex ?? null,
            "pendingEnd",
            pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current?.endIndex ?? null,
        );
        for (const frameId of forwardPaginationSlidingRebaseLockFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        forwardPaginationSlidingRebaseLockFrameIdsRef.current = [];
        forwardPaginationSlidingRebaseLockActiveRef.current = false;
        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
    }, []);

    const armForwardPaginationSlidingRebaseLock = useCallback(() => {
        cancelPendingForwardPaginationSlidingRebaseLock();
        forwardPaginationSlidingRebaseLockActiveRef.current = true;
        logTimelineForwardSlidingRebaseLock("arm");

        const scheduleReleaseFrame = (remainingFrames: number): void => {
            const frameId = window.requestAnimationFrame(() => {
                forwardPaginationSlidingRebaseLockFrameIdsRef.current =
                    forwardPaginationSlidingRebaseLockFrameIdsRef.current.filter(
                        (candidateId) => candidateId !== frameId,
                    );

                if (remainingFrames <= 1) {
                    forwardPaginationSlidingRebaseLockActiveRef.current = false;
                    forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = false;
                    logTimelineForwardSlidingRebaseLock(
                        "release",
                        "pendingStart",
                        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current?.startIndex ?? null,
                        "pendingEnd",
                        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current?.endIndex ?? null,
                    );
                    const pendingVisibleRange = pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current;
                    if (pendingVisibleRange !== null) {
                        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
                        onVisibleRangeChanged(pendingVisibleRange);
                    }
                    return;
                }

                scheduleReleaseFrame(remainingFrames - 1);
            });

            forwardPaginationSlidingRebaseLockFrameIdsRef.current.push(frameId);
        };

        scheduleReleaseFrame(8);
    }, [cancelPendingForwardPaginationSlidingRebaseLock, onVisibleRangeChanged]);

    const isForwardPaginationSlidingRebaseLockActive = useCallback(() => {
        return forwardPaginationSlidingRebaseLockActiveRef.current;
    }, []);

    const isForwardPaginationSlidingRebaseVirtuosoRestoreActive = useCallback(() => {
        return forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current;
    }, []);

    const setForwardPaginationSlidingRebaseVirtuosoRestoreActive = useCallback((active: boolean) => {
        forwardPaginationSlidingRebaseVirtuosoRestoreActiveRef.current = active;
        logTimelineForwardSlidingRebaseLock("setVirtuosoRestoreActive", active);
    }, []);

    const setPendingVisibleRangeDuringForwardSlidingRebaseLock = useCallback((visibleRange: VisibleRange | null) => {
        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = visibleRange;
        logTimelineForwardSlidingRebaseLock(
            "setPendingVisibleRange",
            "start",
            visibleRange?.startIndex ?? null,
            "end",
            visibleRange?.endIndex ?? null,
        );
    }, []);

    const clearPendingVisibleRangeDuringForwardSlidingRebaseLock = useCallback(() => {
        logTimelineForwardSlidingRebaseLock("clearPendingVisibleRange");
        pendingVisibleRangeDuringForwardSlidingRebaseLockRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            cancelPendingForwardPaginationSlidingRebaseLock();
        };
    }, [cancelPendingForwardPaginationSlidingRebaseLock]);

    return {
        cancelPendingForwardPaginationSlidingRebaseLock,
        armForwardPaginationSlidingRebaseLock,
        isForwardPaginationSlidingRebaseLockActive,
        isForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        setForwardPaginationSlidingRebaseVirtuosoRestoreActive,
        setPendingVisibleRangeDuringForwardSlidingRebaseLock,
        clearPendingVisibleRangeDuringForwardSlidingRebaseLock,
    };
}
