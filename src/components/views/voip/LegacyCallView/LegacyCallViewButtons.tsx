/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, useState, forwardRef } from "react";
import classNames from "classnames";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import LegacyCallContextMenu from "../../context_menus/LegacyCallContextMenu";
import DialpadContextMenu from "../../context_menus/DialpadContextMenu";
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
import AccessibleButton, {
    type ButtonEvent,
    type ButtonProps as AccessibleButtonProps,
} from "../../elements/AccessibleButton";

// Height of the header duplicated from CSS because we need to subtract it from our max
// height to get the max height of the video
const CONTEXT_MENU_VPADDING = 8; // How far the context menu sits above the button (px)

const CONTROLS_HIDE_DELAY = 2000;

type ButtonProps = Omit<AccessibleButtonProps<"div">, "title" | "element"> & {
    state: boolean;
    onLabel?: string;
    offLabel?: string;
    forceHide?: boolean;
    onHover?: (hovering: boolean) => void;
};

const LegacyCallViewToggleButton = forwardRef<HTMLElement, ButtonProps>(
    ({ children, state: isOn, className, onLabel, offLabel, forceHide, onHover, ...props }, ref) => {
        const classes = classNames("mx_LegacyCallViewButtons_button", className, {
            mx_LegacyCallViewButtons_button_on: isOn,
            mx_LegacyCallViewButtons_button_off: !isOn,
        });

        const title = forceHide ? undefined : isOn ? onLabel : offLabel;

        return (
            <AccessibleButton
                ref={ref}
                className={classes}
                title={title}
                placement="top"
                onTooltipOpenChange={onHover}
                {...props}
            >
                {children}
            </AccessibleButton>
        );
    },
);

interface IDropdownButtonProps extends ButtonProps {
    deviceKinds: MediaDeviceKindEnum[];
}

const LegacyCallViewDropdownButton: React.FC<IDropdownButtonProps> = ({ state, deviceKinds, ...props }) => {
    const [menuDisplayed, buttonRef, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
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
            ref={buttonRef}
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
                        ref={this.dialpadButton}
                        onClick={this.onDialpadClick}
                        isExpanded={this.state.showDialpad}
                        title={_t("voip|dialpad")}
                        placement="top"
                    />
                )}
                <LegacyCallViewDropdownButton
                    state={!this.props.buttonsState.micMuted}
                    className="mx_LegacyCallViewButtons_button_mic"
                    onLabel={_t("voip|disable_microphone")}
                    offLabel={_t("voip|enable_microphone")}
                    onClick={this.props.handlers.onMicMuteClick}
                    deviceKinds={[MediaDeviceKindEnum.AudioInput, MediaDeviceKindEnum.AudioOutput]}
                />
                {this.props.buttonsVisibility.vidMute && (
                    <LegacyCallViewDropdownButton
                        state={!this.props.buttonsState.vidMuted}
                        className="mx_LegacyCallViewButtons_button_vid"
                        onLabel={_t("voip|disable_camera")}
                        offLabel={_t("voip|enable_camera")}
                        onClick={this.props.handlers.onVidMuteClick}
                        deviceKinds={[MediaDeviceKindEnum.VideoInput]}
                    />
                )}
                {this.props.buttonsVisibility.screensharing && (
                    <LegacyCallViewToggleButton
                        state={this.props.buttonsState.screensharing}
                        className="mx_LegacyCallViewButtons_button_screensharing"
                        onLabel={_t("voip|stop_screenshare")}
                        offLabel={_t("voip|start_screenshare")}
                        onClick={this.props.handlers.onScreenshareClick}
                    />
                )}
                {this.props.buttonsVisibility.sidebar && (
                    <LegacyCallViewToggleButton
                        state={this.props.buttonsState.sidebarShown}
                        className="mx_LegacyCallViewButtons_button_sidebar"
                        onLabel={_t("voip|hide_sidebar_button")}
                        offLabel={_t("voip|show_sidebar_button")}
                        onClick={this.props.handlers.onToggleSidebarClick}
                    />
                )}
                {this.props.buttonsVisibility.contextMenu && (
                    <ContextMenuTooltipButton
                        className="mx_LegacyCallViewButtons_button mx_LegacyCallViewButtons_button_more"
                        onClick={this.onMoreClick}
                        ref={this.contextMenuButton}
                        isExpanded={this.state.showMoreMenu}
                        title={_t("voip|more_button")}
                        placement="top"
                    />
                )}
                <AccessibleButton
                    className="mx_LegacyCallViewButtons_button mx_LegacyCallViewButtons_button_hangup"
                    onClick={this.props.handlers.onHangupClick}
                    title={_t("voip|hangup")}
                    placement="top"
                />
            </div>
        );
    }
}
