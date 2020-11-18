/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from 'react';
import Room from 'matrix-js-sdk/src/models/room';
import dis from '../../../dispatcher/dispatcher';
import CallHandler from '../../../CallHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from '../../../languageHandler';
import AccessibleButton from '../elements/AccessibleButton';
import VideoFeed, { VideoFeedType } from "./VideoFeed";
import RoomAvatar from "../avatars/RoomAvatar";
import PulsedAvatar from '../avatars/PulsedAvatar';
import { CallState, CallType, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { CallEvent } from 'matrix-js-sdk/src/webrtc/call';

interface IProps {
        // js-sdk room object. If set, we will only show calls for the given
        // room; if not, we will show any active call.
        room?: Room;

        // maxHeight style attribute for the video panel
        maxVideoHeight?: number;

        // a callback which is called when the user clicks on the video div
        onClick?: React.MouseEventHandler;

        // a callback which is called when the content in the callview changes
        // in a way that is likely to cause a resize.
        onResize?: any;

        // classname applied to view,
        className?: string;

        // Whether to show the hang up icon:W
        showHangup?: boolean;
}

interface IState {
    call: MatrixCall;
    isLocalOnHold: boolean,
}

function getFullScreenElement() {
    return (
        document.fullscreenElement ||
        // moz omitted because firefox supports this unprefixed now (webkit here for safari)
        document.webkitFullscreenElement ||
        document.msFullscreenElement
    );
}

function requestFullscreen(element: Element) {
    const method = (
        element.requestFullscreen ||
        // moz omitted since firefox supports unprefixed now
        element.webkitRequestFullScreen ||
        element.msRequestFullscreen
    );
    if (method) method.call(element);
}

function exitFullscreen() {
    const exitMethod = (
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen
    );
    if (exitMethod) exitMethod.call(document);
}

export default class CallView extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private container = createRef<HTMLDivElement>();

    constructor(props: IProps) {
        super(props);

        const call = this.getCall();
        this.state = {
            call,
            isLocalOnHold: call ? call.isLocalOnHold() : null,
        }

        this.updateCallListeners(null, call);
    }

    public componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount() {
        this.updateCallListeners(this.state.call, null);
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload) => {
        switch (payload.action) {
            case 'video_fullscreen': {
                if (!this.container.current) {
                    return;
                }
                if (payload.fullscreen) {
                    requestFullscreen(this.container.current);
                } else if (getFullScreenElement()) {
                    exitFullscreen();
                }
                break;
            }
            case 'call_state': {
                const newCall = this.getCall();
                if (newCall !== this.state.call) {
                    this.updateCallListeners(this.state.call, newCall);
                    this.setState({
                        call: newCall,
                        isLocalOnHold: newCall ? newCall.isLocalOnHold() : null,
                    });
                }
                if (!newCall && getFullScreenElement()) {
                    exitFullscreen();
                }
                break;
            }
        }
    };

    private getCall(): MatrixCall {
        let call: MatrixCall;

        if (this.props.room) {
            const roomId = this.props.room.roomId;
            call = CallHandler.sharedInstance().getCallForRoom(roomId);

            // We don't currently show voice calls in this view when in the room:
            // they're represented in the room status bar at the bottom instead
            // (but this will all change with the new designs)
            if (call && call.type == CallType.Voice) call = null;
        } else {
            call = CallHandler.sharedInstance().getAnyActiveCall();
            // Ignore calls if we can't get the room associated with them.
            // I think the underlying problem is that the js-sdk sends events
            // for calls before it has made the rooms available in the store,
            // although this isn't confirmed.
            if (MatrixClientPeg.get().getRoom(call.roomId) === null) {
                call = null;
            }
        }

        if (call && call.state == CallState.Ended) return null;
        return call;
    }

    private updateCallListeners(oldCall: MatrixCall, newCall: MatrixCall) {
        if (oldCall === newCall) return;

        if (oldCall) oldCall.removeListener(CallEvent.HoldUnhold, this.onCallHoldUnhold);
        if (newCall) newCall.on(CallEvent.HoldUnhold, this.onCallHoldUnhold);
    }

    private onCallHoldUnhold = () => {
        this.setState({
            isLocalOnHold: this.state.call ? this.state.call.isLocalOnHold() : null,
        });
    };

    public render() {
        let view: React.ReactNode;

        if (this.state.call) {
            if (this.state.call.type === "voice") {
                const client = MatrixClientPeg.get();
                const callRoom = client.getRoom(this.state.call.roomId);

                let caption = _t("Active call");
                if (this.state.isLocalOnHold) {
                    // we currently have no UI for holding / unholding a call (apart from slash
                    // commands) so we don't disintguish between when we've put the call on hold
                    // (ie. we'd show an unhold button) and when the other side has put us on hold
                    // (where obviously we would not show such a button).
                    caption = _t("Call Paused");
                }

                view = <AccessibleButton className="mx_CallView_voice" onClick={this.props.onClick}>
                    <PulsedAvatar>
                        <RoomAvatar
                            room={callRoom}
                            height={35}
                            width={35}
                        />
                    </PulsedAvatar>
                    <div>
                        <h1>{callRoom.name}</h1>
                        <p>{ caption }</p>
                    </div>
                </AccessibleButton>;
            } else {
                // For video calls, we currently ignore the call hold state altogether
                // (the video will just go black)

                // if we're fullscreen, we don't want to set a maxHeight on the video element.
                const maxVideoHeight = getFullScreenElement() ? null : this.props.maxVideoHeight;
                view = <div className="mx_CallView_video" onClick={this.props.onClick}>
                    <VideoFeed type={VideoFeedType.Remote} call={this.state.call} onResize={this.props.onResize}
                        maxHeight={maxVideoHeight}
                    />
                    <VideoFeed type={VideoFeedType.Local} call={this.state.call} />
                </div>;
            }
        }

        let hangup: React.ReactNode;
        if (this.props.showHangup) {
            hangup = <div
                className="mx_CallView_hangup"
                onClick={() => {
                    dis.dispatch({
                        action: 'hangup',
                        room_id: this.state.call.roomId,
                    });
                }}
            />;
        }

        return <div className={this.props.className} ref={this.container}>
            {view}
            {hangup}
        </div>;
    }
}
