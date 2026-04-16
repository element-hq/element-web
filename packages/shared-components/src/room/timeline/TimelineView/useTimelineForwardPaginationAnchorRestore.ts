/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useRef } from "react";

import { getForwardPaginationAnchorAdjustment } from "./TimelineViewBehavior";
import { findTimelineItemElement, getBottomOffset } from "./TimelineViewDom";
import type { ForwardPaginationContext } from "./useTimelineForwardPagination";

const LIVE_EDGE_CLAMP_EPSILON_PX = 4;
const MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES = 8;
const REQUIRED_STABLE_FORWARD_PAGINATION_ANCHOR_FRAMES = 2;
const MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX = 96;

interface UseTimelineForwardPaginationAnchorRestoreParams {
    getForwardPaginationContext: () => ForwardPaginationContext | null;
    setForwardPaginationContext: (context: ForwardPaginationContext | null) => void;
}

/**
 * Restores bottom-offset continuity for forward pagination requests that were
 * captured in anchor mode.
 *
 * The correction loop is intentionally conservative near exact bottom so live-edge
 * requests do not overcorrect and bounce away from the clamp point.
 */
export function useTimelineForwardPaginationAnchorRestore({
    getForwardPaginationContext,
    setForwardPaginationContext,
}: UseTimelineForwardPaginationAnchorRestoreParams): {
    scheduleForwardPaginationAnchorCorrection: (
        targetScrollerElement: HTMLElement,
        windowShift: number,
        forwardPaginationAnchorIndex: number | null,
    ) => void;
    isForwardPaginationAnchorCorrectionInProgress: () => boolean;
} {
    const forwardPaginationAnchorCorrectionFrameIdsRef = useRef<number[]>([]);
    const forwardPaginationAnchorCorrectionInProgressRef = useRef(false);

    const cancelPendingForwardPaginationAnchorCorrection = useCallback(() => {
        for (const frameId of forwardPaginationAnchorCorrectionFrameIdsRef.current) {
            window.cancelAnimationFrame(frameId);
        }
        forwardPaginationAnchorCorrectionFrameIdsRef.current = [];
        forwardPaginationAnchorCorrectionInProgressRef.current = false;
    }, []);

    const scheduleForwardPaginationAnchorCorrection = useCallback(
        (targetScrollerElement: HTMLElement, _windowShift: number, _forwardPaginationAnchorIndex: number | null) => {
            const anchorKey = getForwardPaginationContext()?.anchorKey;
            const desiredBottomOffset = getForwardPaginationContext()?.bottomOffsetPx;
            if (!anchorKey || desiredBottomOffset === null) {
                return;
            }

            cancelPendingForwardPaginationAnchorCorrection();
            forwardPaginationAnchorCorrectionInProgressRef.current = true;

            const scheduleFrame = (attempt: number, stableFrameCount: number): void => {
                const frameId = window.requestAnimationFrame(() => {
                    forwardPaginationAnchorCorrectionFrameIdsRef.current =
                        forwardPaginationAnchorCorrectionFrameIdsRef.current.filter(
                            (candidateId) => candidateId !== frameId,
                        );

                    if (!targetScrollerElement.isConnected) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        setForwardPaginationContext(null);
                        return;
                    }

                    const currentContext = getForwardPaginationContext();
                    const currentAnchorKey = currentContext?.anchorKey;
                    const currentDesiredBottomOffset = currentContext?.bottomOffsetPx;
                    const currentRequestedAtLiveEdge = currentContext?.requestedAtLiveEdge ?? false;
                    const currentRequestedWhileSeekingLiveEdge = currentContext?.requestedWhileSeekingLiveEdge ?? false;
                    if (!currentAnchorKey || currentDesiredBottomOffset == null) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        setForwardPaginationContext(null);
                        return;
                    }

                    const anchorElement = findTimelineItemElement(targetScrollerElement, currentAnchorKey);
                    if (!anchorElement) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        setForwardPaginationContext(null);
                        return;
                    }

                    const currentBottomOffset = getBottomOffset(targetScrollerElement, anchorElement);
                    const rawScrollAdjustment = getForwardPaginationAnchorAdjustment({
                        desiredBottomOffset: currentDesiredBottomOffset,
                        currentBottomOffset,
                    });
                    const exactBottomScrollTop = Math.max(
                        0,
                        targetScrollerElement.scrollHeight - targetScrollerElement.clientHeight,
                    );
                    const remainingToExactBottom = exactBottomScrollTop - targetScrollerElement.scrollTop;
                    const isNearExactBottom =
                        remainingToExactBottom >= 0 && remainingToExactBottom <= LIVE_EDGE_CLAMP_EPSILON_PX;
                    const shouldDeferInitialCorrection = attempt === 1;
                    const shouldProtectNearBottomState =
                        currentRequestedAtLiveEdge || currentRequestedWhileSeekingLiveEdge;
                    const shouldAbortNearBottomCorrection =
                        shouldProtectNearBottomState &&
                        isNearExactBottom &&
                        Math.abs(rawScrollAdjustment) > MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX;
                    const scrollAdjustment =
                        shouldDeferInitialCorrection || shouldAbortNearBottomCorrection
                            ? 0
                            : Math.max(
                                  -MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX,
                                  Math.min(MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_STEP_PX, rawScrollAdjustment),
                              );
                    const nextStableFrameCount =
                        Math.abs(rawScrollAdjustment) <= 1 ||
                        shouldDeferInitialCorrection ||
                        shouldAbortNearBottomCorrection
                            ? stableFrameCount + 1
                            : 0;

                    if (scrollAdjustment !== 0) {
                        targetScrollerElement.scrollTo({
                            top: targetScrollerElement.scrollTop + scrollAdjustment,
                        });
                    }

                    if (
                        attempt >= MAX_FORWARD_PAGINATION_ANCHOR_CORRECTION_FRAMES ||
                        nextStableFrameCount >= REQUIRED_STABLE_FORWARD_PAGINATION_ANCHOR_FRAMES
                    ) {
                        forwardPaginationAnchorCorrectionInProgressRef.current = false;
                        setForwardPaginationContext(null);
                        return;
                    }

                    scheduleFrame(attempt + 1, nextStableFrameCount);
                });

                forwardPaginationAnchorCorrectionFrameIdsRef.current.push(frameId);
            };

            scheduleFrame(1, 0);
        },
        [cancelPendingForwardPaginationAnchorCorrection, getForwardPaginationContext, setForwardPaginationContext],
    );

    const isForwardPaginationAnchorCorrectionInProgress = useCallback(() => {
        return forwardPaginationAnchorCorrectionInProgressRef.current;
    }, []);

    useEffect(() => {
        return () => {
            cancelPendingForwardPaginationAnchorCorrection();
        };
    }, [cancelPendingForwardPaginationAnchorCorrection]);

    return {
        scheduleForwardPaginationAnchorCorrection,
        isForwardPaginationAnchorCorrectionInProgress,
    };
}
