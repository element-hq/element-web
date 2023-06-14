/*
Copyright 2017 - 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { MutableRefObject, ReactNode, useContext, useRef } from "react";
import { CallEvent, CallState, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { logger } from "matrix-js-sdk/src/logger";
import { Optional } from "matrix-events-sdk";

import LegacyCallView from "../views/voip/LegacyCallView";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import PictureInPictureDragger, { CreatePipChildren } from "./PictureInPictureDragger";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from "../../stores/ActiveWidgetStore";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { SDKContext, SdkContextClass } from "../../contexts/SDKContext";
import {
    useCurrentVoiceBroadcastPreRecording,
    useCurrentVoiceBroadcastRecording,
    VoiceBroadcastPlayback,
    VoiceBroadcastPlaybackBody,
    VoiceBroadcastPreRecording,
    VoiceBroadcastPreRecordingPip,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingPip,
    VoiceBroadcastSmallPlaybackBody,
} from "../../voice-broadcast";
import { useCurrentVoiceBroadcastPlayback } from "../../voice-broadcast/hooks/useCurrentVoiceBroadcastPlayback";
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
    voiceBroadcastRecording: Optional<VoiceBroadcastRecording>;
    voiceBroadcastPreRecording: Optional<VoiceBroadcastPreRecording>;
    voiceBroadcastPlayback: Optional<VoiceBroadcastPlayback>;
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
        MatrixClientPeg.get().on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        const room = MatrixClientPeg.get()?.getRoom(this.state.viewedRoomId);
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
        if (persistentWidgetId && persistentRoomId && MatrixClientPeg.get().getRoom(persistentRoomId)) {
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

    private createVoiceBroadcastPlaybackPipContent(voiceBroadcastPlayback: VoiceBroadcastPlayback): CreatePipChildren {
        const content =
            this.state.viewedRoomId === voiceBroadcastPlayback.infoEvent.getRoomId() ? (
                <VoiceBroadcastPlaybackBody playback={voiceBroadcastPlayback} pip={true} />
            ) : (
                <VoiceBroadcastSmallPlaybackBody playback={voiceBroadcastPlayback} />
            );

        return ({ onStartMoving }) => (
            <div key={`vb-playback-${voiceBroadcastPlayback.infoEvent.getId()}`} onMouseDown={onStartMoving}>
                {content}
            </div>
        );
    }

    private createVoiceBroadcastPreRecordingPipContent(
        voiceBroadcastPreRecording: VoiceBroadcastPreRecording,
    ): CreatePipChildren {
        return ({ onStartMoving }) => (
            <div key="vb-pre-recording" onMouseDown={onStartMoving}>
                <VoiceBroadcastPreRecordingPip voiceBroadcastPreRecording={voiceBroadcastPreRecording} />
            </div>
        );
    }

    private createVoiceBroadcastRecordingPipContent(
        voiceBroadcastRecording: VoiceBroadcastRecording,
    ): CreatePipChildren {
        return ({ onStartMoving }) => (
            <div key={`vb-recording-${voiceBroadcastRecording.infoEvent.getId()}`} onMouseDown={onStartMoving}>
                <VoiceBroadcastRecordingPip recording={voiceBroadcastRecording} />
            </div>
        );
    }

    public render(): ReactNode {
        const pipMode = true;
        let pipContent: Array<CreatePipChildren> = [];

        if (this.props.voiceBroadcastRecording) {
            pipContent = [this.createVoiceBroadcastRecordingPipContent(this.props.voiceBroadcastRecording)];
        } else if (this.props.voiceBroadcastPreRecording) {
            pipContent = [this.createVoiceBroadcastPreRecordingPipContent(this.props.voiceBroadcastPreRecording)];
        } else if (this.props.voiceBroadcastPlayback) {
            pipContent = [this.createVoiceBroadcastPlaybackPipContent(this.props.voiceBroadcastPlayback)];
        }

        if (this.state.primaryCall) {
            // get a ref to call inside the current scope
            const call = this.state.primaryCall;
            pipContent.push(({ onStartMoving, onResize }) => (
                <LegacyCallView
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
                    widgetId={this.state.persistentWidgetId!}
                    room={MatrixClientPeg.get().getRoom(this.state.persistentRoomId ?? undefined)!}
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
    const sdkContext = useContext(SDKContext);
    const voiceBroadcastPreRecordingStore = sdkContext.voiceBroadcastPreRecordingStore;
    const { currentVoiceBroadcastPreRecording } = useCurrentVoiceBroadcastPreRecording(voiceBroadcastPreRecordingStore);

    const voiceBroadcastRecordingsStore = sdkContext.voiceBroadcastRecordingsStore;
    const { currentVoiceBroadcastRecording } = useCurrentVoiceBroadcastRecording(voiceBroadcastRecordingsStore);

    const voiceBroadcastPlaybacksStore = sdkContext.voiceBroadcastPlaybacksStore;
    const { currentVoiceBroadcastPlayback } = useCurrentVoiceBroadcastPlayback(voiceBroadcastPlaybacksStore);

    const movePersistedElement = useRef<() => void>();

    return (
        <PipContainerInner
            voiceBroadcastPlayback={currentVoiceBroadcastPlayback}
            voiceBroadcastPreRecording={currentVoiceBroadcastPreRecording}
            voiceBroadcastRecording={currentVoiceBroadcastRecording}
            movePersistedElement={movePersistedElement}
        />
    );
};
