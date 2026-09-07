/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";

import { useEventPresentation } from "../../EventPresentation";
import type { EventTileViewClassNames, EventTileViewProps, EventTileViewSlots } from "./EventTileView.types";
import styles from "./EventTileView.module.css";

type EventTileSlotName = keyof EventTileViewSlots;

/**
 * Renders the common EventTile root and event-line structure.
 *
 * Rendering-mode branches own the timeline-specific slot placement. The
 * application supplies render-ready content; this component owns the shared
 * structure, slot boundaries, placement classes, and root behavior.
 */
export function EventTileView({
    root,
    line: lineState,
    slots,
    classNames: classNameOverrides,
    refs,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onClick,
    onContextMenu,
    onPermalinkClick,
    onPermalinkContextMenu,
}: Readonly<EventTileViewProps>): JSX.Element {
    const Root = root.as ?? "li";
    const { layout, density } = useEventPresentation();
    const isRenderableSlot = (content: React.ReactNode): boolean =>
        content !== null && content !== undefined && typeof content !== "boolean";

    const renderSlot = (slotName: EventTileSlotName, content: React.ReactNode = slots[slotName]): React.ReactNode => {
        if (!isRenderableSlot(content)) return null;
        // The application context menu is portalled; its wrapper would become an empty flex item.
        if (slotName === "contextMenu") return <React.Fragment key={slotName}>{content}</React.Fragment>;

        const slotConfig: Record<EventTileSlotName, { style: string; className: keyof EventTileViewClassNames }> = {
            avatar: { style: styles.slotAvatar, className: "slotAvatar" },
            sender: { style: styles.slotSender, className: "slotSender" },
            body: { style: styles.slotBody, className: "slotBody" },
            timestamp: { style: styles.slotTimestamp, className: "slotTimestamp" },
            padlock: { style: styles.slotPadlock, className: "slotPadlock" },
            replyChain: { style: styles.slotReplyChain, className: "slotReplyChain" },
            actionBar: { style: styles.slotActionBar, className: "slotActionBar" },
            footer: { style: styles.slotFooter, className: "slotFooter" },
            threadInfo: { style: styles.slotThreadInfo, className: "slotThreadInfo" },
            receipt: { style: styles.slotReceipt, className: "slotReceipt" },
            roomAvatar: { style: styles.slotAvatar, className: "slotAvatar" },
            notificationRoomLabel: { style: styles.slotNotificationRoomLabel, className: "slotNotificationRoomLabel" },
            notificationBadge: { style: styles.slotNotificationBadge, className: "slotNotificationBadge" },
            contextMenu: { style: styles.slotContextMenu, className: "slotContextMenu" },
        };

        const { style, className } = slotConfig[slotName];

        return (
            <div
                key={slotName}
                data-testid={`event-tile-slot-${slotName}`}
                className={classNames(style, classNameOverrides?.[className])}
            >
                {content}
            </div>
        );
    };

    const renderSlots = (...slotNames: EventTileSlotName[]): React.ReactNode =>
        slotNames.map((slotName) => renderSlot(slotName));

    const hasReceiptSlot = isRenderableSlot(slots.receipt);

    const lineClassName = classNames(styles.line, classNameOverrides?.line, {
        [styles.lineMedia]: lineState?.media,
        [styles.lineSticker]: lineState?.sticker,
        [styles.lineEmote]: lineState?.emote,
        [styles.lineImage]: lineState?.image,
    });

    const renderRoot = (
        children: React.ReactNode,
        rootClickHandler: React.MouseEventHandler<HTMLElement> | undefined,
        rootTabIndex?: number,
    ): JSX.Element => (
        <Root
            ref={refs?.root}
            className={classNames(styles.root, classNameOverrides?.root, {
                [styles.stateOwnEvent]: root.state.isOwnEvent,
                [styles.hasReceiptSlot]: hasReceiptSlot,
                [styles.stateInfo]: root.state?.info,
                [styles.stateBubbleContainer]: root.state?.bubbleContainer,
                [styles.stateLeftAlignedBubble]: root.state?.leftAlignedBubble,
                [styles.stateAlignedBetweenBubbles]: root.state?.alignedBetweenBubbles,
                [styles.stateNoBubble]: root.state?.noBubble,
                [styles.stateNoSender]: root.state?.noSender,
                [styles.stateEncryptionFailure]: root.state?.encryptionFailure,
                [styles.stateEmote]: root.state?.emote,
                [styles.stateHasReply]: root.state?.hasReply,
                [styles.stateHighlighted]: root.state?.highlighted,
                [styles.stateSelected]: root.state?.selected,
                [styles.stateEditing]: root.state?.editing,
                [styles.stateContinuation]: root.state?.continuation,
                [styles.stateLastInSection]: root.state?.lastInSection,
                [styles.stateContextual]: root.state?.contextual,
                [styles.stateActionBarFocused]: root.state?.actionBarFocused,
                [styles.statePreviewClamped]: root.state?.previewClamped,
                [styles.densityCompact]: density === "compact",
                [styles.layoutGroup]: layout === "group",
                [styles.layoutBubble]: layout === "bubble",
                [styles.layoutIrc]: layout === "irc",
                [styles.shapeThread]: root.shape === "Thread",
                [styles.shapeThreadsList]: root.shape === "ThreadsList",
                [styles.shapeCard]: root.shape === "Card",
                [styles.shapeSearch]: root.shape === "Search",
                [styles.shapeFile]: root.shape === "File",
                [styles.shapeNotification]: root.shape === "Notification",
            })}
            aria-live={root.ariaLive}
            aria-atomic={true}
            data-scroll-tokens={root.scrollToken}
            data-event-id={root.eventId}
            data-testid="event-tile"
            tabIndex={rootTabIndex}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={rootClickHandler}
        >
            {children}
        </Root>
    );

    // Thread view: sender details, line content, then footer.
    if (root.shape === "Thread") {
        return renderRoot(
            <>
                <div className={classNames(styles.senderDetails, classNameOverrides?.senderDetails)}>
                    {renderSlots("avatar", "sender")}
                </div>
                <div id={root.id} data-testid="event-tile-line" className={lineClassName} onContextMenu={onContextMenu}>
                    {renderSlots("contextMenu", "replyChain", "body", "actionBar", "timestamp", "receipt")}
                </div>
                {renderSlot("footer")}
            </>,
            undefined,
        );
    }

    // Notification view: metadata, room avatar, and preview content.
    if (root.shape === "Notification") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {renderSlots("sender", "notificationRoomLabel", "timestamp", "notificationBadge")}
                </div>
                {slots.roomAvatar ? renderSlot("roomAvatar") : renderSlot("avatar")}
                <div id={root.id} data-testid="event-tile-line" className={lineClassName}>
                    {renderSlots("body", "threadInfo")}
                </div>
                {renderSlot("receipt")}
            </>,
            onClick,
            -1,
        );
    }

    // ThreadsList view: metadata, avatar, preview content, and action bar.
    if (root.shape === "ThreadsList") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {renderSlots("sender", "notificationRoomLabel", "timestamp", "notificationBadge")}
                </div>
                {renderSlot("avatar")}
                <div id={root.id} data-testid="event-tile-line" className={lineClassName}>
                    {renderSlots("body", "threadInfo")}
                </div>
                {renderSlot("actionBar")}
                {renderSlot("receipt")}
            </>,
            onClick,
            -1,
        );
    }

    // File view: permalink-wrapped sender details followed by the file body.
    if (root.shape === "File") {
        return renderRoot(
            <>
                <a
                    className={classNames(styles.senderDetailsLink, classNameOverrides?.senderDetailsLink)}
                    href={root.permalink ?? "#"}
                    onClick={onPermalinkClick}
                >
                    <div
                        className={classNames(styles.senderDetails, classNameOverrides?.senderDetails)}
                        onContextMenu={onPermalinkContextMenu}
                    >
                        {renderSlots("avatar", "sender", "timestamp")}
                    </div>
                </a>
                <div id={root.id} data-testid="event-tile-line" className={lineClassName} onContextMenu={onContextMenu}>
                    {renderSlots("contextMenu", "body")}
                </div>
            </>,
            undefined,
        );
    }

    // Default shape: Card, Pinned, Room, Search

    // IRC layout: the leading metadata slots precede the line content.
    if (layout === "irc") {
        return renderRoot(
            <>
                {renderSlots("timestamp", "padlock", "avatar", "sender")}
                <div id={root.id} data-testid="event-tile-line" className={lineClassName} onContextMenu={onContextMenu}>
                    {renderSlots("contextMenu", "replyChain", "body", "actionBar", "footer", "threadInfo")}
                </div>
                {renderSlot("receipt")}
            </>,
            undefined,
            -1,
        );
    }

    // Group and bubble layouts: sender details precede the line content.
    return renderRoot(
        <>
            {renderSlots("sender", "avatar")}
            <div id={root.id} data-testid="event-tile-line" className={lineClassName} onContextMenu={onContextMenu}>
                {renderSlots("contextMenu", "timestamp", "padlock", "replyChain", "body", "actionBar")}
            </div>
            {renderSlots("footer", "threadInfo", "receipt")}
        </>,
        undefined,
        -1,
    );
}
