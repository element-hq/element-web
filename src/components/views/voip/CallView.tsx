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
import VideoFeed, { VideoFeedType } from "./VideoFeed";
import RoomAvatar from "../avatars/RoomAvatar";
import { CallState, CallType, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { CallEvent } from 'matrix-js-sdk/src/webrtc/call';
import classNames from 'classnames';
import AccessibleButton from '../elements/AccessibleButton';
import {isOnlyCtrlOrCmdKeyEvent, Key} from '../../../Keyboard';

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

        // Whether to show the hang up icon:W
        showHangup?: boolean;
}

interface IState {
    call: MatrixCall;
    isLocalOnHold: boolean,
    micMuted: boolean,
    vidMuted: boolean,
    callState: CallState,
    controlsVisible: boolean,
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

const CONTROLS_HIDE_DELAY = 1000;
// Height of the header duplicated from CSS because we need to subtract it from our max
// height to get the max height of the video
const HEADER_HEIGHT = 44;

export default class CallView extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private contentRef = createRef<HTMLDivElement>();
    private controlsHideTimer: number = null;
    constructor(props: IProps) {
        super(props);

        const call = this.getCall();
        this.state = {
            call,
            isLocalOnHold: call ? call.isLocalOnHold() : null,
            micMuted: call ? call.isMicrophoneMuted() : null,
            vidMuted: call ? call.isLocalVideoMuted() : null,
            callState: call ? call.state : null,
            controlsVisible: true,
        }

        this.updateCallListeners(null, call);
    }

