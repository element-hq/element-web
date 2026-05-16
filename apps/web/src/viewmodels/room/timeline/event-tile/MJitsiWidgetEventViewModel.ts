/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type JSX } from "react";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type MJitsiWidgetEventViewModel as MJitsiWidgetEventViewModelInterface,
    type MJitsiWidgetEventViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import WidgetStore, { type IApp } from "../../../../stores/WidgetStore";
import { UPDATE_EVENT } from "../../../../stores/AsyncStore";
import { WidgetLayoutStore } from "../../../../stores/widgets/WidgetLayoutStore";

export interface MJitsiWidgetEventViewModelProps {
    /**
     * Caller-provided client.
     */
    cli: MatrixClient;
    /**
     * Jitsi widget state event to derive tile state from.
     */
    mxEvent: MatrixEvent;
    /**
     * Optional timestamp element rendered in the tile footer slot.
     */
    timestamp?: JSX.Element;
    /**
     * Widget store used to resolve the widget referenced by the state event.
     */
    widgetStore?: WidgetStore;
    /**
     * Widget layout store used to resolve the current join prompt.
     */
    widgetLayoutStore?: WidgetLayoutStore;
}

type InternalProps = Required<Pick<MJitsiWidgetEventViewModelProps, "widgetStore" | "widgetLayoutStore">> &
    Omit<MJitsiWidgetEventViewModelProps, "widgetStore" | "widgetLayoutStore">;

/**
 * ViewModel for Jitsi widget events.
 */
export class MJitsiWidgetEventViewModel
    extends BaseViewModel<MJitsiWidgetEventViewSnapshot, InternalProps>
    implements MJitsiWidgetEventViewModelInterface
{
    public constructor(props: MJitsiWidgetEventViewModelProps) {
        const internalProps = {
            ...props,
            widgetStore: props.widgetStore ?? WidgetStore.instance,
            widgetLayoutStore: props.widgetLayoutStore ?? WidgetLayoutStore.instance,
        };

        super(internalProps, MJitsiWidgetEventViewModel.computeSnapshot(internalProps));
        this.trackStoreUpdates();
    }

    public setEvent(mxEvent: MatrixEvent): void {
        this.props = { ...this.props, mxEvent };
        this.updateSnapshotFromProps();
    }

    private trackStoreUpdates(): void {
        const roomId = this.props.mxEvent.getRoomId();
        const room = roomId ? this.props.cli.getRoom(roomId) : null;

        this.disposables.trackListener(this.props.widgetStore, UPDATE_EVENT, (updatedRoomId?: unknown) => {
            if (typeof updatedRoomId === "string" && updatedRoomId !== this.props.mxEvent.getRoomId()) return;
            this.updateSnapshotFromProps();
        });

        if (roomId) {
            this.disposables.trackListener(this.props.widgetStore, roomId, () => this.updateSnapshotFromProps());
        }

        if (room) {
            this.disposables.trackListener(this.props.widgetLayoutStore, WidgetLayoutStore.emissionForRoom(room), () =>
                this.updateSnapshotFromProps(),
            );
        }
    }

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(MJitsiWidgetEventViewModel.computeSnapshot(this.props));
    }

    private static computeSnapshot(props: InternalProps): MJitsiWidgetEventViewSnapshot {
        const { mxEvent, timestamp } = props;
        const roomId = mxEvent.getRoomId();
        const room = roomId ? props.cli.getRoom(roomId) : null;

        if (!room) {
            return {
                isVisible: false,
                title: "",
                subtitle: null,
                timestamp,
            };
        }

        const content = mxEvent.getContent<{ url?: string }>();
        const prevContent = mxEvent.getPrevContent() as { url?: string };
        const senderName = mxEvent.sender?.name || mxEvent.getSender() || "";
        const widget = MJitsiWidgetEventViewModel.getWidget(props);
        let subtitle: string | null = null;

        if (content.url && widget) {
            subtitle = props.widgetLayoutStore.isInContainer(room, widget, "right")
                ? _t("timeline|m.widget|jitsi_join_right_prompt")
                : _t("timeline|m.widget|jitsi_join_top_prompt");
        }

        if (!content.url) {
            return {
                isVisible: true,
                title: _t("timeline|m.widget|jitsi_ended", { senderName }),
                subtitle: null,
                timestamp,
            };
        }

        if (prevContent.url) {
            return {
                isVisible: true,
                title: _t("timeline|m.widget|jitsi_updated", { senderName }),
                subtitle,
                timestamp,
            };
        }

        return {
            isVisible: true,
            title: _t("timeline|m.widget|jitsi_started", { senderName }),
            subtitle,
            timestamp,
        };
    }

    private static getWidget(props: InternalProps): IApp | undefined {
        const roomId = props.mxEvent.getRoomId();
        const widgetId = props.mxEvent.getStateKey();

        if (!roomId || widgetId === undefined) return undefined;

        return props.widgetStore.getRoom(roomId, true).widgets.find((widget) => widget.id === widgetId);
    }
}
