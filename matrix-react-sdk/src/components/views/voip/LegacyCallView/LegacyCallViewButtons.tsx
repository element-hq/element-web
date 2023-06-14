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

import React, { createRef, useState } from "react";
import classNames from "classnames";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import AccessibleTooltipButton from "../../elements/AccessibleTooltipButton";
import LegacyCallContextMenu from "../../context_menus/LegacyCallContextMenu";
import DialpadContextMenu from "../../context_menus/DialpadContextMenu";
import { Alignment } from "../../elements/Tooltip";
import {
    alwaysMenuProps,
    alwaysAboveRightOf,
    ChevronFace,
    ContextMenuTooltipButton,
    useContextMenu,
} from "../../../structures/ContextMenu";
import { _t } from "../../../../languageHandler";
import DeviceContextMenu from "../../context_menus/DeviceContextMenu";
import { MediaDeviceKindEnum } from "../../../../MediaDeviceHandler";
import { ButtonEvent } from "../../elements/AccessibleButton";

// Height of the header duplicated from CSS because we need to subtract it from our max
// height to get the max height of the video
const CONTEXT_MENU_VPADDING = 8; // How far the context menu sits above the button (px)

const CONTROLS_HIDE_DELAY = 2000;

interface IButtonProps extends Omit<React.ComponentProps<typeof AccessibleTooltipButton>, "title"> {
    state: boolean;
    className: string;
    onLabel?: string;
    offLabel?: string;
}

const LegacyCallViewToggleButton: React.FC<IButtonProps> = ({
    children,
    state: isOn,
    className,
    onLabel,
    offLabel,
    ...props
}) => {
    const classes = classNames("mx_LegacyCallViewButtons_button", className, {
        mx_LegacyCallViewButtons_button_on: isOn,
        mx_LegacyCallViewButtons_button_off: !isOn,
    });

    return (
        <AccessibleTooltipButton
            className={classes}
            title={isOn ? onLabel : offLabel}
            alignment={Alignment.Top}
            {...props}
        >
            {children}
        </AccessibleTooltipButton>
    );
};

interface IDropdownButtonProps extends IButtonProps {
    deviceKinds: MediaDeviceKindEnum[];
}

const LegacyCallViewDropdownButton: React.FC<IDropdownButtonProps> = ({ state, deviceKinds, ...props }) => {
    const [menuDisplayed, buttonRef, openMenu, closeMenu] = useContextMenu();
    const [hoveringDropdown, setHoveringDropdown] = useState(false);

    const classes = classNames("mx_LegacyCallViewButtons_button", "mx_LegacyCallViewButtons_dropdownButton", {
        mx_LegacyCallViewButtons_dropdownButton_collapsed: !menuDisplayed,
    });

    const onClick = (event: ButtonEvent): void => {
        event.stopPropagation();
        openMenu();
    };

    return (
        <LegacyCallViewToggleButton
            inputRef={buttonRef}
            forceHide={menuDisplayed || hoveringDropdown}
            state={state}
            {...props}
        >
            <LegacyCallViewToggleButton
                className={classes}
                onClick={onClick}
                onHover={(hovering) => setHoveringDropdown(hovering)}
                state={state}
            />
            {menuDisplayed && buttonRef.current && (
                <DeviceContextMenu
                    {...alwaysAboveRightOf(buttonRef.current.getBoundingClientRect())}
                    onFinished={closeMenu}
                    deviceKinds={deviceKinds}
                />
            )}
        </LegacyCallViewToggleButton>
    );
};

interface IProps {
    call: MatrixCall;
    pipMode?: boolean;
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

export default class LegacyCallViewButtons extends React.Component<IProps, IState> {
    private dialpadButton = createRef<HTMLDivElement>();
    private contextMenuButton = createRef<HTMLDivElement>();
    private controlsHideTimer: number | null = null;

