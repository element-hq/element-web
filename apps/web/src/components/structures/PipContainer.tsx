/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type RefObject, type ReactNode, useRef, useEffect } from "react";
import { CallEvent, CallState, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";
import { useCreateAutoDisposedViewModel, WidgetPipView } from "@element-hq/web-shared-components";

import LegacyCallView from "../views/voip/LegacyCallView";
import { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import PictureInPictureDragger, { type CreatePipChildren } from "./PictureInPictureDragger";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../stores/ActiveWidgetStore";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import RoomAvatar from "../views/avatars/RoomAvatar";
import { WidgetPipViewModel, type Props as WidgetPipViewModelProps } from "../../viewmodels/room/WidgetPipViewModel";
import { SDKContext } from "../../contexts/SDKContext.ts";

const SHOW_CALL_IN_STATES = [
    CallState.Connected,
    CallState.InviteSent,
    CallState.Connecting,
    CallState.CreateAnswer,
    CallState.CreateOffer,
    CallState.WaitLocalMedia,
];

interface IProps {
    movePersistedElement: RefObject<(() => void) | null>;
}

interface IState {
    viewedRoomId?: string;

    // The main call that we are displaying (ie. not including the call in the room being viewed, if any)
    primaryCall: MatrixCall | null;

    // Any other call we're displaying: only if the user is on two calls and not viewing either of the rooms
    // they belong to
    secondaryCall: MatrixCall;

    // Widget candidate to be displayed in the PiP view.
    persistentWidgetId: string | null;
    persistentRoomId: string | null;
    showWidgetInPip: boolean;
}

/**
 * PipContainer shows a small version of the LegacyCallView or a sticky widget hovering over the UI in
 * 'picture-in-picture' (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing
 * and all widgets that are active but not shown in any other possible container.
 */

class PipContainerInner extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        const roomId = this.context.roomViewStore.getRoomId();

        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(roomId);

        this.state = {
            viewedRoomId: roomId || undefined,
            primaryCall: primaryCall || null,
            secondaryCall: secondaryCalls[0],
            persistentWidgetId: ActiveWidgetStore.instance.getPersistentWidgetId(),
            persistentRoomId: ActiveWidgetStore.instance.getPersistentRoomId(),
            showWidgetInPip: false,
        };
    }

    public componentDidMount(): void {
        this.context.legacyCallHandler.addListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCalls);
        this.context.legacyCallHandler.addListener(LegacyCallHandlerEvent.CallState, this.updateCalls);
        this.context.roomViewStore.addListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        this.context.client?.on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        const room = this.context.client?.getRoom(this.state.viewedRoomId);
        if (room) {
            this.context.widgetLayoutStore.on(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Persistence, this.onWidgetPersistence);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Dock, this.onWidgetDockChanges);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Undock, this.onWidgetDockChanges);
    }

    public componentWillUnmount(): void {
        this.context.legacyCallHandler.removeListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCalls);
        this.context.legacyCallHandler.removeListener(LegacyCallHandlerEvent.CallState, this.updateCalls);
        this.context.client?.removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        this.context.roomViewStore.removeListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        const room = this.context.client?.getRoom(this.state.viewedRoomId);
        if (room) {
            this.context.widgetLayoutStore.off(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Persistence, this.onWidgetPersistence);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Dock, this.onWidgetDockChanges);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Undock, this.onWidgetDockChanges);
    }

    /**
     * Splits a list of calls into one 'primary' one and a list
     * (which should be a single element) of other calls.
     * The primary will be the one not on hold, or an arbitrary one
     * if they're all on hold)
     */
    private getPrimarySecondaryCallsForPip(roomId: string | null): [MatrixCall | null, MatrixCall[]] {
        if (!roomId) return [null, []];

        const calls = this.context.legacyCallHandler.getAllActiveCallsForPip(roomId);

        let primary: MatrixCall | null = null;
        let secondaries: MatrixCall[] = [];

        for (const call of calls) {
            if (!SHOW_CALL_IN_STATES.includes(call.state)) continue;

            if (!call.isRemoteOnHold() && primary === null) {
                primary = call;
            } else {
                secondaries.push(call);
            }
        }

        if (primary === null && secondaries.length > 0) {
            primary = secondaries[0];
            secondaries = secondaries.slice(1);
        }

        if (secondaries.length > 1) {
            // We should never be in more than two calls so this shouldn't happen
            logger.log("Found more than 1 secondary call! Other calls will not be shown.");
        }

        return [primary, secondaries];
    }

    private onMove = (): void => this.props.movePersistedElement.current?.();

    private onRoomViewStoreUpdate = (): void => {
        const newRoomId = this.context.roomViewStore.getRoomId();
        const oldRoomId = this.state.viewedRoomId;
        if (newRoomId === oldRoomId) return;
        // The WidgetLayoutStore observer always tracks the currently viewed Room,
        // so we don't end up with multiple observers and know what observer to remove on unmount
        const oldRoom = this.context.client?.getRoom(oldRoomId);
        if (oldRoom) {
            this.context.widgetLayoutStore.off(WidgetLayoutStore.emissionForRoom(oldRoom), this.updateCalls);
        }
        const newRoom = this.context.client?.getRoom(newRoomId || undefined);
        if (newRoom) {
            this.context.widgetLayoutStore.on(WidgetLayoutStore.emissionForRoom(newRoom), this.updateCalls);
        }
        if (!newRoomId) return;

        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(newRoomId);
        this.setState({
            viewedRoomId: newRoomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
        this.updateShowWidgetInPip();
    };

    private onWidgetPersistence = (): void => {
        this.updateShowWidgetInPip();
    };

    private onWidgetDockChanges = (): void => {
        this.updateShowWidgetInPip();
    };

    private updateCalls = (): void => {
        if (!this.state.viewedRoomId) return;
        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
        this.updateShowWidgetInPip();
    };

    private onCallRemoteHold = (): void => {
        if (!this.state.viewedRoomId) return;
        const [primaryCall, secondaryCalls] = this.getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onDoubleClick = (): void => {
        const callRoomId = this.state.primaryCall?.roomId;
        if (callRoomId ?? this.state.persistentRoomId) {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: callRoomId ?? this.state.persistentRoomId ?? undefined,
                metricsTrigger: "WebFloatingCallWindow",
            });
        }
    };

    public updateShowWidgetInPip(): void {
        const persistentWidgetId = ActiveWidgetStore.instance.getPersistentWidgetId();
        const persistentRoomId = ActiveWidgetStore.instance.getPersistentRoomId();

        let fromAnotherRoom = false;
        let notDocked = false;
        // Sanity check the room - the widget may have been destroyed between render cycles, and
        // thus no room is associated anymore.
        if (persistentWidgetId && persistentRoomId && this.context.client?.getRoom(persistentRoomId)) {
            notDocked = !ActiveWidgetStore.instance.isDocked(persistentWidgetId, persistentRoomId);
            fromAnotherRoom = this.state.viewedRoomId !== persistentRoomId;
        }

        // The widget should only be shown as a persistent app (in a floating
        // pip container) if it is not visible on screen: either because we are
        // viewing a different room OR because it is in none of the possible
        // containers of the room view.
        const showWidgetInPip = fromAnotherRoom || notDocked;

        this.setState({ showWidgetInPip, persistentWidgetId, persistentRoomId });
    }

    public render(): ReactNode {
        const pipMode = true;
        const pipContent: Array<CreatePipChildren> = [];

        if (this.state.primaryCall) {
            // get a ref to call inside the current scope
            const call = this.state.primaryCall;
            pipContent.push(({ onStartMoving, onResize }) => (
                <LegacyCallView
                    key="call-view"
                    onMouseDownOnHeader={onStartMoving}
                    call={call}
                    secondaryCall={this.state.secondaryCall}
                    pipMode={pipMode}
                    onResize={onResize}
                    sidebarShown={false}
                />
            ));
        }

        if (this.state.showWidgetInPip && this.state.persistentWidgetId) {
            pipContent.push(({ onStartMoving }) => (
                <WidgetPipWrappedView
                    key="widget-pip"
                    widgetId={this.state.persistentWidgetId!}
                    room={this.context.client!.getRoom(this.state.persistentRoomId ?? undefined)!}
                    viewingRoom={this.state.viewedRoomId === this.state.persistentRoomId}
                    onStartMoving={onStartMoving}
                    movePersistedElement={this.props.movePersistedElement}
                />
            ));
        }

        if (pipContent.length) {
            return (
                <PictureInPictureDragger onDoubleClick={this.onDoubleClick} onMove={this.onMove}>
                    {pipContent}
                </PictureInPictureDragger>
            );
        }

        return null;
    }
}

export const PipContainer: React.FC = () => {
    const movePersistedElement = useRef<() => void>(null);

    return <PipContainerInner movePersistedElement={movePersistedElement} />;
};

type Props = { viewingRoom: boolean } & WidgetPipViewModelProps;

/**
 * A wrapper for the WidgetPipView component.
 *
 * This exposes the new shared WidgetPipView with the same API as before and how
 * it is used in the PipContainerInner component.
 * @param props The same props the legacy WidgetPip was using.
 * @returns
 */
const WidgetPipWrappedView: React.FC<Props> = (props: Props) => {
    const vm = useCreateAutoDisposedViewModel(() => new WidgetPipViewModel(props));

    useEffect(() => {
        // Use an effect to update viewingRoom. It is not required in the view but only in the view model.
        vm.setViewingRoom(props.viewingRoom);
    }, [vm, props.viewingRoom]);

    return (
        <WidgetPipView
            vm={vm}
            // Props only used in the view and not the view model get passed directly.
            RoomAvatar={({ size }) => <RoomAvatar size={size} room={props.room} />}
        />
    );
};
