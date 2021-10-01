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

import React, { createRef } from "react";
import classNames from "classnames";
import AccessibleTooltipButton from "../../elements/AccessibleTooltipButton";
import CallContextMenu from "../../context_menus/CallContextMenu";
import DialpadContextMenu from "../../context_menus/DialpadContextMenu";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { Alignment } from "../../elements/Tooltip";
import {
    alwaysAboveLeftOf,
    alwaysAboveRightOf,
    ChevronFace,
    ContextMenuTooltipButton,
} from '../../../structures/ContextMenu';
import { _t } from "../../../../languageHandler";

// Height of the header duplicated from CSS because we need to subtract it from our max
// height to get the max height of the video
const CONTEXT_MENU_VPADDING = 8; // How far the context menu sits above the button (px)

const TOOLTIP_Y_OFFSET = -24;

const CONTROLS_HIDE_DELAY = 2000;

interface IProps {
    call: MatrixCall;
    pipMode: boolean;
    handlers: {
        onHangupClick: () => void;
        onScreenshareClick: () => void;
        onToggleSidebarClick: () => void;
        onMicMuteClick: () => void;
        onVidMuteClick: () => void;
    };
    buttonsState: {
        micMuted: boolean;
        vidMuted: boolean;
        sidebarShown: boolean;
        screensharing: boolean;
    };
    buttonsVisibility: {
        screensharing: boolean;
        vidMute: boolean;
        sidebar: boolean;
        dialpad: boolean;
        contextMenu: boolean;
    };
}

interface IState {
    visible: boolean;
    showDialpad: boolean;
    hoveringControls: boolean;
    showMoreMenu: boolean;
}

export default class CallViewButtons extends React.Component<IProps, IState> {
    private dialpadButton = createRef<HTMLDivElement>();
    private contextMenuButton = createRef<HTMLDivElement>();
    private controlsHideTimer: number = null;

    constructor(props: IProps) {
        super(props);

        this.state = {
            showDialpad: false,
            hoveringControls: false,
            showMoreMenu: false,
            visible: true,
        };
    }

    public componentDidMount(): void {
        this.showControls();
    }

    public showControls(): void {
        if (this.state.showMoreMenu || this.state.showDialpad) return;

        if (!this.state.visible) {
            this.setState({
                visible: true,
            });
        }
        if (this.controlsHideTimer !== null) {
            clearTimeout(this.controlsHideTimer);
        }
        this.controlsHideTimer = window.setTimeout(this.onControlsHideTimer, CONTROLS_HIDE_DELAY);
    }

    private onControlsHideTimer = (): void => {
        if (this.state.hoveringControls || this.state.showDialpad || this.state.showMoreMenu) return;
        this.controlsHideTimer = null;
        this.setState({ visible: false });
    };

    private onMouseEnter = (): void => {
        this.setState({ hoveringControls: true });
    };

    private onMouseLeave = (): void => {
        this.setState({ hoveringControls: false });
    };

    private onDialpadClick = (): void => {
        if (!this.state.showDialpad) {
            this.setState({ showDialpad: true });
            this.showControls();
        } else {
            this.setState({ showDialpad: false });
        }
    };

    private onMoreClick = (): void => {
        this.setState({ showMoreMenu: true });
        this.showControls();
    };

    private closeDialpad = (): void => {
        this.setState({ showDialpad: false });
    };

    private closeContextMenu = (): void => {
        this.setState({ showMoreMenu: false });
    };

