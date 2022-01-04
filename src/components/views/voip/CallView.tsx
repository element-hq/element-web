/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React, { createRef, CSSProperties } from 'react';
import { CallEvent, CallState, CallType, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
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
import { isOnlyCtrlOrCmdKeyEvent, Key } from '../../../Keyboard';
import { avatarUrlForMember } from '../../../Avatar';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import DesktopCapturerSourcePicker from "../elements/DesktopCapturerSourcePicker";
import Modal from '../../../Modal';
import CallViewSidebar from './CallViewSidebar';
import CallViewHeader from './CallView/CallViewHeader';
import CallViewButtons from "./CallView/CallViewButtons";

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
    primaryFeed: CallFeed;
    secondaryFeeds: Array<CallFeed>;
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

@replaceableComponent("views.voip.CallView")
export default class CallView extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private contentRef = createRef<HTMLDivElement>();
    private buttonsRef = createRef<CallViewButtons>();

    constructor(props: IProps) {
        super(props);

        const { primary, secondary } = CallView.getOrderedFeeds(this.props.call.getFeeds());

        this.state = {
            isLocalOnHold: this.props.call.isLocalOnHold(),
            isRemoteOnHold: this.props.call.isRemoteOnHold(),
            micMuted: this.props.call.isMicrophoneMuted(),
            vidMuted: this.props.call.isLocalVideoMuted(),
            screensharing: this.props.call.isScreensharing(),
            callState: this.props.call.state,
            primaryFeed: primary,
            secondaryFeeds: secondary,
            sidebarShown: true,
        };

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

    static getDerivedStateFromProps(props: IProps): Partial<IState> {
        const { primary, secondary } = CallView.getOrderedFeeds(props.call.getFeeds());

        return {
            primaryFeed: primary,
            secondaryFeeds: secondary,
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
            oldCall.removeListener(CallEvent.FeedsChanged, this.onFeedsChanged);
        }
        if (newCall) {
            newCall.on(CallEvent.State, this.onCallState);
            newCall.on(CallEvent.LocalHoldUnhold, this.onCallLocalHoldUnhold);
            newCall.on(CallEvent.RemoteHoldUnhold, this.onCallRemoteHoldUnhold);
            newCall.on(CallEvent.FeedsChanged, this.onFeedsChanged);
        }
    }

    private onCallState = (state) => {
        this.setState({
            callState: state,
        });
    };

    private onFeedsChanged = (newFeeds: Array<CallFeed>) => {
        const { primary, secondary } = CallView.getOrderedFeeds(newFeeds);
        this.setState({
            primaryFeed: primary,
            secondaryFeeds: secondary,
            micMuted: this.props.call.isMicrophoneMuted(),
            vidMuted: this.props.call.isLocalVideoMuted(),
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

    private onMouseMove = () => {
        this.buttonsRef.current?.showControls();
    };

    static getOrderedFeeds(feeds: Array<CallFeed>): { primary: CallFeed, secondary: Array<CallFeed> } {
        let primary;

        // Try to use a screensharing as primary, a remote one if possible
        const screensharingFeeds = feeds.filter((feed) => feed.purpose === SDPStreamMetadataPurpose.Screenshare);
        primary = screensharingFeeds.find((feed) => !feed.isLocal()) || screensharingFeeds[0];
        // If we didn't find remote screen-sharing stream, try to find any remote stream
        if (!primary) {
            primary = feeds.find((feed) => !feed.isLocal());
        }

        const secondary = [...feeds];
        // Remove the primary feed from the array
        if (primary) secondary.splice(secondary.indexOf(primary), 1);
        secondary.sort((a, b) => {
            if (a.isLocal() && !b.isLocal()) return -1;
            if (!a.isLocal() && b.isLocal()) return 1;
            return 0;
        });

        return { primary, secondary };
    }

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
            if (window.electron?.getDesktopCapturerSources) {
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
        const ctrlCmdOnly = isOnlyCtrlOrCmdKeyEvent(ev);

        switch (ev.key) {
            case Key.D:
                if (ctrlCmdOnly) {
                    this.onMicMuteClick();
                    // show the controls to give feedback
                    this.buttonsRef.current?.showControls();
                    handled = true;
                }
                break;

            case Key.E:
                if (ctrlCmdOnly) {
                    this.onVidMuteClick();
                    // show the controls to give feedback
                    this.buttonsRef.current?.showControls();
                    handled = true;
                }
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
        // We don't support call upgrades (yet) so hide the video mute button in voice calls
        const vidMuteButtonShown = this.props.call.type === CallType.Video;
        // Screensharing is possible, if we can send a second stream and
        // identify it using SDPStreamMetadata or if we can replace the already
        // existing usermedia track by a screensharing track. We also need to be
        // connected to know the state of the other side
        const screensharingButtonShown = (
            (this.props.call.opponentSupportsSDPStreamMetadata() || this.props.call.type === CallType.Video) &&
            this.props.call.state === CallState.Connected
        );
        // To show the sidebar we need secondary feeds, if we don't have them,
        // we can hide this button. If we are in PiP, sidebar is also hidden, so
        // we can hide the button too
        const sidebarButtonShown = (
            this.state.primaryFeed?.purpose === SDPStreamMetadataPurpose.Screenshare ||
            this.props.call.isScreensharing()
        );
        // The dial pad & 'more' button actions are only relevant in a connected call
        const contextMenuButtonShown = this.state.callState === CallState.Connected;
        const dialpadButtonShown = (
            this.state.callState === CallState.Connected &&
            this.props.call.opponentSupportsDTMF()
        );

        return (
            <CallViewButtons
                ref={this.buttonsRef}
                call={this.props.call}
                pipMode={this.props.pipMode}
                handlers={{
                    onToggleSidebarClick: this.onToggleSidebar,
                    onScreenshareClick: this.onScreenshareClick,
                    onHangupClick: this.onHangupClick,
                    onMicMuteClick: this.onMicMuteClick,
                    onVidMuteClick: this.onVidMuteClick,
                }}
                buttonsState={{
                    micMuted: this.state.micMuted,
                    vidMuted: this.state.vidMuted,
                    sidebarShown: this.state.sidebarShown,
                    screensharing: this.state.screensharing,
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

    public render() {
        const client = MatrixClientPeg.get();
        const callRoomId = CallHandler.instance.roomIdForCall(this.props.call);
        const secondaryCallRoomId = CallHandler.instance.roomIdForCall(this.props.secondaryCall);
        const callRoom = client.getRoom(callRoomId);
        const secCallRoom = this.props.secondaryCall ? client.getRoom(secondaryCallRoomId) : null;
        const avatarSize = this.props.pipMode ? 76 : 160;
        const transfereeCall = CallHandler.instance.getTransfereeForCallId(this.props.call.callId);
        const isOnHold = this.state.isLocalOnHold || this.state.isRemoteOnHold;
        const isScreensharing = this.props.call.isScreensharing();
        const sidebarShown = this.state.sidebarShown;
        const someoneIsScreensharing = this.props.call.getFeeds().some((feed) => {
            return feed.purpose === SDPStreamMetadataPurpose.Screenshare;
        });
        const isVideoCall = this.props.call.type === CallType.Video;

        let contentView: React.ReactNode;
        let holdTransferContent;

        if (transfereeCall) {
            const transferTargetRoom = MatrixClientPeg.get().getRoom(
                CallHandler.instance.roomIdForCall(this.props.call),
            );
            const transferTargetName = transferTargetRoom ? transferTargetRoom.name : _t("unknown person");

            const transfereeRoom = MatrixClientPeg.get().getRoom(
                CallHandler.instance.roomIdForCall(transfereeCall),
            );
            const transfereeName = transfereeRoom ? transfereeRoom.name : _t("unknown person");

            holdTransferContent = <div className="mx_CallView_holdTransferContent">
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
        } else if (isOnHold) {
            let onHoldText = null;
            if (this.state.isRemoteOnHold) {
                const holdString = CallHandler.instance.hasAnyUnheldCall() ?
                    _td("You held the call <a>Switch</a>") : _td("You held the call <a>Resume</a>");
                onHoldText = _t(holdString, {}, {
                    a: sub => <AccessibleButton kind="link" onClick={this.onCallResumeClick}>
                        { sub }
                    </AccessibleButton>,
                });
            } else if (this.state.isLocalOnHold) {
                onHoldText = _t("%(peerName)s held the call", {
                    peerName: this.props.call.getOpponentMember().name,
                });
            }
            holdTransferContent = <div className="mx_CallView_holdTransferContent">
                { onHoldText }
            </div>;
        }

        let sidebar;
        if (
            !isOnHold &&
            !transfereeCall &&
            sidebarShown &&
            (isVideoCall || someoneIsScreensharing)
        ) {
            sidebar = (
                <CallViewSidebar
                    feeds={this.state.secondaryFeeds}
                    call={this.props.call}
                    pipMode={this.props.pipMode}
                />
            );
        }

        // This is a bit messy. I can't see a reason to have two onHold/transfer screens
        if (isOnHold || transfereeCall) {
            if (isVideoCall) {
                const containerClasses = classNames({
                    mx_CallView_content: true,
                    mx_CallView_video: true,
                    mx_CallView_video_hold: isOnHold,
                });
                let onHoldBackground = null;
                const backgroundStyle: CSSProperties = {};
                const backgroundAvatarUrl = avatarUrlForMember(
                    // is it worth getting the size of the div to pass here?
                    this.props.call.getOpponentMember(), 1024, 1024, 'crop',
                );
                backgroundStyle.backgroundImage = 'url(' + backgroundAvatarUrl + ')';
                onHoldBackground = <div className="mx_CallView_video_holdBackground" style={backgroundStyle} />;

                contentView = (
                    <div className={containerClasses} ref={this.contentRef} onMouseMove={this.onMouseMove}>
                        { onHoldBackground }
                        { holdTransferContent }
                        { this.renderCallControls() }
                    </div>
                );
            } else {
                const classes = classNames({
                    mx_CallView_content: true,
                    mx_CallView_voice: true,
                    mx_CallView_voice_hold: isOnHold,
                });

                contentView = (
                    <div className={classes} onMouseMove={this.onMouseMove}>
                        <div className="mx_CallView_voice_avatarsContainer">
                            <div
                                className="mx_CallView_voice_avatarContainer"
                                style={{ width: avatarSize, height: avatarSize }}
                            >
                                <RoomAvatar
                                    room={callRoom}
                                    height={avatarSize}
                                    width={avatarSize}
                                />
                            </div>
                        </div>
                        { holdTransferContent }
                        { this.renderCallControls() }
                    </div>
                );
            }
        } else if (this.props.call.noIncomingFeeds()) {
            // Here we're reusing the css classes from voice on hold, because
            // I am lazy. If this gets merged, the CallView might be subject
            // to change anyway - I might take an axe to this file in order to
            // try to get other things working
            const classes = classNames({
                mx_CallView_content: true,
                mx_CallView_voice: true,
            });

            // Saying "Connecting" here isn't really true, but the best thing
            // I can come up with, but this might be subject to change as well
            contentView = (
                <div
                    className={classes}
                    onMouseMove={this.onMouseMove}
                    ref={this.contentRef}
                >
                    { sidebar }
                    <div className="mx_CallView_voice_avatarsContainer">
                        <div
                            className="mx_CallView_voice_avatarContainer"
                            style={{ width: avatarSize, height: avatarSize }}
                        >
                            <RoomAvatar
                                room={callRoom}
                                height={avatarSize}
                                width={avatarSize}
                            />
                        </div>
                    </div>
                    <div className="mx_CallView_holdTransferContent">{ _t("Connecting") }</div>
                    { this.renderCallControls() }
                </div>
            );
        } else {
            const containerClasses = classNames({
                mx_CallView_content: true,
                mx_CallView_video: true,
            });

            let toast;
            if (someoneIsScreensharing) {
                const sharerName = this.state.primaryFeed.getMember().name;
                let text = isScreensharing
                    ? _t("You are presenting")
                    : _t('%(sharerName)s is presenting', { sharerName });
                if (!this.state.sidebarShown && isVideoCall) {
                    text += " • " + (this.props.call.isLocalVideoMuted()
                        ? _t("Your camera is turned off")
                        : _t("Your camera is still enabled"));
                }

                toast = (
                    <div className="mx_CallView_presenting">
                        { text }
                    </div>
                );
            }

            contentView = (
                <div
                    className={containerClasses}
                    ref={this.contentRef}
                    onMouseMove={this.onMouseMove}
                >
                    { toast }
                    { sidebar }
                    <VideoFeed
                        feed={this.state.primaryFeed}
                        call={this.props.call}
                        pipMode={this.props.pipMode}
                        onResize={this.props.onResize}
                        primary={true}
                    />
                    { this.renderCallControls() }
                </div>
            );
        }

        const callViewClasses = classNames({
            mx_CallView: true,
            mx_CallView_pip: this.props.pipMode,
            mx_CallView_large: !this.props.pipMode,
            mx_CallView_belowWidget: this.props.showApps, // css to correct the margins if the call is below the AppsDrawer.
        });

        return <div className={callViewClasses}>
            <CallViewHeader
                onPipMouseDown={this.props.onMouseDownOnHeader}
                pipMode={this.props.pipMode}
                type={this.props.call.type}
                callRooms={[callRoom, secCallRoom]}
            />
            { contentView }
        </div>;
    }
}
