/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type MutableRefObject, type ReactNode, useRef } from "react";
import { CallEvent, CallState, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";
import { type Optional } from "matrix-events-sdk";

import LegacyCallView from "../views/voip/LegacyCallView";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import PictureInPictureDragger, { type CreatePipChildren } from "./PictureInPictureDragger";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../stores/ActiveWidgetStore";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { SdkContextClass } from "../../contexts/SDKContext";
import { WidgetPip } from "../views/pips/WidgetPip";

const SHOW_CALL_IN_STATES = [
    CallState.Connected,
    CallState.InviteSent,
    CallState.Connecting,
    CallState.CreateAnswer,
    CallState.CreateOffer,
    CallState.WaitLocalMedia,
];

interface IProps {
    movePersistedElement: MutableRefObject<(() => void) | undefined>;
}

interface IState {
    viewedRoomId?: string;

    // The main call that we are displaying (ie. not including the call in the room being viewed, if any)
    primaryCall: MatrixCall | null;

    // Any other call we're displaying: only if the user is on two calls and not viewing either of the rooms
    // they belong to
    secondaryCall: MatrixCall;

    // widget candidate to be displayed in the pip view.
    persistentWidgetId: string | null;
    persistentRoomId: string | null;
    showWidgetInPip: boolean;
}

// Splits a list of calls into one 'primary' one and a list
// (which should be a single element) of other calls.
// The primary will be the one not on hold, or an arbitrary one
// if they're all on hold)
function getPrimarySecondaryCallsForPip(roomId: Optional<string>): [MatrixCall | null, MatrixCall[]] {
    if (!roomId) return [null, []];

    const calls = LegacyCallHandler.instance.getAllActiveCallsForPip(roomId);

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

/**
 * PipContainer shows a small version of the LegacyCallView or a sticky widget hovering over the UI in
 * 'picture-in-picture' (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing
 * and all widgets that are active but not shown in any other possible container.
 */

class PipContainerInner extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        const roomId = SdkContextClass.instance.roomViewStore.getRoomId();

        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(roomId);

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
        LegacyCallHandler.instance.addListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCalls);
        LegacyCallHandler.instance.addListener(LegacyCallHandlerEvent.CallState, this.updateCalls);
        SdkContextClass.instance.roomViewStore.addListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        MatrixClientPeg.safeGet().on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        const room = MatrixClientPeg.safeGet().getRoom(this.state.viewedRoomId);
        if (room) {
            WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Persistence, this.onWidgetPersistence);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Dock, this.onWidgetDockChanges);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Undock, this.onWidgetDockChanges);
    }

    public componentWillUnmount(): void {
        LegacyCallHandler.instance.removeListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCalls);
        LegacyCallHandler.instance.removeListener(LegacyCallHandlerEvent.CallState, this.updateCalls);
        const cli = MatrixClientPeg.get();
        cli?.removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        SdkContextClass.instance.roomViewStore.removeListener(UPDATE_EVENT, this.onRoomViewStoreUpdate);
        const room = cli?.getRoom(this.state.viewedRoomId);
        if (room) {
            WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Persistence, this.onWidgetPersistence);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Dock, this.onWidgetDockChanges);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Undock, this.onWidgetDockChanges);
    }

    private onMove = (): void => this.props.movePersistedElement.current?.();

    private onRoomViewStoreUpdate = (): void => {
        const newRoomId = SdkContextClass.instance.roomViewStore.getRoomId();
        const oldRoomId = this.state.viewedRoomId;
        if (newRoomId === oldRoomId) return;
        // The WidgetLayoutStore observer always tracks the currently viewed Room,
        // so we don't end up with multiple observers and know what observer to remove on unmount
        const oldRoom = MatrixClientPeg.get()?.getRoom(oldRoomId);
        if (oldRoom) {
            WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(oldRoom), this.updateCalls);
        }
        const newRoom = MatrixClientPeg.get()?.getRoom(newRoomId || undefined);
        if (newRoom) {
            WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(newRoom), this.updateCalls);
        }
        if (!newRoomId) return;

        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(newRoomId);
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
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
        this.updateShowWidgetInPip();
    };

    private onCallRemoteHold = (): void => {
        if (!this.state.viewedRoomId) return;
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

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
        if (persistentWidgetId && persistentRoomId && MatrixClientPeg.safeGet().getRoom(persistentRoomId)) {
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
                />
            ));
        }

        if (this.state.showWidgetInPip && this.state.persistentWidgetId) {
            pipContent.push(({ onStartMoving }) => (
                <WidgetPip
                    key="widget-pip"
                    widgetId={this.state.persistentWidgetId!}
                    room={MatrixClientPeg.safeGet().getRoom(this.state.persistentRoomId ?? undefined)!}
                    viewingRoom={this.state.viewedRoomId === this.state.persistentRoomId}
                    onStartMoving={onStartMoving}
                    movePersistedElement={this.props.movePersistedElement}
                />
            ));
        }

        if (pipContent.length) {
            return (
                <PictureInPictureDragger
                    className="mx_LegacyCallPreview"
                    draggable={pipMode}
                    onDoubleClick={this.onDoubleClick}
                    onMove={this.onMove}
                >
                    {pipContent}
                </PictureInPictureDragger>
            );
        }

        return null;
    }
}

export const PipContainer: React.FC = () => {
    const movePersistedElement = useRef<() => void>();

    return <PipContainerInner movePersistedElement={movePersistedElement} />;
};
