/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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
import { CallEvent, CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import classNames from 'classnames';
import { CallFeed } from 'matrix-js-sdk/src/webrtc/callFeed';
import { SDPStreamMetadataPurpose } from 'matrix-js-sdk/src/webrtc/callEventTypes';

import dis from '../../../dispatcher/dispatcher';
import CallHandler from '../../../CallHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { _t, _td } from '../../../languageHandler';
import VideoFeed from './VideoFeed';
import RoomAvatar from "../avatars/RoomAvatar";
import AccessibleButton from '../elements/AccessibleButton';
import { avatarUrlForMember } from '../../../Avatar';
import DesktopCapturerSourcePicker from "../elements/DesktopCapturerSourcePicker";
import Modal from '../../../Modal';
import CallViewSidebar from './CallViewSidebar';
import CallViewHeader from './CallView/CallViewHeader';
import CallViewButtons from "./CallView/CallViewButtons";
import PlatformPeg from "../../../PlatformPeg";
import { ActionPayload } from "../../../dispatcher/payloads";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

interface IProps {
    // The call for us to display
    call: MatrixCall;

    // Another ongoing call to display information about
    secondaryCall?: MatrixCall;

    // a callback which is called when the content in the CallView changes
    // in a way that is likely to cause a resize.
    onResize?: (event: Event) => void;

    // Whether this call view is for picture-in-picture mode
    // otherwise, it's the larger call view when viewing the room the call is in.
    // This is sort of a proxy for a number of things but we currently have no
    // need to control those things separately, so this is simpler.
    pipMode?: boolean;

    // Used for dragging the PiP CallView
    onMouseDownOnHeader?: (event: React.MouseEvent<Element, MouseEvent>) => void;

    showApps?: boolean;
}

interface IState {
    isLocalOnHold: boolean;
    isRemoteOnHold: boolean;
    micMuted: boolean;
    vidMuted: boolean;
    screensharing: boolean;
    callState: CallState;
    primaryFeed?: CallFeed;
    secondaryFeed?: CallFeed;
    sidebarFeeds: Array<CallFeed>;
    sidebarShown: boolean;
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
    private contentWrapperRef = createRef<HTMLDivElement>();
    private buttonsRef = createRef<CallViewButtons>();

    constructor(props: IProps) {
        super(props);

        const { primary, secondary, sidebar } = CallView.getOrderedFeeds(this.props.call.getFeeds());

        this.state = {
            isLocalOnHold: this.props.call.isLocalOnHold(),
            isRemoteOnHold: this.props.call.isRemoteOnHold(),
            micMuted: this.props.call.isMicrophoneMuted(),
            vidMuted: this.props.call.isLocalVideoMuted(),
            screensharing: this.props.call.isScreensharing(),
            callState: this.props.call.state,
            primaryFeed: primary,
            secondaryFeed: secondary,
            sidebarFeeds: sidebar,
            sidebarShown: true,
        };

        this.updateCallListeners(null, this.props.call);
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener('keydown', this.onNativeKeyDown);
    }

    public componentWillUnmount(): void {
        if (getFullScreenElement()) {
            exitFullscreen();
        }

        document.removeEventListener("keydown", this.onNativeKeyDown);
        this.updateCallListeners(this.props.call, null);
        dis.unregister(this.dispatcherRef);
    }

    static getDerivedStateFromProps(props: IProps): Partial<IState> {
        const { primary, secondary, sidebar } = CallView.getOrderedFeeds(props.call.getFeeds());

        return {
            primaryFeed: primary,
            secondaryFeed: secondary,
            sidebarFeeds: sidebar,
        };
    }

    public componentDidUpdate(prevProps: IProps): void {
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

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case 'video_fullscreen': {
                if (!this.contentWrapperRef.current) {
                    return;
                }
                if (payload.fullscreen) {
                    requestFullscreen(this.contentWrapperRef.current);
                } else if (getFullScreenElement()) {
                    exitFullscreen();
                }
                break;
            }
        }
    };

    private updateCallListeners(oldCall: MatrixCall, newCall: MatrixCall): void {
        if (oldCall === newCall) return;

        if (oldCall) {
            oldCall.removeListener(CallEvent.State, this.onCallState);
            oldCall.removeListener(CallEvent.LocalHoldUnhold, this.onCallLocalHoldUnhold);
            oldCall.removeListener(CallEvent.RemoteHoldUnhold, this.onCallRemoteHoldUnhold);
            oldCall.removeListener(CallEvent.FeedsChanged, this.onFeedsChanged);
        }
        if (newCall) {
            newCall.on(CallEvent.State, this.onCallState);
            newCall.on(CallEvent.LocalHoldUnhold, this.onCallLocalHoldUnhold);
            newCall.on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHoldUnhold);
            newCall.on(CallEvent.FeedsChanged, this.onFeedsChanged);
        }
    }

    private onCallState = (state: CallState): void => {
        this.setState({
            callState: state,
        });
    };

    private onFeedsChanged = (newFeeds: Array<CallFeed>): void => {
        const { primary, secondary, sidebar } = CallView.getOrderedFeeds(newFeeds);
        this.setState({
            primaryFeed: primary,
            secondaryFeed: secondary,
            sidebarFeeds: sidebar,
            micMuted: this.props.call.isMicrophoneMuted(),
            vidMuted: this.props.call.isLocalVideoMuted(),
        });
    };

    private onCallLocalHoldUnhold = (): void => {
        this.setState({
            isLocalOnHold: this.props.call.isLocalOnHold(),
        });
    };

    private onCallRemoteHoldUnhold = (): void => {
        this.setState({
            isRemoteOnHold: this.props.call.isRemoteOnHold(),
            // update both here because isLocalOnHold changes when we hold the call too
            isLocalOnHold: this.props.call.isLocalOnHold(),
        });
    };

    private onMouseMove = (): void => {
        this.buttonsRef.current?.showControls();
    };

    static getOrderedFeeds(
        feeds: Array<CallFeed>,
    ): { primary?: CallFeed, secondary?: CallFeed, sidebar: Array<CallFeed> } {
        if (feeds.length <= 2) {
            return {
                primary: feeds.find((feed) => !feed.isLocal()),
                secondary: feeds.find((feed) => feed.isLocal()),
                sidebar: [],
            };
        }

        let primary: CallFeed;

        // Try to use a screensharing as primary, a remote one if possible
        const screensharingFeeds = feeds.filter((feed) => feed.purpose === SDPStreamMetadataPurpose.Screenshare);
        primary = screensharingFeeds.find((feed) => !feed.isLocal()) || screensharingFeeds[0];
        // If we didn't find remote screen-sharing stream, try to find any remote stream
        if (!primary) {
            primary = feeds.find((feed) => !feed.isLocal());
        }

        const sidebar = [...feeds];
        // Remove the primary feed from the array
        if (primary) sidebar.splice(sidebar.indexOf(primary), 1);
        sidebar.sort((a, b) => {
            if (a.isLocal() && !b.isLocal()) return -1;
            if (!a.isLocal() && b.isLocal()) return 1;
            return 0;
        });

        return { primary, sidebar };
    }

    private onMaximizeClick = (): void => {
        dis.dispatch({
            action: 'video_fullscreen',
            fullscreen: true,
        });
    };

    private onMicMuteClick = async (): Promise<void> => {
        const newVal = !this.state.micMuted;
        this.setState({ micMuted: await this.props.call.setMicrophoneMuted(newVal) });
    };

    private onVidMuteClick = async (): Promise<void> => {
        const newVal = !this.state.vidMuted;
        this.setState({ vidMuted: await this.props.call.setLocalVideoMuted(newVal) });
    };

    private onScreenshareClick = async (): Promise<void> => {
        let isScreensharing;
        if (this.state.screensharing) {
            isScreensharing = await this.props.call.setScreensharingEnabled(false);
        } else {
            if (PlatformPeg.get().supportsDesktopCapturer()) {
                const { finished } = Modal.createDialog(DesktopCapturerSourcePicker);
                const [source] = await finished;
                if (!source) return;

                isScreensharing = await this.props.call.setScreensharingEnabled(true, source);
            } else {
                isScreensharing = await this.props.call.setScreensharingEnabled(true);
            }
        }

        this.setState({
            sidebarShown: true,
            screensharing: isScreensharing,
        });
    };

    // we register global shortcuts here, they *must not conflict* with local shortcuts elsewhere or both will fire
    // Note that this assumes we always have a CallView on screen at any given time
    // CallHandler would probably be a better place for this
    private onNativeKeyDown = (ev): void => {
        let handled = false;

        const callAction = getKeyBindingsManager().getCallAction(ev);
        switch (callAction) {
            case KeyBindingAction.ToggleMicInCall:
                this.onMicMuteClick();
                // show the controls to give feedback
                this.buttonsRef.current?.showControls();
                handled = true;
                break;

            case KeyBindingAction.ToggleWebcamInCall:
                this.onVidMuteClick();
                // show the controls to give feedback
                this.buttonsRef.current?.showControls();
                handled = true;
                break;
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    private onCallResumeClick = (): void => {
        const userFacingRoomId = CallHandler.instance.roomIdForCall(this.props.call);
        CallHandler.instance.setActiveCallRoomId(userFacingRoomId);
    };

    private onTransferClick = (): void => {
        const transfereeCall = CallHandler.instance.getTransfereeForCallId(this.props.call.callId);
        this.props.call.transferToCall(transfereeCall);
    };

    private onHangupClick = (): void => {
        CallHandler.instance.hangupOrReject(CallHandler.instance.roomIdForCall(this.props.call));
    };

    private onToggleSidebar = (): void => {
        this.setState({ sidebarShown: !this.state.sidebarShown });
    };

    private renderCallControls(): JSX.Element {
        const { call, pipMode } = this.props;
        const { callState, micMuted, vidMuted, screensharing, sidebarShown, secondaryFeed, sidebarFeeds } = this.state;

        // If SDPStreamMetadata isn't supported don't show video mute button in voice calls
        const vidMuteButtonShown = call.opponentSupportsSDPStreamMetadata() || call.hasLocalUserMediaVideoTrack;
        // Screensharing is possible, if we can send a second stream and
        // identify it using SDPStreamMetadata or if we can replace the already
        // existing usermedia track by a screensharing track. We also need to be
        // connected to know the state of the other side
        const screensharingButtonShown = (
            (call.opponentSupportsSDPStreamMetadata() || call.hasLocalUserMediaVideoTrack) &&
            call.state === CallState.Connected
        );
        // Show the sidebar button only if there is something to hide/show
        const sidebarButtonShown = (secondaryFeed && !secondaryFeed.isVideoMuted()) || sidebarFeeds.length > 0;
        // The dial pad & 'more' button actions are only relevant in a connected call
        const contextMenuButtonShown = callState === CallState.Connected;
        const dialpadButtonShown = (
            callState === CallState.Connected &&
            call.opponentSupportsDTMF()
        );

        return (
            <CallViewButtons
                ref={this.buttonsRef}
                call={call}
                pipMode={pipMode}
                handlers={{
                    onToggleSidebarClick: this.onToggleSidebar,
                    onScreenshareClick: this.onScreenshareClick,
                    onHangupClick: this.onHangupClick,
                    onMicMuteClick: this.onMicMuteClick,
                    onVidMuteClick: this.onVidMuteClick,
                }}
                buttonsState={{
                    micMuted: micMuted,
                    vidMuted: vidMuted,
                    sidebarShown: sidebarShown,
                    screensharing: screensharing,
                }}
                buttonsVisibility={{
                    vidMute: vidMuteButtonShown,
                    screensharing: screensharingButtonShown,
                    sidebar: sidebarButtonShown,
                    contextMenu: contextMenuButtonShown,
                    dialpad: dialpadButtonShown,
                }}
            />
        );
    }

    private renderToast(): JSX.Element {
        const { call } = this.props;
        const someoneIsScreensharing = call.getFeeds().some((feed) => {
            return feed.purpose === SDPStreamMetadataPurpose.Screenshare;
        });

        if (!someoneIsScreensharing) return null;

        const isScreensharing = call.isScreensharing();
        const { primaryFeed, sidebarShown } = this.state;
        const sharerName = primaryFeed?.getMember().name;
        if (!sharerName) return;

        let text = isScreensharing
            ? _t("You are presenting")
            : _t('%(sharerName)s is presenting', { sharerName });
        if (!sidebarShown) {
            text += " • " + (call.isLocalVideoMuted()
                ? _t("Your camera is turned off")
                : _t("Your camera is still enabled"));
        }

        return (
            <div className="mx_CallView_toast">
                { text }
            </div>
        );
    }

    private renderContent(): JSX.Element {
        const { pipMode, call, onResize } = this.props;
        const { isLocalOnHold, isRemoteOnHold, sidebarShown, primaryFeed, secondaryFeed, sidebarFeeds } = this.state;

        const callRoom = MatrixClientPeg.get().getRoom(call.roomId);
        const avatarSize = pipMode ? 76 : 160;
        const transfereeCall = CallHandler.instance.getTransfereeForCallId(call.callId);
        const isOnHold = isLocalOnHold || isRemoteOnHold;

        let secondaryFeedElement: React.ReactNode;
        if (sidebarShown && secondaryFeed && !secondaryFeed.isVideoMuted()) {
            secondaryFeedElement = (
                <VideoFeed
                    feed={secondaryFeed}
                    call={call}
                    pipMode={pipMode}
                    onResize={onResize}
                    secondary={true}
                />
            );
        }

        if (transfereeCall || isOnHold) {
            const containerClasses = classNames("mx_CallView_content", {
                mx_CallView_content_hold: isOnHold,
            });
            const backgroundAvatarUrl = avatarUrlForMember(call.getOpponentMember(), 1024, 1024, 'crop');

            let holdTransferContent: React.ReactNode;
            if (transfereeCall) {
                const transferTargetRoom = MatrixClientPeg.get().getRoom(
                    CallHandler.instance.roomIdForCall(call),
                );
                const transferTargetName = transferTargetRoom ? transferTargetRoom.name : _t("unknown person");
                const transfereeRoom = MatrixClientPeg.get().getRoom(
                    CallHandler.instance.roomIdForCall(transfereeCall),
                );
                const transfereeName = transfereeRoom ? transfereeRoom.name : _t("unknown person");

                holdTransferContent = <div className="mx_CallView_status">
                    { _t(
                        "Consulting with %(transferTarget)s. <a>Transfer to %(transferee)s</a>",
                        {
                            transferTarget: transferTargetName,
                            transferee: transfereeName,
                        },
                        {
                            a: sub => <AccessibleButton kind="link" onClick={this.onTransferClick}>
                                { sub }
                            </AccessibleButton>,
                        },
                    ) }
                </div>;
            } else {
                let onHoldText: React.ReactNode;
                if (isRemoteOnHold) {
                    onHoldText = _t(
                        CallHandler.instance.hasAnyUnheldCall()
                            ? _td("You held the call <a>Switch</a>")
                            : _td("You held the call <a>Resume</a>"),
                        {},
                        {
                            a: sub => <AccessibleButton kind="link" onClick={this.onCallResumeClick}>
                                { sub }
                            </AccessibleButton>,
                        },
                    );
                } else if (isLocalOnHold) {
                    onHoldText = _t("%(peerName)s held the call", {
                        peerName: call.getOpponentMember().name,
                    });
                }

                holdTransferContent = (
                    <div className="mx_CallView_status">
                        { onHoldText }
                    </div>
                );
            }

            return (
                <div className={containerClasses} onMouseMove={this.onMouseMove}>
                    <div className="mx_CallView_holdBackground" style={{ backgroundImage: 'url(' + backgroundAvatarUrl + ')' }} />
                    { holdTransferContent }
                </div>
            );
        } else if (call.noIncomingFeeds()) {
            return (
                <div className="mx_CallView_content" onMouseMove={this.onMouseMove}>
                    <div className="mx_CallView_avatarsContainer">
                        <div
                            className="mx_CallView_avatarContainer"
                            style={{ width: avatarSize, height: avatarSize }}
                        >
                            <RoomAvatar
                                room={callRoom}
                                height={avatarSize}
                                width={avatarSize}
                            />
                        </div>
                    </div>
                    <div className="mx_CallView_status">{ _t("Connecting") }</div>
                    { secondaryFeedElement }
                </div>
            );
        } else if (pipMode) {
            return (
                <div
                    className="mx_CallView_content"
                    onMouseMove={this.onMouseMove}
                >
                    <VideoFeed
                        feed={primaryFeed}
                        call={call}
                        pipMode={pipMode}
                        onResize={onResize}
                        primary={true}
                    />
                </div>
            );
        } else if (secondaryFeed) {
            return (
                <div className="mx_CallView_content" onMouseMove={this.onMouseMove}>
                    <VideoFeed
                        feed={primaryFeed}
                        call={call}
                        pipMode={pipMode}
                        onResize={onResize}
                        primary={true}
                    />
                    { secondaryFeedElement }
                </div>
            );
        } else {
            return (
                <div className="mx_CallView_content" onMouseMove={this.onMouseMove}>
                    <VideoFeed
                        feed={primaryFeed}
                        call={call}
                        pipMode={pipMode}
                        onResize={onResize}
                        primary={true}
                    />
                    { sidebarShown && <CallViewSidebar
                        feeds={sidebarFeeds}
                        call={call}
                        pipMode={pipMode}
                    /> }
                </div>
            );
        }
    }

    public render(): JSX.Element {
        const {
            call,
            secondaryCall,
            pipMode,
            showApps,
            onMouseDownOnHeader,
        } = this.props;
        const {
            sidebarShown,
            sidebarFeeds,
        } = this.state;

        const client = MatrixClientPeg.get();
        const callRoomId = CallHandler.instance.roomIdForCall(call);
        const secondaryCallRoomId = CallHandler.instance.roomIdForCall(secondaryCall);
        const callRoom = client.getRoom(callRoomId);
        const secCallRoom = secondaryCall ? client.getRoom(secondaryCallRoomId) : null;

        const callViewClasses = classNames({
            mx_CallView: true,
            mx_CallView_pip: pipMode,
            mx_CallView_large: !pipMode,
            mx_CallView_sidebar: sidebarShown && sidebarFeeds.length !== 0 && !pipMode,
            mx_CallView_belowWidget: showApps, // css to correct the margins if the call is below the AppsDrawer.
        });

        return <div className={callViewClasses}>
            <CallViewHeader
                onPipMouseDown={onMouseDownOnHeader}
                pipMode={pipMode}
                callRooms={[callRoom, secCallRoom]}
                onMaximize={this.onMaximizeClick}
            />
            <div className="mx_CallView_content_wrapper" ref={this.contentWrapperRef}>
                { this.renderToast() }
                { this.renderContent() }
                { this.renderCallControls() }
            </div>
        </div>;
    }
}