    public constructor(props: IProps) {
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

    public render(): React.ReactNode {
        const callControlsClasses = classNames("mx_LegacyCallViewButtons", {
            mx_LegacyCallViewButtons_hidden: !this.state.visible,
        });

        let dialPad;
        if (this.state.showDialpad && this.dialpadButton.current) {
            dialPad = (
                <DialpadContextMenu
                    {...alwaysMenuProps(
                        this.dialpadButton.current.getBoundingClientRect(),
                        ChevronFace.None,
                        CONTEXT_MENU_VPADDING,
                    )}
                    // We mount the context menus as a child typically in order to include the
                    // context menus when fullscreening the call content.
                    // However, this does not work as well when the call is embedded in a
                    // picture-in-picture frame. Thus, only mount as child when we are *not* in PiP.
                    mountAsChild={!this.props.pipMode}
                    onFinished={this.closeDialpad}
                    call={this.props.call}
                />
            );
        }

        let contextMenu;
        if (this.state.showMoreMenu && this.contextMenuButton.current) {
            contextMenu = (
                <LegacyCallContextMenu
                    {...alwaysMenuProps(
                        this.contextMenuButton.current.getBoundingClientRect(),
                        ChevronFace.None,
                        CONTEXT_MENU_VPADDING,
                    )}
                    mountAsChild={!this.props.pipMode}
                    onFinished={this.closeContextMenu}
                    call={this.props.call}
                />
            );
        }

        return (
            <div className={callControlsClasses} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                {dialPad}
                {contextMenu}

                {this.props.buttonsVisibility.dialpad && (
                    <ContextMenuTooltipButton
                        className="mx_LegacyCallViewButtons_button mx_LegacyCallViewButtons_dialpad"
                        inputRef={this.dialpadButton}
                        onClick={this.onDialpadClick}
                        isExpanded={this.state.showDialpad}
                        title={_t("Dialpad")}
                        alignment={Alignment.Top}
                    />
                )}
                <LegacyCallViewDropdownButton
                    state={!this.props.buttonsState.micMuted}
                    className="mx_LegacyCallViewButtons_button_mic"
                    onLabel={_t("Mute the microphone")}
                    offLabel={_t("Unmute the microphone")}
                    onClick={this.props.handlers.onMicMuteClick}
                    deviceKinds={[MediaDeviceKindEnum.AudioInput, MediaDeviceKindEnum.AudioOutput]}
                />
                {this.props.buttonsVisibility.vidMute && (
                    <LegacyCallViewDropdownButton
                        state={!this.props.buttonsState.vidMuted}
                        className="mx_LegacyCallViewButtons_button_vid"
                        onLabel={_t("Stop the camera")}
                        offLabel={_t("Start the camera")}
                        onClick={this.props.handlers.onVidMuteClick}
                        deviceKinds={[MediaDeviceKindEnum.VideoInput]}
                    />
                )}
                {this.props.buttonsVisibility.screensharing && (
                    <LegacyCallViewToggleButton
                        state={this.props.buttonsState.screensharing}
                        className="mx_LegacyCallViewButtons_button_screensharing"
                        onLabel={_t("Stop sharing your screen")}
                        offLabel={_t("Start sharing your screen")}
                        onClick={this.props.handlers.onScreenshareClick}
                    />
                )}
                {this.props.buttonsVisibility.sidebar && (
                    <LegacyCallViewToggleButton
                        state={this.props.buttonsState.sidebarShown}
                        className="mx_LegacyCallViewButtons_button_sidebar"
                        onLabel={_t("Hide sidebar")}
                        offLabel={_t("Show sidebar")}
                        onClick={this.props.handlers.onToggleSidebarClick}
                    />
                )}
                {this.props.buttonsVisibility.contextMenu && (
                    <ContextMenuTooltipButton
                        className="mx_LegacyCallViewButtons_button mx_LegacyCallViewButtons_button_more"
                        onClick={this.onMoreClick}
                        inputRef={this.contextMenuButton}
                        isExpanded={this.state.showMoreMenu}
                        title={_t("More")}
                        alignment={Alignment.Top}
                    />
                )}
                <AccessibleTooltipButton
                    className="mx_LegacyCallViewButtons_button mx_LegacyCallViewButtons_button_hangup"
                    onClick={this.props.handlers.onHangupClick}
                    title={_t("Hangup")}
                    alignment={Alignment.Top}
                />
            </div>
        );
    }
}