    public render(): JSX.Element {
        const micClasses = classNames("mx_CallViewButtons_button", {
            mx_CallViewButtons_button_micOn: !this.props.buttonsState.micMuted,
            mx_CallViewButtons_button_micOff: this.props.buttonsState.micMuted,
        });

        const vidClasses = classNames("mx_CallViewButtons_button", {
            mx_CallViewButtons_button_vidOn: !this.props.buttonsState.vidMuted,
            mx_CallViewButtons_button_vidOff: this.props.buttonsState.vidMuted,
        });

        const screensharingClasses = classNames("mx_CallViewButtons_button", {
            mx_CallViewButtons_button_screensharingOn: this.props.buttonsState.screensharing,
            mx_CallViewButtons_button_screensharingOff: !this.props.buttonsState.screensharing,
        });

        const sidebarButtonClasses = classNames("mx_CallViewButtons_button", {
            mx_CallViewButtons_button_sidebarOn: this.props.buttonsState.sidebarShown,
            mx_CallViewButtons_button_sidebarOff: !this.props.buttonsState.sidebarShown,
        });

        // Put the other states of the mic/video icons in the document to make sure they're cached
        // (otherwise the icon disappears briefly when toggled)
        const micCacheClasses = classNames("mx_CallViewButtons_button", "mx_CallViewButtons_button_invisible", {
            mx_CallViewButtons_button_micOn: this.props.buttonsState.micMuted,
            mx_CallViewButtons_button_micOff: !this.props.buttonsState.micMuted,
        });

        const vidCacheClasses = classNames("mx_CallViewButtons_button", "mx_CallViewButtons_button_invisible", {
            mx_CallViewButtons_button_vidOn: this.props.buttonsState.micMuted,
            mx_CallViewButtons_button_vidOff: !this.props.buttonsState.micMuted,
        });

        const callControlsClasses = classNames("mx_CallViewButtons", {
            mx_CallViewButtons_hidden: !this.state.visible,
        });

        let vidMuteButton;
        if (this.props.buttonsVisibility.vidMute) {
            vidMuteButton = (
                <AccessibleTooltipButton
                    className={vidClasses}
                    onClick={this.props.handlers.onVidMuteClick}
                    title={this.props.buttonsState.vidMuted ? _t("Start the camera") : _t("Stop the camera")}
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
            );
        }

        let screensharingButton;
        if (this.props.buttonsVisibility.screensharing) {
            screensharingButton = (
                <AccessibleTooltipButton
                    className={screensharingClasses}
                    onClick={this.props.handlers.onScreenshareClick}
                    title={this.props.buttonsState.screensharing
                        ? _t("Stop sharing your screen")
                        : _t("Start sharing your screen")
                    }
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
            );
        }

        let sidebarButton;
        if (this.props.buttonsVisibility.sidebar) {
            sidebarButton = (
                <AccessibleTooltipButton
                    className={sidebarButtonClasses}
                    onClick={this.props.handlers.onToggleSidebarClick}
                    title={this.props.buttonsState.sidebarShown ? _t("Hide sidebar") : _t("Show sidebar")}
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
            );
        }

        let contextMenuButton;
        if (this.props.buttonsVisibility.contextMenu) {
            contextMenuButton = (
                <ContextMenuTooltipButton
                    className="mx_CallViewButtons_button mx_CallViewButtons_button_more"
                    onClick={this.onMoreClick}
                    inputRef={this.contextMenuButton}
                    isExpanded={this.state.showMoreMenu}
                    title={_t("More")}
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
            );
        }
        let dialpadButton;
        if (this.props.buttonsVisibility.dialpad) {
            dialpadButton = (
                <ContextMenuTooltipButton
                    className="mx_CallViewButtons_button mx_CallViewButtons_dialpad"
                    inputRef={this.dialpadButton}
                    onClick={this.onDialpadClick}
                    isExpanded={this.state.showDialpad}
                    title={_t("Dialpad")}
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
            );
        }

        let dialPad;
        if (this.state.showDialpad) {
            dialPad = <DialpadContextMenu
                {...alwaysAboveRightOf(
                    this.dialpadButton.current.getBoundingClientRect(),
                    ChevronFace.None,
                    CONTEXT_MENU_VPADDING,
                )}
                // We mount the context menus as a as a child typically in order to include the
                // context menus when fullscreening the call content.
                // However, this does not work as well when the call is embedded in a
                // picture-in-picture frame. Thus, only mount as child when we are *not* in PiP.
                mountAsChild={!this.props.pipMode}
                onFinished={this.closeDialpad}
                call={this.props.call}
            />;
        }

        let contextMenu;
        if (this.state.showMoreMenu) {
            contextMenu = <CallContextMenu
                {...alwaysAboveLeftOf(
                    this.contextMenuButton.current.getBoundingClientRect(),
                    ChevronFace.None,
                    CONTEXT_MENU_VPADDING,
                )}
                mountAsChild={!this.props.pipMode}
                onFinished={this.closeContextMenu}
                call={this.props.call}
            />;
        }

        return (
            <div
                className={callControlsClasses}
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
            >
                { dialPad }
                { contextMenu }
                { dialpadButton }
                <AccessibleTooltipButton
                    className={micClasses}
                    onClick={this.props.handlers.onMicMuteClick}
                    title={this.props.buttonsState.micMuted ? _t("Unmute the microphone") : _t("Mute the microphone")}
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
                { vidMuteButton }
                <div className={micCacheClasses} />
                <div className={vidCacheClasses} />
                { screensharingButton }
                { sidebarButton }
                { contextMenuButton }
                <AccessibleTooltipButton
                    className="mx_CallViewButtons_button mx_CallViewButtons_button_hangup"
                    onClick={this.props.handlers.onHangupClick}
                    title={_t("Hangup")}
                    alignment={Alignment.Top}
                    yOffset={TOOLTIP_Y_OFFSET}
                />
            </div>
        );
    }
}
