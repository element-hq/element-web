/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEventHandler } from "react";
import {
    BaseViewModel,
    type MessageTimestampViewSnapshot as MessageTimestampViewSnapshotInterface,
    type MessageTimestampViewModel as MessageTimestampViewModelInterface,
} from "@element-hq/web-shared-components";

import { formatFullDate, formatTime, formatFullTime, formatRelativeTime } from "../../../../../DateUtils";
import { objectHasDiff } from "../../../../../utils/objects";

/** Inputs used to derive a timestamp view snapshot and attach timestamp actions. */
export interface MessageTimestampViewModelProps {
    /** Message timestamp in milliseconds since the Unix epoch. */
    ts: number;
    /** If specified, renders both the sent-at and received-at timestamps in the tooltip. */
    receivedTs?: number;
    /** If set, use a 12-hour clock for formatted times. */
    showTwelveHour?: boolean;
    /** If set, include the full date in the displayed timestamp. */
    showFullDate?: boolean;
    /** If set, include seconds in the displayed timestamp. */
    showSeconds?: boolean;
    /** If set, display a relative timestamp (e.g. "5 minutes ago"). */
    showRelative?: boolean;
    /** If set to true, no tooltip will be shown. */
    inhibitTooltip?: boolean;
    /** If specified, renders as an anchor bearing the href; otherwise a `span` is used. */
    href?: string;
    /** Optional onClick handler to attach to the DOM element. */
    onClick?: MouseEventHandler<HTMLElement>;
    /** Optional onContextMenu handler to attach to the DOM element. */
    onContextMenu?: MouseEventHandler<HTMLElement>;
}

/** ViewModel for the message timestamp, providing the current state of the component. */
export class MessageTimestampViewModel
    extends BaseViewModel<MessageTimestampViewSnapshotInterface, MessageTimestampViewModelProps>
    implements MessageTimestampViewModelInterface
{
    /** Click handler exposed to the timestamp view. */
    public onClick?: MouseEventHandler<HTMLElement>;
    /** Context-menu handler exposed to the timestamp view. */
    public onContextMenu?: MouseEventHandler<HTMLElement>;

    private static readonly computeSnapshot = (
        props: MessageTimestampViewModelProps,
    ): MessageTimestampViewSnapshotInterface => {
        const date = new Date(props.ts);
        const sentAt = formatFullDate(date, props.showTwelveHour);

        let timestamp: string;
        if (props.showRelative) {
            timestamp = formatRelativeTime(date, props.showTwelveHour);
        } else if (props.showFullDate) {
            timestamp = formatFullDate(date, props.showTwelveHour, props.showSeconds);
        } else if (props.showSeconds) {
            timestamp = formatFullTime(date, props.showTwelveHour);
        } else {
            timestamp = formatTime(date, props.showTwelveHour);
        }

        let receivedAt: string | undefined;
        if (props.receivedTs !== undefined) {
            const receivedDate = new Date(props.receivedTs);
            receivedAt = formatFullDate(receivedDate, props.showTwelveHour);
        }

        return {
            ts: timestamp,
            tsSentAt: sentAt,
            tsReceivedAt: receivedAt,
            inhibitTooltip: props.inhibitTooltip,
            href: props.href,
        };
    };

    /** Updates timestamp inputs and recomputes the displayed timestamp when they change. */
    public setProps(newProps: Partial<MessageTimestampViewModelProps>): void {
        const nextProps = { ...this.props, ...newProps };
        if (!objectHasDiff(this.props, nextProps)) return;

        this.props = nextProps;
        this.onClick = this.props.onClick;
        this.onContextMenu = this.props.onContextMenu;
        this.snapshot.merge(MessageTimestampViewModel.computeSnapshot(this.props));
    }

    /** Creates a timestamp view model with initial props and snapshot. */
    public constructor(props: MessageTimestampViewModelProps) {
        super(props, MessageTimestampViewModel.computeSnapshot(props));
        this.onClick = props.onClick;
        this.onContextMenu = props.onContextMenu;
    }
}
