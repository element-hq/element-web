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

import React, { createRef, CSSProperties, ReactNode } from 'react';
import dis from '../../../dispatcher/dispatcher';
import CallHandler from '../../../CallHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t, _td } from '../../../languageHandler';
import VideoFeed, { VideoFeedType } from "./VideoFeed";
import RoomAvatar from "../avatars/RoomAvatar";
import { CallState, CallType, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import { CallEvent } from 'matrix-js-sdk/src/webrtc/call';
import classNames from 'classnames';
import AccessibleButton from '../elements/AccessibleButton';
import {isOnlyCtrlOrCmdKeyEvent, Key} from '../../../Keyboard';
import {aboveLeftOf, ChevronFace, ContextMenuButton} from '../../structures/ContextMenu';
import CallContextMenu from '../context_menus/CallContextMenu';
import { avatarUrlForMember } from '../../../Avatar';

interface IProps {
        // The call for us to display
        call: MatrixCall,

        // Another ongoing call to display information about
        secondaryCall?: MatrixCall,

        // maxHeight style attribute for the video panel
        maxVideoHeight?: number;

        // a callback which is called when the content in the callview changes
        // in a way that is likely to cause a resize.
        onResize?: any;

        // Whether this call view is for picture-in-pictue mode
        // otherwise, it's the larger call view when viewing the room the call is in.
        // This is sort of a proxy for a number of things but we currently have no
        // need to control those things separately, so this is simpler.
        pipMode?: boolean;
}

interface IState {
    isLocalOnHold: boolean,
    isRemoteOnHold: boolean,
    micMuted: boolean,
    vidMuted: boolean,
    callState: CallState,
    controlsVisible: boolean,
    showMoreMenu: boolean,
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
const BOTTOM_PADDING = 10;
const BOTTOM_MARGIN_TOP_BOTTOM = 10; // top margin plus bottom margin
const CONTEXT_MENU_VPADDING = 8; // How far the context menu sits above the button (px)

export default class CallView extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private contentRef = createRef<HTMLDivElement>();
    private controlsHideTimer: number = null;
    private contextMenuButton = createRef<HTMLDivElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            isLocalOnHold: this.props.call.isLocalOnHold(),
            isRemoteOnHold: this.props.call.isRemoteOnHold(),
            micMuted: this.props.call.isMicrophoneMuted(),
            vidMuted: this.props.call.isLocalVideoMuted(),
            callState: this.props.call.state,
            controlsVisible: true,
            showMoreMenu: false,
        }

        this.updateCallListeners(null, this.props.call);
    }

    public componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener('keydown', this.onNativeKeyDown);
    }

    public componentWillUnmount() {
        if (getFullScreenElement()) {
            exitFullscreen();
        }

        document.removeEventListener("keydown", this.onNativeKeyDown);
        this.updateCallListeners(this.props.call, null);
        dis.unregister(this.dispatcherRef);
    }

    public componentDidUpdate(prevProps) {
        if (this.props.call === prevProps.call) return;

        this.setState({
            isLocalOnHold: this.props.call.isLocalOnHold(),
            isRemoteOnHold: this.props.call.isRemoteOnHold(),
            micMuted: this.props.call.isMicrophoneMuted(),
            vidMuted: this.props.call.isLocalVideoMuted(),
            callState: this.props.call.state,
        });

        this.updateCallListeners(null, this.props.call);
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
        }
    };

    private updateCallListeners(oldCall: MatrixCall, newCall: MatrixCall) {
        if (oldCall === newCall) return;

        if (oldCall) {
            oldCall.removeListener(CallEvent.State, this.onCallState);
            oldCall.removeListener(CallEvent.LocalHoldUnhold, this.onCallLocalHoldUnhold);
            oldCall.removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHoldUnhold);
        }
        if (newCall) {
            newCall.on(CallEvent.State, this.onCallState);
            newCall.on(CallEvent.LocalHoldUnhold, this.onCallLocalHoldUnhold);
            newCall.on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHoldUnhold);
        }
    }

    private onCallState = (state) => {
        this.setState({
            callState: state,
        });
    };

    private onCallLocalHoldUnhold = () => {
        this.setState({
            isLocalOnHold: this.props.call.isLocalOnHold(),
        });
    };

    private onCallRemoteHoldUnhold = () => {
        this.setState({
            isRemoteOnHold: this.props.call.isRemoteOnHold(),
            // update both here because isLocalOnHold changes when we hold the call too
            isLocalOnHold: this.props.call.isLocalOnHold(),
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
            room_id: this.props.call.roomId,
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
        if (this.state.showMoreMenu) return;

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
        const newVal = !this.state.micMuted;

        this.props.call.setMicrophoneMuted(newVal);
        this.setState({micMuted: newVal});
    }

    private onVidMuteClick = () => {
        const newVal = !this.state.vidMuted;

        this.props.call.setLocalVideoMuted(newVal);
        this.setState({vidMuted: newVal});
    }

    private onMoreClick = () => {
        if (this.controlsHideTimer) {
            clearTimeout(this.controlsHideTimer);
            this.controlsHideTimer = null;
        }

        this.setState({
            showMoreMenu: true,
            controlsVisible: true,
        });
    }

    private closeContextMenu = () => {
        this.setState({
            showMoreMenu: false,
        });
        this.controlsHideTimer = window.setTimeout(this.onControlsHideTimer, CONTROLS_HIDE_DELAY);
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
            room_id: this.props.call.roomId,
        });
    }

    private onSecondaryRoomAvatarClick = () => {
        dis.dispatch({
            action: 'view_room',
            room_id: this.props.secondaryCall.roomId,
        });
    }

    private onCallResumeClick = () => {
        CallHandler.sharedInstance().setActiveCallRoomId(this.props.call.roomId);
    }

    private onSecondaryCallResumeClick = () => {
        CallHandler.sharedInstance().setActiveCallRoomId(this.props.secondaryCall.roomId);
    }

    public render() {
        const client = MatrixClientPeg.get();
        const callRoom = client.getRoom(this.props.call.roomId);
        const secCallRoom = this.props.secondaryCall ? client.getRoom(this.props.secondaryCall.roomId) : null;

        let contextMenu;

        if (this.state.showMoreMenu) {
            contextMenu = <CallContextMenu
                {...aboveLeftOf(
                    this.contextMenuButton.current.getBoundingClientRect(),
                    ChevronFace.None,
                    CONTEXT_MENU_VPADDING,
                )}
                onFinished={this.closeContextMenu}
                call={this.props.call}
            />;
        }

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

        const vidMuteButton = this.props.call.type === CallType.Video ? <AccessibleButton
            className={vidClasses}
            onClick={this.onVidMuteClick}
        /> : null;

        // The 'more' button actions are only relevant in a connected call
        // When not connected, we have to put something there to make the flexbox alignment correct
        const contextMenuButton = this.state.callState === CallState.Connected ? <ContextMenuButton
            className="mx_CallView_callControls_button mx_CallView_callControls_button_more"
            onClick={this.onMoreClick}
            inputRef={this.contextMenuButton}
            isExpanded={this.state.showMoreMenu}
        /> : <div className="mx_CallView_callControls_button mx_CallView_callControls_button_more_hidden" />;

        // in the near future, the dial pad button will go on the left. For now, it's the nothing button
        // because something needs to have margin-right: auto to make the alignment correct.
        const callControls = <div className={callControlsClasses}>
            <div className="mx_CallView_callControls_button mx_CallView_callControls_nothing" />
            <AccessibleButton
                className={micClasses}
                onClick={this.onMicMuteClick}
            />
            <AccessibleButton
                className="mx_CallView_callControls_button mx_CallView_callControls_button_hangup"
                onClick={() => {
                    dis.dispatch({
                        action: 'hangup',
                        room_id: this.props.call.roomId,
                    });
                }}
            />
            {vidMuteButton}
            <div className={micCacheClasses} />
            <div className={vidCacheClasses} />
            {contextMenuButton}
        </div>;

        // The 'content' for the call, ie. the videos for a video call and profile picture
        // for voice calls (fills the bg)
        let contentView: React.ReactNode;

        const isOnHold = this.state.isLocalOnHold || this.state.isRemoteOnHold;
        let onHoldText = null;
        if (this.state.isRemoteOnHold) {
            const holdString = CallHandler.sharedInstance().hasAnyUnheldCall() ?
                _td("You held the call <a>Switch</a>") : _td("You held the call <a>Resume</a>");
            onHoldText = _t(holdString, {}, {
                a: sub => <AccessibleButton kind="link" onClick={this.onCallResumeClick}>
                    {sub}
                </AccessibleButton>,
            });
        } else if (this.state.isLocalOnHold) {
            onHoldText = _t("%(peerName)s held the call", {
                peerName: this.props.call.getOpponentMember().name,
            });
        }

        if (this.props.call.type === CallType.Video) {
            let onHoldContent = null;
            let onHoldBackground = null;
            const backgroundStyle: CSSProperties = {};
            const containerClasses = classNames({
                mx_CallView_video: true,
                mx_CallView_video_hold: isOnHold,
            });
            if (isOnHold) {
                onHoldContent = <div className="mx_CallView_video_holdContent">
                    {onHoldText}
                </div>;
                const backgroundAvatarUrl = avatarUrlForMember(
                    // is it worth getting the size of the div to pass here?
                    this.props.call.getOpponentMember(), 1024, 1024, 'crop',
                );
                backgroundStyle.backgroundImage = 'url(' + backgroundAvatarUrl + ')';
                onHoldBackground = <div className="mx_CallView_video_holdBackground" style={backgroundStyle} />;
            }

            // if we're fullscreen, we don't want to set a maxHeight on the video element.
            const maxVideoHeight = getFullScreenElement() ? null : (
                this.props.maxVideoHeight - (HEADER_HEIGHT + BOTTOM_PADDING + BOTTOM_MARGIN_TOP_BOTTOM)
            );
            contentView = <div className={containerClasses}
                ref={this.contentRef} onMouseMove={this.onMouseMove}
                // Put the max height on here too because this div is ended up 4px larger than the content
                // and is causing it to scroll, and I am genuinely baffled as to why.
                style={{maxHeight: maxVideoHeight}}
            >
                {onHoldBackground}
                <VideoFeed type={VideoFeedType.Remote} call={this.props.call} onResize={this.props.onResize}
                    maxHeight={maxVideoHeight}
                />
                <VideoFeed type={VideoFeedType.Local} call={this.props.call} />
                {onHoldContent}
                {callControls}
            </div>;
        } else {
            const avatarSize = this.props.pipMode ? 76 : 160;
            const classes = classNames({
                mx_CallView_voice: true,
                mx_CallView_voice_hold: isOnHold,
            });

            contentView = <div className={classes} onMouseMove={this.onMouseMove}>
                <div className="mx_CallView_voice_avatarsContainer">
                    <div className="mx_CallView_voice_avatarContainer" style={{width: avatarSize, height: avatarSize}}>
                        <RoomAvatar
                            room={callRoom}
                            height={avatarSize}
                            width={avatarSize}
                        />
                    </div>
                </div>
                <div className="mx_CallView_voice_holdText">{onHoldText}</div>
                {callControls}
            </div>;
        }

        const callTypeText = this.props.call.type === CallType.Video ? _t("Video Call") : _t("Voice Call");
        let myClassName;

        let fullScreenButton;
        if (this.props.call.type === CallType.Video && !this.props.pipMode) {
            fullScreenButton = <div className="mx_CallView_header_button mx_CallView_header_button_fullscreen"
                onClick={this.onFullscreenClick} title={_t("Fill Screen")}
            />;
        }

        let expandButton;
        if (this.props.pipMode) {
            expandButton = <div className="mx_CallView_header_button mx_CallView_header_button_expand"
                onClick={this.onExpandClick} title={_t("Return to call")}
            />;
        }

        const headerControls = <div className="mx_CallView_header_controls">
            {fullScreenButton}
            {expandButton}
        </div>;

        let header: React.ReactNode;
        if (!this.props.pipMode) {
            header = <div className="mx_CallView_header">
                <div className="mx_CallView_header_phoneIcon"></div>
                <span className="mx_CallView_header_callType">{callTypeText}</span>
                {headerControls}
            </div>;
            myClassName = 'mx_CallView_large';
        } else {
            let secondaryCallInfo;
            if (this.props.secondaryCall) {
                secondaryCallInfo = <span className="mx_CallView_header_secondaryCallInfo">
                    <AccessibleButton element='span' onClick={this.onSecondaryRoomAvatarClick}>
                        <RoomAvatar room={secCallRoom} height={16} width={16} />
                        <span className="mx_CallView_secondaryCall_roomName">
                            {_t("%(name)s on hold", { name: secCallRoom.name })}
                        </span>
                    </AccessibleButton>
                </span>;
            }

            header = <div className="mx_CallView_header">
                <AccessibleButton onClick={this.onRoomAvatarClick}>
                    <RoomAvatar room={callRoom} height={32} width={32} />
                </AccessibleButton>
                <div className="mx_CallView_header_callInfo">
                    <div className="mx_CallView_header_roomName">{callRoom.name}</div>
                    <div className="mx_CallView_header_callTypeSmall">
                        {callTypeText}
                        {secondaryCallInfo}
                    </div>
                </div>
                {headerControls}
            </div>;
            myClassName = 'mx_CallView_pip';
        }

        return <div className={"mx_CallView " + myClassName}>
            {header}
            {contentView}
            {contextMenu}
        </div>;
    }
}
