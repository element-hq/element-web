/*
 * Copyright (c) 2026 Element Creations Ltd.
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
import React from "react";

import type { RefObject, FC } from "react";
import { Action } from "../../dispatcher/actions";
import WidgetStore, { type IApp } from "../../stores/WidgetStore";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import { type Call } from "../../models/Call";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { Container, WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import PersistentApp from "../../components/views/elements/PersistentApp";

export interface Props {
    /**
     * The widgetId this widget PiP view is showing.
     */
    widgetId: string;
    /**
     * The room this widget PiP view model is associated with.
     */
    room: Room;
    /**
     * A callback which is called when a mouse event (most likely mouse down) occurs at the start of moving the PiP around.
     */
    onStartMoving: (ev: React.MouseEvent<Element, MouseEvent>) => void;
    /**
     * This callback ref will be used by the ViewModel once the view is moving.
     * Widgets might be implemented with a top-layer DOM tree path containing the widget iframe.
     * This allows moving the iframe around (PiP/in-room) without remounting it.
     * This callback allows any `PersistentApp` view/component to know when to update the iframe position of the widget.
     */
    movePersistedElement: RefObject<(() => void) | null>;
}

export class WidgetPipViewModel
    extends BaseViewModel<WidgetPipViewSnapshot, Props>
    implements WidgetPipViewModelInterface
{
    /** The widget this view model uses for the PipView */
    private readonly widget: IApp;
    /**
     * The call associated with the widget (if the widget is a call widget)
     * For non-call widgets, this will be `null`.
     */
    private call: Call | null;
    /** If the user is currently viewing the room associated with the PiP view (`this.props.room`) */
    private viewingRoom?: boolean;

    public constructor(props: Props) {
        super(props, { widgetId: props.widgetId, roomName: props.room.name, roomId: props.room.roomId });
        this.widget = WidgetStore.instance.getApps(props.room.roomId).find((app) => app.id === this.props.widgetId)!;
        this.call = CallStore.instance.getCall(props.room.roomId) ?? null;
        this.onStartMoving = props.onStartMoving;

        this.disposables.trackListener(props.room, RoomEvent.Name, this.onRoomName);
        this.disposables.trackListener(CallStore.instance, CallStoreEvent.Call, this.onCallChange);
    }

    public onStartMoving: (ev: React.MouseEvent<Element, MouseEvent>) => void;

    /**
     * The view model needs to know if the room is currently being viewed.
     * @param viewing Whether we are currently viewing the room.
     */
    public setViewingRoom(viewing: boolean): void {
        this.viewingRoom = viewing;
    }

    public onBackClick(ev: React.MouseEvent<Element, MouseEvent>): void {
        ev.preventDefault();
        ev.stopPropagation();

        if (this.call !== null) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.props.room.roomId,
                view_call: true,
                metricsTrigger: "WebFloatingCallWindow",
            });
        } else if (this.viewingRoom) {
            WidgetLayoutStore.instance.moveToContainer(this.props.room, this.widget, Container.Center);
        } else {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.props.room.roomId,
                metricsTrigger: "WebFloatingCallWindow",
            });
        }
    }

    /**
     * The component to render as the persistent app by the WidgetPipView.
     * @param props A copy of the `PersistentApp` component's props.
     * @returns
     */
    public persistentAppComponent: FC<
        Pick<React.ComponentProps<typeof PersistentApp>, "persistentWidgetId" | "persistentRoomId">
    > = (props) => {
        return (
            <PersistentApp
                persistentWidgetId={props.persistentWidgetId}
                persistentRoomId={props.persistentRoomId}
                movePersistedElement={this.props.movePersistedElement}
            />
        );
    };

    private readonly onRoomName = (): void => {
        this.snapshot.merge({ roomName: this.props.room.name });
    };

    private readonly onCallChange = (...args: unknown[]): void => {
        const [call, forRoomId] = args as [Call | null, string];
        if (forRoomId === this.props.room.roomId) {
            this.call = call?.widget.id === this.props.widgetId ? call : null;
        }
    };
}