    public componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener('keydown', this.onNativeKeyDown);
    }

    public componentWillUnmount() {
        document.removeEventListener("keydown", this.onNativeKeyDown);
        this.updateCallListeners(this.state.call, null);
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload) => {
        switch (payload.action) {
            case 'video_fullscreen': {
                if (!this.contentRef.current) {
                    return;
                }
                if (payload.fullscreen) {
                    requestFullscreen(this.contentRef.current);
                } else if (getFullScreenElement()) {
                    exitFullscreen();
                }
                break;
            }
            case 'call_state': {
                const newCall = this.getCall();
                if (newCall !== this.state.call) {
                    this.updateCallListeners(this.state.call, newCall);
                    let newControlsVisible = this.state.controlsVisible;
                    if (newCall && !this.state.call) {
                        newControlsVisible = true;
                        if (this.controlsHideTimer !== null) {
                            clearTimeout(this.controlsHideTimer);
                        }
                        this.controlsHideTimer = window.setTimeout(this.onControlsHideTimer, CONTROLS_HIDE_DELAY);
                    }
                    this.setState({
                        call: newCall,
                        isLocalOnHold: newCall ? newCall.isLocalOnHold() : null,
                        micMuted: newCall ? newCall.isMicrophoneMuted() : null,
                        vidMuted: newCall ? newCall.isLocalVideoMuted() : null,
                        callState: newCall ? newCall.state : null,
                        controlsVisible: newControlsVisible,
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

        if (call && [CallState.Ended, CallState.Ringing].includes(call.state)) return null;
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

    private onFullscreenClick = () => {
        dis.dispatch({
            action: 'video_fullscreen',
            fullscreen: true,
        });
    };

    private onExpandClick = () => {
        dis.dispatch({
            action: 'view_room',
            room_id: this.state.call.roomId,
        });
    };

    private onControlsHideTimer = () => {
        this.controlsHideTimer = null;
        this.setState({
            controlsVisible: false,
        });
    }

    private onMouseMove = () => {
        this.showControls();
    }

    private showControls() {
        if (!this.state.controlsVisible) {
            this.setState({
                controlsVisible: true,
            });
        }
        if (this.controlsHideTimer !== null) {
            clearTimeout(this.controlsHideTimer);
        }
        this.controlsHideTimer = window.setTimeout(this.onControlsHideTimer, CONTROLS_HIDE_DELAY);
    }

    private onMicMuteClick = () => {
        if (!this.state.call) return;

        const newVal = !this.state.micMuted;

        this.state.call.setMicrophoneMuted(newVal);
        this.setState({micMuted: newVal});
    }

    private onVidMuteClick = () => {
        if (!this.state.call) return;

        const newVal = !this.state.vidMuted;

        this.state.call.setLocalVideoMuted(newVal);
        this.setState({vidMuted: newVal});
    }

    // we register global shortcuts here, they *must not conflict* with local shortcuts elsewhere or both will fire
    // Note that this assumes we always have a callview on screen at any given time
    // CallHandler would probably be a better place for this
    private onNativeKeyDown = ev => {
        let handled = false;
        const ctrlCmdOnly = isOnlyCtrlOrCmdKeyEvent(ev);

        switch (ev.key) {
            case Key.D:
                if (ctrlCmdOnly) {
                    this.onMicMuteClick();
                    // show the controls to give feedback
                    this.showControls();
                    handled = true;
                }
                break;

            case Key.E:
                if (ctrlCmdOnly) {
                    this.onVidMuteClick();
                    // show the controls to give feedback
                    this.showControls();
                    handled = true;
                }
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    private onRoomAvatarClick = () => {
        dis.dispatch({
            action: 'view_room',
            room_id: this.state.call.roomId,
        });
    }

    public render() {
        if (!this.state.call) return null;

        const client = MatrixClientPeg.get();
        const callRoom = client.getRoom(this.state.call.roomId);

        let callControls;
        if (this.props.room) {
            const micClasses = classNames({
                mx_CallView_callControls_button: true,
                mx_CallView_callControls_button_micOn: !this.state.micMuted,
                mx_CallView_callControls_button_micOff: this.state.micMuted,
            });

            const vidClasses = classNames({
                mx_CallView_callControls_button: true,
                mx_CallView_callControls_button_vidOn: !this.state.vidMuted,
                mx_CallView_callControls_button_vidOff: this.state.vidMuted,
            });

            // Put the other states of the mic/video icons in the document to make sure they're cached
            // (otherwise the icon disappears briefly when toggled)
            const micCacheClasses = classNames({
                mx_CallView_callControls_button: true,
                mx_CallView_callControls_button_micOn: this.state.micMuted,
                mx_CallView_callControls_button_micOff: !this.state.micMuted,
                mx_CallView_callControls_button_invisible: true,
            });

            const vidCacheClasses = classNames({
                mx_CallView_callControls_button: true,
                mx_CallView_callControls_button_vidOn: this.state.micMuted,
                mx_CallView_callControls_button_vidOff: !this.state.micMuted,
                mx_CallView_callControls_button_invisible: true,
            });

            const callControlsClasses = classNames({
                mx_CallView_callControls: true,
                mx_CallView_callControls_hidden: !this.state.controlsVisible,
            });

            const vidMuteButton = this.state.call.type === CallType.Video ? <div
                className={vidClasses}
                onClick={this.onVidMuteClick}
            /> : null;

            callControls = <div className={callControlsClasses}>
                <div
                    className={micClasses}
                    onClick={this.onMicMuteClick}
                />
                <div
                    className="mx_CallView_callControls_button mx_CallView_callControls_button_hangup"
                    onClick={() => {
                        dis.dispatch({
                            action: 'hangup',
                            room_id: this.state.call.roomId,
                        });
                    }}
                />
                {vidMuteButton}
                <div className={micCacheClasses} />
                <div className={vidCacheClasses} />
            </div>;
        }

        // The 'content' for the call, ie. the videos for a video call and profile picture
        // for voice calls (fills the bg)
        let contentView: React.ReactNode;

        if (this.state.call.type === CallType.Video) {
            // if we're fullscreen, we don't want to set a maxHeight on the video element.
            const maxVideoHeight = getFullScreenElement() ? null : this.props.maxVideoHeight - HEADER_HEIGHT;
            contentView = <div className="mx_CallView_video" ref={this.contentRef} onMouseMove={this.onMouseMove}>
                <VideoFeed type={VideoFeedType.Remote} call={this.state.call} onResize={this.props.onResize}
                    maxHeight={maxVideoHeight}
                />
                <VideoFeed type={VideoFeedType.Local} call={this.state.call} />
                {callControls}
            </div>;
        } else {
            const avatarSize = this.props.room ? 200 : 75;
            contentView = <div className="mx_CallView_voice" onMouseMove={this.onMouseMove}>
                <RoomAvatar
                    room={callRoom}
                    height={avatarSize}
                    width={avatarSize}
                />
                {callControls}
            </div>;
        }

        const callTypeText = this.state.call.type === CallType.Video ? _t("Video Call") : _t("Voice Call");
        let myClassName;

        let fullScreenButton;
        if (this.state.call.type === CallType.Video && this.props.room) {
            fullScreenButton = <div className="mx_CallView_header_button mx_CallView_header_button_fullscreen"
                onClick={this.onFullscreenClick} title={_t("Fill Screen")}
            />;
        }

        let expandButton;
        if (!this.props.room) {
            expandButton = <div className="mx_CallView_header_button mx_CallView_header_button_expand"
                onClick={this.onExpandClick} title={_t("Return to call")}
            />;
        }

        const headerControls = <div className="mx_CallView_header_controls">
            {fullScreenButton}
            {expandButton}
        </div>;

        let header: React.ReactNode;
        if (this.props.room) {
            header = <div className="mx_CallView_header">
                <div className="mx_CallView_header_phoneIcon"></div>
                <span className="mx_CallView_header_callType">{callTypeText}</span>
                {headerControls}
            </div>;
            myClassName = 'mx_CallView_large';
        } else {
            header = <div className="mx_CallView_header">
                <AccessibleButton onClick={this.onRoomAvatarClick}>
                    <RoomAvatar room={callRoom} height={32} width={32} />
                </AccessibleButton>
                <div>
                    <div className="mx_CallView_header_roomName">{callRoom.name}</div>
                    <div className="mx_CallView_header_callTypeSmall">{callTypeText}</div>
                </div>
                {headerControls}
            </div>;
            myClassName = 'mx_CallView_pip';
        }

        return <div className={"mx_CallView " + myClassName}>
            {header}
            {contentView}
        </div>;
    }
}
