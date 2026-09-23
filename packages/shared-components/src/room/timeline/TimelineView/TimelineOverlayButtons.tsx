/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import { ChevronUpIcon, ChevronDownIcon, CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useI18n } from "../../../core/i18n/i18nContext";
import type { ImmediateScroll, TimelineViewActions, TimelineViewSnapshot } from "./types";
import styles from "./TimelineOverlayButtons.module.css";

interface TimelineOverlayButtonsProps {
    snapshot: TimelineViewSnapshot;
    vm: TimelineViewActions;
    /** Imperative scroll-to-anchor handle from the parent View; the VM invokes it
     * when the target is already loaded, else falls back to a pendingAnchor load. */
    scrollNow: ImmediateScroll;
}

/**
 * Absolutely-positioned overlay on top of the timeline list:
 * - **Unread bar** — shown when `canJumpToReadMarker` is `"above"`/`"below"`; a
 *   scroll-to-marker + mark-as-read pair at the top-right.
 * - **Jump-to-bottom** (bottom-right) — shown when not at the live bottom, with an
 *   optional unread badge and highlight colouring.
 */
export function TimelineOverlayButtons({ snapshot, vm, scrollNow }: TimelineOverlayButtonsProps): JSX.Element {
    const { translate: _t } = useI18n();

    const readMarkerDirection = snapshot.canJumpToReadMarker;
    const showJumpToBottom = !snapshot.atLiveEnd || !snapshot.isAtBottom;

    const onJumpToReadMarkerClick = useCallback(() => vm.onJumpToReadMarker(scrollNow), [vm, scrollNow]);
    const onJumpToLiveClick = useCallback(() => vm.onJumpToLive(scrollNow), [vm, scrollNow]);

    return (
        // Non-interactive layer (pointer-events:none) so clicks fall through to the list;
        // only the buttons re-enable them. Must NOT be aria-hidden — these are AT-reachable.
        <div className={styles.overlay}>
            {/* Top unread bar — marker is above the viewport */}
            {readMarkerDirection === "above" && (
                <div className={styles.topUnreadBar}>
                    <Tooltip description={_t("room|jump_read_marker")} placement="left">
                        <button
                            className={styles.topUnreadBarScrollUp}
                            aria-label={_t("room|jump_read_marker")}
                            onClick={onJumpToReadMarkerClick}
                            type="button"
                        >
                            <ChevronUpIcon />
                        </button>
                    </Tooltip>
                    <Tooltip description={_t("notifications|mark_all_read")} placement="left">
                        <button
                            className={styles.topUnreadBarMarkAsRead}
                            aria-label={_t("notifications|mark_all_read")}
                            onClick={() => vm.onMarkAllAsRead()}
                            type="button"
                        >
                            <CloseIcon />
                        </button>
                    </Tooltip>
                </div>
            )}

            {/* Unread bar — marker is below the viewport; sits at top-right like the above bar */}
            {readMarkerDirection === "below" && (
                <div className={styles.belowUnreadBar}>
                    <Tooltip description={_t("room|jump_read_marker")} placement="left">
                        <button
                            className={styles.belowUnreadBarScrollDown}
                            aria-label={_t("room|jump_read_marker")}
                            onClick={onJumpToReadMarkerClick}
                            type="button"
                        >
                            <ChevronDownIcon />
                        </button>
                    </Tooltip>
                    <Tooltip description={_t("notifications|mark_all_read")} placement="left">
                        <button
                            className={styles.belowUnreadBarMarkAsRead}
                            aria-label={_t("notifications|mark_all_read")}
                            onClick={() => vm.onMarkAllAsRead()}
                            type="button"
                        >
                            <CloseIcon />
                        </button>
                    </Tooltip>
                </div>
            )}

            {/* Jump-to-bottom button — matches legacy JumpToBottomButton */}
            {showJumpToBottom && (
                <div className={classNames(styles.jumpToBottom, { [styles.highlight]: snapshot.hasHighlights })}>
                    <Tooltip description={_t("room|jump_to_bottom_button")} placement="left">
                        <button
                            className={styles.jumpToBottomScrollDown}
                            aria-label={_t("room|jump_to_bottom_button")}
                            onClick={onJumpToLiveClick}
                            type="button"
                        >
                            <ChevronDownIcon />
                        </button>
                    </Tooltip>
                    {snapshot.numUnreadMessages > 0 && (
                        <div className={styles.jumpToBottomBadge}>{snapshot.numUnreadMessages}</div>
                    )}
                </div>
            )}
        </div>
    );
}
