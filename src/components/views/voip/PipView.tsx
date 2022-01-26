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

import React from 'react';
import { CallEvent, CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { EventSubscription } from 'fbemitter';
import { logger } from "matrix-js-sdk/src/logger";
import classNames from 'classnames';

import CallView from "./CallView";
import RoomViewStore from '../../../stores/RoomViewStore';
import CallHandler, { CallHandlerEvent } from '../../../CallHandler';
import PersistentApp from "../elements/PersistentApp";
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import PictureInPictureDragger from './PictureInPictureDragger';
import dis from '../../../dispatcher/dispatcher';
import { Action } from "../../../dispatcher/actions";
import { WidgetLayoutStore } from '../../../stores/widgets/WidgetLayoutStore';
import CallViewHeader from './CallView/CallViewHeader';
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from '../../../stores/ActiveWidgetStore';
import { UPDATE_EVENT } from '../../../stores/AsyncStore';
import { RightPanelPhases } from '../../../stores/right-panel/RightPanelStorePhases';
import RightPanelStore from '../../../stores/right-panel/RightPanelStore';

const SHOW_CALL_IN_STATES = [
    CallState.Connected,
    CallState.InviteSent,
    CallState.Connecting,
    CallState.CreateAnswer,
    CallState.CreateOffer,
    CallState.WaitLocalMedia,
];

interface IProps {
}

interface IState {
    viewedRoomId: string;

    // The main call that we are displaying (ie. not including the call in the room being viewed, if any)
    primaryCall: MatrixCall;

    // Any other call we're displaying: only if the user is on two calls and not viewing either of the rooms
    // they belong to
    secondaryCall: MatrixCall;

    // widget candidate to be displayed in the pip view.
    persistentWidgetId: string;
    showWidgetInPip: boolean;
    rightPanelPhase: RightPanelPhases;

    moving: boolean;
}

// Splits a list of calls into one 'primary' one and a list
// (which should be a single element) of other calls.
// The primary will be the one not on hold, or an arbitrary one
// if they're all on hold)
function getPrimarySecondaryCallsForPip(roomId: string): [MatrixCall, MatrixCall[]] {
    const calls = CallHandler.instance.getAllActiveCallsForPip(roomId);

    let primary: MatrixCall = null;
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
 * PipView shows a small version of the CallView or a sticky widget hovering over the UI in 'picture-in-picture'
 * (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing
 * and all widgets that are active but not shown in any other possible container.
 */

@replaceableComponent("views.voip.PipView")
export default class PipView extends React.Component<IProps, IState> {
    private roomStoreToken: EventSubscription;
    private settingsWatcherRef: string;

    constructor(props: IProps) {
        super(props);

        const roomId = RoomViewStore.getRoomId();

        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(roomId);

        this.state = {
            moving: false,
            viewedRoomId: roomId,
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
            persistentWidgetId: ActiveWidgetStore.instance.getPersistentWidgetId(),
            rightPanelPhase: RightPanelStore.instance.currentCard.phase,
            showWidgetInPip: false,
        };
    }

    public componentDidMount() {
        CallHandler.instance.addListener(CallHandlerEvent.CallChangeRoom, this.updateCalls);
        CallHandler.instance.addListener(CallHandlerEvent.CallState, this.updateCalls);
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        MatrixClientPeg.get().on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        const room = MatrixClientPeg.get()?.getRoom(this.state.viewedRoomId);
        if (room) {
            WidgetLayoutStore.instance.on(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Update, this.onActiveWidgetStoreUpdate);
        document.addEventListener("mouseup", this.onEndMoving.bind(this));
    }

    public componentWillUnmount() {
        CallHandler.instance.removeListener(CallHandlerEvent.CallChangeRoom, this.updateCalls);
        CallHandler.instance.removeListener(CallHandlerEvent.CallState, this.updateCalls);
        MatrixClientPeg.get().removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHold);
        this.roomStoreToken?.remove();
        SettingsStore.unwatchSetting(this.settingsWatcherRef);
        const room = MatrixClientPeg.get().getRoom(this.state.viewedRoomId);
        if (room) {
            WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(room), this.updateCalls);
        }
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        ActiveWidgetStore.instance.off(ActiveWidgetStoreEvent.Update, this.onActiveWidgetStoreUpdate);
        document.removeEventListener("mouseup", this.onEndMoving.bind(this));
    }

    private onStartMoving() {
        this.setState({ moving: true });
    }

    private onEndMoving() {
        this.setState({ moving: false });
    }

    private onRoomViewStoreUpdate = () => {
        const newRoomId = RoomViewStore.getRoomId();
        const oldRoomId = this.state.viewedRoomId;
        if (newRoomId === oldRoomId) return;
        // The WidgetLayoutStore observer always tracks the currently viewed Room,
        // so we don't end up with multiple observers and know what observer to remove on unmount
        const oldRoom = MatrixClientPeg.get()?.getRoom(oldRoomId);
        if (oldRoom) {
            WidgetLayoutStore.instance.off(WidgetLayoutStore.emissionForRoom(oldRoom), this.updateCalls);
        }
        const newRoom = MatrixClientPeg.get()?.getRoom(newRoomId);
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

    private onRightPanelStoreUpdate = () => {
        this.setState({
            rightPanelPhase: RightPanelStore.instance.currentCard.phase,
        });
        this.updateShowWidgetInPip();
    };

    private onActiveWidgetStoreUpdate = (): void => {
        this.updateShowWidgetInPip(ActiveWidgetStore.instance.getPersistentWidgetId());
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

    private onCallRemoteHold = () => {
        if (!this.state.viewedRoomId) return;
        const [primaryCall, secondaryCalls] = getPrimarySecondaryCallsForPip(this.state.viewedRoomId);

        this.setState({
            primaryCall: primaryCall,
            secondaryCall: secondaryCalls[0],
        });
    };

    private onDoubleClick = (): void => {
        const callRoomId = this.state.primaryCall?.roomId;
        const widgetRoomId = ActiveWidgetStore.instance.getRoomId(this.state.persistentWidgetId);
        if (!!(callRoomId ?? widgetRoomId)) {
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: callRoomId ?? widgetRoomId,
            });
        }
    };

    // Accepts a persistentWidgetId to be able to skip awaiting the setState for persistentWidgetId
    public updateShowWidgetInPip(persistentWidgetId = this.state.persistentWidgetId) {
        let userIsPartOfTheRoom = false;
        let fromAnotherRoom = false;
        let notVisible = false;
        if (persistentWidgetId) {
            const persistentWidgetInRoomId = ActiveWidgetStore.instance.getRoomId(persistentWidgetId);
            const persistentWidgetInRoom = MatrixClientPeg.get().getRoom(persistentWidgetInRoomId);

            // Sanity check the room - the widget may have been destroyed between render cycles, and
            // thus no room is associated anymore.
            if (persistentWidgetInRoom) {
                const wls = WidgetLayoutStore.instance;
                notVisible = !wls.isVisibleOnScreen(persistentWidgetInRoom, persistentWidgetId);
                userIsPartOfTheRoom = persistentWidgetInRoom.getMyMembership() == "join";
                fromAnotherRoom = this.state.viewedRoomId !== persistentWidgetInRoomId;
            }
        }

        // The widget should only be shown as a persistent app (in a floating pip container) if it is not visible on screen
        // either, because we are viewing a different room OR because it is in none of the possible containers of the room view.
        const showWidgetInPip =
            (fromAnotherRoom && userIsPartOfTheRoom) ||
            (notVisible && userIsPartOfTheRoom);

        this.setState({ showWidgetInPip, persistentWidgetId });
    }

    public render() {
        const pipMode = true;
        let pipContent;

        if (this.state.primaryCall) {
            pipContent = ({ onStartMoving, onResize }) =>
                <CallView
                    onMouseDownOnHeader={onStartMoving}
                    call={this.state.primaryCall}
                    secondaryCall={this.state.secondaryCall}
                    pipMode={pipMode}
                    onResize={onResize}
                />;
        }

        if (this.state.showWidgetInPip) {
            const pipViewClasses = classNames({
                mx_CallView: true,
                mx_CallView_pip: pipMode,
                mx_CallView_large: !pipMode,
            });
            const roomId = ActiveWidgetStore.instance.getRoomId(this.state.persistentWidgetId);
            const roomForWidget = MatrixClientPeg.get().getRoom(roomId);

            pipContent = ({ onStartMoving, _onResize }) =>
                <div className={pipViewClasses}>
                    <CallViewHeader
                        onPipMouseDown={(event) => { onStartMoving(event); this.onStartMoving.bind(this)(); }}
                        pipMode={pipMode}
                        callRooms={[roomForWidget]}
                    />
                    <PersistentApp
                        persistentWidgetId={this.state.persistentWidgetId}
                        pointerEvents={this.state.moving ? 'none' : undefined}
                    />
                </div>;
        }

        if (!!pipContent) {
            return <PictureInPictureDragger
                className="mx_CallPreview"
                draggable={pipMode}
                onDoubleClick={this.onDoubleClick}
            >
                { pipContent }
            </PictureInPictureDragger>;
        }

        return null;
    }
}
