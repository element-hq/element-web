/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import classNames from "classnames";
import { Tooltip } from "@vector-im/compound-web";
import { ChevronUpIcon, ChevronDownIcon, CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useI18n } from "../../../core/i18n/i18nContext";
import type { TimelineViewActions, TimelineViewSnapshot } from "./types";
import styles from "./TimelineOverlayButtons.module.css";

interface TimelineOverlayButtonsProps {
    snapshot: TimelineViewSnapshot;
    vm: TimelineViewActions;
}

/**
 * Absolutely-positioned overlay rendered on top of the Virtuoso list.
 *
 * Contains two overlay elements:
 * - **UnreadBar**: visible when `snapshot.canJumpToReadMarker` is `"above"` or `"below"`.
 *   When `"above"` it appears at the top-right with a chevron-up and a green dot above the button.
 *   When `"below"` it appears above the jump-to-live button with a chevron-down and a green dot below.
 * - **JumpToBottomButton** (bottom-right): visible when the user is not at the
 *   live bottom (`!snapshot.atLiveEnd || !snapshot.isAtBottom`). Shows an
 *   optional unread badge and highlight colouring.
 */
export function TimelineOverlayButtons({ snapshot, vm }: TimelineOverlayButtonsProps): JSX.Element {
    const { translate: _t } = useI18n();

    const readMarkerDirection = snapshot.canJumpToReadMarker;
    const showJumpToBottom = !snapshot.atLiveEnd || !snapshot.isAtBottom;

    return (
        <div className={styles.overlay} aria-hidden>
            {/* Top unread bar — marker is above the viewport */}
            {readMarkerDirection === "above" && (
                <div className={styles.topUnreadBar}>
                    <Tooltip description={_t("room|jump_read_marker")} placement="left">
                        <button
                            className={styles.topUnreadBarScrollUp}
                            aria-label={_t("room|jump_read_marker")}
                            onClick={vm.onJumpToReadMarker}
                            type="button"
                        >
                            <ChevronUpIcon />
                        </button>
                    </Tooltip>
                    <Tooltip description={_t("notifications|mark_all_read")} placement="left">
                        <button
                            className={styles.topUnreadBarMarkAsRead}
                            aria-label={_t("notifications|mark_all_read")}
                            onClick={vm.onMarkAllAsRead}
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
                            onClick={vm.onJumpToReadMarker}
                            type="button"
                        >
                            <ChevronDownIcon />
                        </button>
                    </Tooltip>
                    <Tooltip description={_t("notifications|mark_all_read")} placement="left">
                        <button
                            className={styles.belowUnreadBarMarkAsRead}
                            aria-label={_t("notifications|mark_all_read")}
                            onClick={vm.onMarkAllAsRead}
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
                            onClick={vm.onJumpToLive}
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
