/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type WidgetPipViewSnapshot,
    type WidgetPipViewModel as WidgetPipViewModelInterface,
} from "@element-hq/web-shared-components";
import { type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { type FC } from "react";
import React from "react";

import { Action } from "../../dispatcher/actions";
import WidgetStore, { type IApp } from "../../stores/WidgetStore";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { type Call } from "../../models/Call";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { Container, WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import PersistentApp from "../../components/views/elements/PersistentApp";

export interface Props {
    widgetId: string;
    room: Room;
}

export class WidgetPipViewModel
    extends BaseViewModel<WidgetPipViewSnapshot, Props>
    implements WidgetPipViewModelInterface
{
    private readonly widgetId: string;
    private readonly room: Room;
    private readonly widget: IApp;

    private call: Call | null;
    private viewingRoom?: boolean;

    public constructor(props: Props) {
        super(props, { widgetId: props.widgetId, roomName: props.room.name, roomId: props.room.roomId });
        this.widgetId = props.widgetId;
        this.room = props.room;
        this.widget = WidgetStore.instance.getApps(this.room.roomId).find((app) => app.id === this.widgetId)!;
        this.call = CallStore.instance.getCall(props.room.roomId) ?? null;

        this.disposables.trackListener(this.room, RoomEvent.Name, this.onRoomName);
        this.disposables.trackListener(CallStore.instance, CallStoreEvent.Call, this.onCallChange);
    }

    public setViewingRoom(viewing: boolean): void {
        this.viewingRoom = viewing;
    }

    public onBackClick(ev: React.MouseEvent<Element, MouseEvent>): void {
        ev.preventDefault();
        ev.stopPropagation();

        if (this.call !== null) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.room.roomId,
                view_call: true,
                metricsTrigger: "WebFloatingCallWindow",
            });
        } else if (this.viewingRoom) {
            WidgetLayoutStore.instance.moveToContainer(this.room, this.widget, Container.Center);
        } else {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.room.roomId,
                metricsTrigger: "WebFloatingCallWindow",
            });
        }
    }

    /**
     * The component to render as the persistent app by the WidgetPipView.
     * @param props a copy of the PersistentApp component's props
     * @returns
     */
    public persistentAppComponent: FC<React.ComponentProps<typeof PersistentApp>> = (props) => {
        return (
            <PersistentApp
                persistentWidgetId={props.persistentWidgetId}
                persistentRoomId={props.persistentRoomId}
                pointerEvents={props.pointerEvents}
                movePersistedElement={props.movePersistedElement}
            />
        );
    };

    private readonly onRoomName = (): void => {
        this.snapshot.merge({ roomName: this.room.name });
    };

    private readonly onCallChange = (...args: unknown[]): void => {
        const [call, forRoomId] = args as [Call | null, string];
        if (forRoomId === this.room.roomId) {
            this.call = call?.widget.id === this.widgetId ? call : null;
        }
    };
}
