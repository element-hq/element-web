/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef, ReactNode } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { _t } from "../../languageHandler";
import { ChevronFace, ContextMenuButton, MenuProps } from "./ContextMenu";
import { UserTab } from "../views/dialogs/UserTab";
import { OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import FeedbackDialog from "../views/dialogs/FeedbackDialog";
import Modal from "../../Modal";
import LogoutDialog from "../views/dialogs/LogoutDialog";
import SettingsStore from "../../settings/SettingsStore";
import { findHighContrastTheme, getCustomTheme, isHighContrastTheme } from "../../theme";
import { RovingAccessibleTooltipButton } from "../../accessibility/RovingTabIndex";
import AccessibleButton, { ButtonEvent } from "../views/elements/AccessibleButton";
import SdkConfig from "../../SdkConfig";
import { getHomePageUrl } from "../../utils/pages";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import BaseAvatar from "../views/avatars/BaseAvatar";
import { SettingLevel } from "../../settings/SettingLevel";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../views/context_menus/IconizedContextMenu";
import { UIFeature } from "../../settings/UIFeature";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import UserIdentifierCustomisations from "../../customisations/UserIdentifier";
import PosthogTrackers from "../../PosthogTrackers";
import { ViewHomePagePayload } from "../../dispatcher/payloads/ViewHomePagePayload";
import { Icon as LiveIcon } from "../../../res/img/compound/live-8px.svg";
import { VoiceBroadcastRecording, VoiceBroadcastRecordingsStoreEvent } from "../../voice-broadcast";
import { SDKContext } from "../../contexts/SDKContext";

interface IProps {
    isPanelCollapsed: boolean;
    children?: ReactNode;
}

type PartialDOMRect = Pick<DOMRect, "width" | "left" | "top" | "height">;

interface IState {
    contextMenuPosition: PartialDOMRect | null;
    isDarkTheme: boolean;
    isHighContrast: boolean;
    selectedSpace?: Room | null;
    showLiveAvatarAddon: boolean;
}

const toRightOf = (rect: PartialDOMRect): MenuProps => {
    return {
        left: rect.width + rect.left + 8,
        top: rect.top,
        chevronFace: ChevronFace.None,
    };
};

const below = (rect: PartialDOMRect): MenuProps => {
    return {
        left: rect.left,
        top: rect.top + rect.height,
        chevronFace: ChevronFace.None,
    };
};

export default class UserMenu extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    public context!: React.ContextType<typeof SDKContext>;

    private dispatcherRef: string;
    private themeWatcherRef: string;
    private readonly dndWatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        this.context = context;
        this.state = {
            contextMenuPosition: null,
            isDarkTheme: this.isUserOnDarkTheme(),
            isHighContrast: this.isUserOnHighContrastTheme(),
            selectedSpace: SpaceStore.instance.activeSpaceRoom,
            showLiveAvatarAddon: this.context.voiceBroadcastRecordingsStore.hasCurrent(),
        };

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileUpdate);
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdate);
    }

    private get hasHomePage(): boolean {
        return !!getHomePageUrl(SdkConfig.get());
    }

    private onCurrentVoiceBroadcastRecordingChanged = (recording: VoiceBroadcastRecording): void => {
        this.setState({
            showLiveAvatarAddon: recording !== null,
        });
    };

    public componentDidMount(): void {
        this.context.voiceBroadcastRecordingsStore.on(
            VoiceBroadcastRecordingsStoreEvent.CurrentChanged,
            this.onCurrentVoiceBroadcastRecordingChanged,
        );
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.themeWatcherRef = SettingsStore.watchSetting("theme", null, this.onThemeChanged);
    }

    public componentWillUnmount(): void {
        if (this.themeWatcherRef) SettingsStore.unwatchSetting(this.themeWatcherRef);
        if (this.dndWatcherRef) SettingsStore.unwatchSetting(this.dndWatcherRef);
        if (this.dispatcherRef) defaultDispatcher.unregister(this.dispatcherRef);
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
        SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdate);
        this.context.voiceBroadcastRecordingsStore.off(
            VoiceBroadcastRecordingsStoreEvent.CurrentChanged,
            this.onCurrentVoiceBroadcastRecordingChanged,
        );
    }

    private isUserOnDarkTheme(): boolean {
        if (SettingsStore.getValue("use_system_theme")) {
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        } else {
            const theme = SettingsStore.getValue("theme");
            if (theme.startsWith("custom-")) {
                return !!getCustomTheme(theme.substring("custom-".length)).is_dark;
            }
            return theme === "dark";
        }
    }

    private isUserOnHighContrastTheme(): boolean {
        if (SettingsStore.getValue("use_system_theme")) {
            return window.matchMedia("(prefers-contrast: more)").matches;
        } else {
            const theme = SettingsStore.getValue("theme");
            if (theme.startsWith("custom-")) {
                return false;
            }
            return isHighContrastTheme(theme);
        }
    }

    private onProfileUpdate = async (): Promise<void> => {
        // the store triggered an update, so force a layout update. We don't
        // have any state to store here for that to magically happen.
        this.forceUpdate();
    };

    private onSelectedSpaceUpdate = async (): Promise<void> => {
        this.setState({
            selectedSpace: SpaceStore.instance.activeSpaceRoom,
        });
    };

    private onThemeChanged = (): void => {
        this.setState({
            isDarkTheme: this.isUserOnDarkTheme(),
            isHighContrast: this.isUserOnHighContrastTheme(),
        });
    };

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case Action.ToggleUserMenu:
                if (this.state.contextMenuPosition) {
                    this.setState({ contextMenuPosition: null });
                } else {
                    if (this.buttonRef.current) this.buttonRef.current.click();
                }
                break;
        }
    };

    private onOpenMenuClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({ contextMenuPosition: ev.currentTarget.getBoundingClientRect() });
    };

    private onContextMenu = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            contextMenuPosition: {
                left: ev.clientX,
                top: ev.clientY,
                width: 20,
                height: 0,
            },
        });
    };

    private onCloseMenu = (): void => {
        this.setState({ contextMenuPosition: null });
    };

    private onSwitchThemeClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();

        PosthogTrackers.trackInteraction("WebUserMenuThemeToggleButton", ev);

        // Disable system theme matching if the user hits this button
        SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, false);

        let newTheme = this.state.isDarkTheme ? "light" : "dark";
        if (this.state.isHighContrast) {
            const hcTheme = findHighContrastTheme(newTheme);
            if (hcTheme) {
                newTheme = hcTheme;
            }
        }
        SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme); // set at same level as Appearance tab
    };

    private onSettingsOpen = (ev: ButtonEvent, tabId?: string): void => {
        ev.preventDefault();
        ev.stopPropagation();

        const payload: OpenToTabPayload = { action: Action.ViewUserSettings, initialTabId: tabId };
        defaultDispatcher.dispatch(payload);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onProvideFeedback = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createDialog(FeedbackDialog);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onSignOutClick = async (ev: ButtonEvent): Promise<void> => {
        ev.preventDefault();
        ev.stopPropagation();

        const cli = MatrixClientPeg.get();
        if (!cli || !cli.isCryptoEnabled() || !(await cli.exportRoomKeys())?.length) {
            // log out without user prompt if they have no local megolm sessions
            defaultDispatcher.dispatch({ action: "logout" });
        } else {
            Modal.createDialog(LogoutDialog);
        }

        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onSignInClick = (): void => {
        defaultDispatcher.dispatch({ action: "start_login" });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onRegisterClick = (): void => {
        defaultDispatcher.dispatch({ action: "start_registration" });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onHomeClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private renderContextMenu = (): React.ReactNode => {
        if (!this.state.contextMenuPosition) return null;

        let topSection;
        if (MatrixClientPeg.get().isGuest()) {
            topSection = (
                <div className="mx_UserMenu_contextMenu_header mx_UserMenu_contextMenu_guestPrompts">
                    {_t(
                        "Got an account? <a>Sign in</a>",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onSignInClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                    {_t(
                        "New here? <a>Create an account</a>",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton kind="link_inline" onClick={this.onRegisterClick}>
                                    {sub}
                                </AccessibleButton>
                            ),
                        },
                    )}
                </div>
            );
        }

        let homeButton: JSX.Element | undefined;
        if (this.hasHomePage) {
            homeButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconHome"
                    label={_t("Home")}
                    onClick={this.onHomeClick}
                />
            );
        }

        let feedbackButton: JSX.Element | undefined;
        if (SettingsStore.getValue(UIFeature.Feedback)) {
            feedbackButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconMessage"
                    label={_t("Feedback")}
                    onClick={this.onProvideFeedback}
                />
            );
        }

        let primaryOptionList = (
            <IconizedContextMenuOptionList>
                {homeButton}
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconBell"
                    label={_t("Notifications")}
                    onClick={(e) => this.onSettingsOpen(e, UserTab.Notifications)}
                />
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconLock"
                    label={_t("Security & Privacy")}
                    onClick={(e) => this.onSettingsOpen(e, UserTab.Security)}
                />
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconSettings"
                    label={_t("All settings")}
                    onClick={(e) => this.onSettingsOpen(e)}
                />
                {feedbackButton}
                <IconizedContextMenuOption
                    className="mx_IconizedContextMenu_option_red"
                    iconClassName="mx_UserMenu_iconSignOut"
                    label={_t("Sign out")}
                    onClick={this.onSignOutClick}
                />
            </IconizedContextMenuOptionList>
        );

        if (MatrixClientPeg.get().isGuest()) {
            primaryOptionList = (
                <IconizedContextMenuOptionList>
                    {homeButton}
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconSettings"
                        label={_t("Settings")}
                        onClick={(e) => this.onSettingsOpen(e)}
                    />
                    {feedbackButton}
                </IconizedContextMenuOptionList>
            );
        }

        const position = this.props.isPanelCollapsed
            ? toRightOf(this.state.contextMenuPosition)
            : below(this.state.contextMenuPosition);

        return (
            <IconizedContextMenu {...position} onFinished={this.onCloseMenu} className="mx_UserMenu_contextMenu">
                <div className="mx_UserMenu_contextMenu_header">
                    <div className="mx_UserMenu_contextMenu_name">
                        <span className="mx_UserMenu_contextMenu_displayName">
                            {OwnProfileStore.instance.displayName}
                        </span>
                        <span className="mx_UserMenu_contextMenu_userId">
                            {UserIdentifierCustomisations.getDisplayUserIdentifier(
                                MatrixClientPeg.get().getSafeUserId(),
                                {
                                    withDisplayName: true,
                                },
                            )}
                        </span>
                    </div>

                    <RovingAccessibleTooltipButton
                        className="mx_UserMenu_contextMenu_themeButton"
                        onClick={this.onSwitchThemeClick}
                        title={this.state.isDarkTheme ? _t("Switch to light mode") : _t("Switch to dark mode")}
                    >
                        <img
                            src={require("../../../res/img/element-icons/roomlist/dark-light-mode.svg").default}
                            alt={_t("Switch theme")}
                            width={16}
                        />
                    </RovingAccessibleTooltipButton>
                </div>
                {topSection}
                {primaryOptionList}
            </IconizedContextMenu>
        );
    };

    public render(): React.ReactNode {
        const avatarSize = 32; // should match border-radius of the avatar

        const userId = MatrixClientPeg.get().getSafeUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(avatarSize);

        let name: JSX.Element | undefined;
        if (!this.props.isPanelCollapsed) {
            name = <div className="mx_UserMenu_name">{displayName}</div>;
        }

        const liveAvatarAddon = this.state.showLiveAvatarAddon ? (
            <div className="mx_UserMenu_userAvatarLive" data-testid="user-menu-live-vb">
                <LiveIcon className="mx_Icon_8" />
            </div>
        ) : null;

        return (
            <div className="mx_UserMenu">
                <ContextMenuButton
                    onClick={this.onOpenMenuClick}
                    inputRef={this.buttonRef}
                    label={_t("User menu")}
                    isExpanded={!!this.state.contextMenuPosition}
                    onContextMenu={this.onContextMenu}
                >
                    <div className="mx_UserMenu_userAvatar">
                        <BaseAvatar
                            idName={userId}
                            name={displayName}
                            url={avatarUrl}
                            width={avatarSize}
                            height={avatarSize}
                            resizeMethod="crop"
                            className="mx_UserMenu_userAvatar_BaseAvatar"
                        />
                        {liveAvatarAddon}
                    </div>
                    {name}
                    {this.renderContextMenu()}
                </ContextMenuButton>

                {this.props.children}
            </div>
        );
    }
}
