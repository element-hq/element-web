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

import React, { createRef, useContext, useRef, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import * as fbEmitter from "fbemitter";
import classNames from "classnames";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import dis from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { _t } from "../../languageHandler";
import { ChevronFace, ContextMenuButton } from "./ContextMenu";
import { UserTab } from "../views/dialogs/UserSettingsDialog";
import { OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import FeedbackDialog from "../views/dialogs/FeedbackDialog";
import Modal from "../../Modal";
import LogoutDialog from "../views/dialogs/LogoutDialog";
import SettingsStore from "../../settings/SettingsStore";
import { findHighContrastTheme, getCustomTheme, isHighContrastTheme } from "../../theme";
import {
    RovingAccessibleButton,
    RovingAccessibleTooltipButton,
    useRovingTabIndex,
} from "../../accessibility/RovingTabIndex";
import AccessibleButton, { ButtonEvent } from "../views/elements/AccessibleButton";
import SdkConfig from "../../SdkConfig";
import { getHomePageUrl } from "../../utils/pages";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import BaseAvatar from '../views/avatars/BaseAvatar';
import { SettingLevel } from "../../settings/SettingLevel";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../views/context_menus/IconizedContextMenu";
import GroupFilterOrderStore from "../../stores/GroupFilterOrderStore";
import { UIFeature } from "../../settings/UIFeature";
import HostSignupAction from "./HostSignupAction";
import { IHostSignupConfig } from "../views/dialogs/HostSignupDialogTypes";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { replaceableComponent } from "../../utils/replaceableComponent";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { SettingUpdatedPayload } from "../../dispatcher/payloads/SettingUpdatedPayload";

const CustomStatusSection = () => {
    const cli = useContext(MatrixClientContext);
    const setStatus = cli.getUser(cli.getUserId()).unstable_statusMessage || "";
    const [value, setValue] = useState(setStatus);

    const ref = useRef<HTMLInputElement>(null);
    const [onFocus, isActive] = useRovingTabIndex(ref);

    const classes = classNames({
        'mx_UserMenu_CustomStatusSection_field': true,
        'mx_UserMenu_CustomStatusSection_field_hasQuery': value,
    });

    let details: JSX.Element;
    if (value !== setStatus) {
        details = <>
            <p>{ _t("Your status will be shown to people you have a DM with.") }</p>

            <RovingAccessibleButton
                onClick={() => cli._unstable_setStatusMessage(value)}
                kind="primary_outline"
            >
                { value ? _t("Set status") : _t("Clear status") }
            </RovingAccessibleButton>
        </>;
    }

    return <form className="mx_UserMenu_CustomStatusSection">
        <div className={classes}>
            <input
                type="text"
                value={value}
                className="mx_UserMenu_CustomStatusSection_input"
                onChange={e => setValue(e.target.value)}
                placeholder={_t("Set a new status")}
                autoComplete="off"
                onFocus={onFocus}
                ref={ref}
                tabIndex={isActive ? 0 : -1}
            />
            <AccessibleButton
                // The clear button is only for mouse users
                tabIndex={-1}
                title={_t("Clear")}
                className="mx_UserMenu_CustomStatusSection_clear"
                onClick={() => setValue("")}
            />
        </div>

        { details }
    </form>;
};

interface IProps {
    isPanelCollapsed: boolean;
}

type PartialDOMRect = Pick<DOMRect, "width" | "left" | "top" | "height">;

interface IState {
    contextMenuPosition: PartialDOMRect;
    isDarkTheme: boolean;
    isHighContrast: boolean;
    selectedSpace?: Room;
    dndEnabled: boolean;
}

const toRightOf = (rect: PartialDOMRect) => {
    return {
        left: rect.width + rect.left + 8,
        top: rect.top,
        chevronFace: ChevronFace.None,
    };
};

const below = (rect: PartialDOMRect) => {
    return {
        left: rect.left,
        top: rect.top + rect.height,
        chevronFace: ChevronFace.None,
    };
};

@replaceableComponent("structures.UserMenu")
export default class UserMenu extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private themeWatcherRef: string;
    private readonly dndWatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();
    private tagStoreRef: fbEmitter.EventSubscription;

    constructor(props: IProps) {
        super(props);

        this.state = {
            contextMenuPosition: null,
            isDarkTheme: this.isUserOnDarkTheme(),
            isHighContrast: this.isUserOnHighContrastTheme(),
            dndEnabled: this.doNotDisturb,
            selectedSpace: SpaceStore.instance.activeSpaceRoom,
        };

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileUpdate);
        if (SpaceStore.spacesEnabled) {
            SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdate);
        }

        SettingsStore.monitorSetting("feature_dnd", null);
        SettingsStore.monitorSetting("doNotDisturb", null);
    }

    private get doNotDisturb(): boolean {
        return SettingsStore.getValue("doNotDisturb");
    }

    private get hasHomePage(): boolean {
        return !!getHomePageUrl(SdkConfig.get());
    }

    public componentDidMount() {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.themeWatcherRef = SettingsStore.watchSetting("theme", null, this.onThemeChanged);
        this.tagStoreRef = GroupFilterOrderStore.addListener(this.onTagStoreUpdate);
    }

    public componentWillUnmount() {
        if (this.themeWatcherRef) SettingsStore.unwatchSetting(this.themeWatcherRef);
        if (this.dndWatcherRef) SettingsStore.unwatchSetting(this.dndWatcherRef);
        if (this.dispatcherRef) defaultDispatcher.unregister(this.dispatcherRef);
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
        this.tagStoreRef.remove();
        if (SpaceStore.spacesEnabled) {
            SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdate);
        }
    }

    private onTagStoreUpdate = () => {
        this.forceUpdate(); // we don't have anything useful in state to update
    };

    private isUserOnDarkTheme(): boolean {
        if (SettingsStore.getValue("use_system_theme")) {
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        } else {
            const theme = SettingsStore.getValue("theme");
            if (theme.startsWith("custom-")) {
                return getCustomTheme(theme.substring("custom-".length)).is_dark;
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

    private onProfileUpdate = async () => {
        // the store triggered an update, so force a layout update. We don't
        // have any state to store here for that to magically happen.
        this.forceUpdate();
    };

    private onSelectedSpaceUpdate = async () => {
        this.setState({
            selectedSpace: SpaceStore.instance.activeSpaceRoom,
        });
    };

    private onThemeChanged = () => {
        this.setState(
            {
                isDarkTheme: this.isUserOnDarkTheme(),
                isHighContrast: this.isUserOnHighContrastTheme(),
            });
    };

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case Action.ToggleUserMenu:
                if (this.state.contextMenuPosition) {
                    this.setState({ contextMenuPosition: null });
                } else {
                    if (this.buttonRef.current) this.buttonRef.current.click();
                }
                break;

            case Action.SettingUpdated: {
                const settingUpdatedPayload = payload as SettingUpdatedPayload;
                switch (settingUpdatedPayload.settingName) {
                    case "feature_dnd":
                    case "doNotDisturb": {
                        const dndEnabled = this.doNotDisturb;
                        if (this.state.dndEnabled !== dndEnabled) {
                            this.setState({ dndEnabled });
                        }
                        break;
                    }
                }
            }
        }
    };

    private onOpenMenuClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({ contextMenuPosition: ev.currentTarget.getBoundingClientRect() });
    };

    private onContextMenu = (ev: React.MouseEvent) => {
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

    private onCloseMenu = () => {
        this.setState({ contextMenuPosition: null });
    };

    private onSwitchThemeClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

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

    private onSettingsOpen = (ev: ButtonEvent, tabId: string) => {
        ev.preventDefault();
        ev.stopPropagation();

        const payload: OpenToTabPayload = { action: Action.ViewUserSettings, initialTabId: tabId };
        defaultDispatcher.dispatch(payload);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onProvideFeedback = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Feedback Dialog', '', FeedbackDialog);
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onSignOutClick = async (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        const cli = MatrixClientPeg.get();
        if (!cli || !cli.isCryptoEnabled() || !(await cli.exportRoomKeys())?.length) {
            // log out without user prompt if they have no local megolm sessions
            dis.dispatch({ action: 'logout' });
        } else {
            Modal.createTrackedDialog('Logout from LeftPanel', '', LogoutDialog);
        }

        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onSignInClick = () => {
        dis.dispatch({ action: 'start_login' });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onRegisterClick = () => {
        dis.dispatch({ action: 'start_registration' });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onHomeClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({ action: 'view_home_page' });
        this.setState({ contextMenuPosition: null }); // also close the menu
    };

    private onDndToggle = (ev: ButtonEvent) => {
        ev.stopPropagation();
        const current = SettingsStore.getValue("doNotDisturb");
        SettingsStore.setValue("doNotDisturb", null, SettingLevel.DEVICE, !current);
    };

    private renderContextMenu = (): React.ReactNode => {
        if (!this.state.contextMenuPosition) return null;

        let topSection;
        const hostSignupConfig: IHostSignupConfig = SdkConfig.get().hostSignup;
        if (MatrixClientPeg.get().isGuest()) {
            topSection = (
                <div className="mx_UserMenu_contextMenu_header mx_UserMenu_contextMenu_guestPrompts">
                    { _t("Got an account? <a>Sign in</a>", {}, {
                        a: sub => (
                            <AccessibleButton kind="link" onClick={this.onSignInClick}>
                                { sub }
                            </AccessibleButton>
                        ),
                    }) }
                    { _t("New here? <a>Create an account</a>", {}, {
                        a: sub => (
                            <AccessibleButton kind="link" onClick={this.onRegisterClick}>
                                { sub }
                            </AccessibleButton>
                        ),
                    }) }
                </div>
            );
        } else if (hostSignupConfig) {
            if (hostSignupConfig && hostSignupConfig.url) {
                // If hostSignup.domains is set to a non-empty array, only show
                // dialog if the user is on the domain or a subdomain.
                const hostSignupDomains = hostSignupConfig.domains || [];
                const mxDomain = MatrixClientPeg.get().getDomain();
                const validDomains = hostSignupDomains.filter(d => (d === mxDomain || mxDomain.endsWith(`.${d}`)));
                if (!hostSignupConfig.domains || validDomains.length > 0) {
                    topSection = <HostSignupAction onClick={this.onCloseMenu} />;
                }
            }
        }

        let homeButton = null;
        if (this.hasHomePage) {
            homeButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconHome"
                    label={_t("Home")}
                    onClick={this.onHomeClick}
                />
            );
        }

        let customStatusSection: JSX.Element;
        if (SettingsStore.getValue("feature_custom_status")) {
            customStatusSection = <CustomStatusSection />;
        }

        let dndButton: JSX.Element;
        if (SettingsStore.getValue("feature_dnd")) {
            dndButton = (
                <IconizedContextMenuCheckbox
                    iconClassName={this.state.dndEnabled ? "mx_UserMenu_iconDnd" : "mx_UserMenu_iconDndOff"}
                    label={_t("Do not disturb")}
                    onClick={this.onDndToggle}
                    active={this.state.dndEnabled}
                    words
                />
            );
        }

        let feedbackButton;
        if (SettingsStore.getValue(UIFeature.Feedback)) {
            feedbackButton = <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconMessage"
                label={_t("Feedback")}
                onClick={this.onProvideFeedback}
            />;
        }

        let primaryOptionList = (
            <IconizedContextMenuOptionList>
                { homeButton }
                { dndButton }
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconBell"
                    label={_t("Notifications")}
                    onClick={(e) => this.onSettingsOpen(e, UserTab.Notifications)}
                />
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconLock"
                    label={_t("Security & privacy")}
                    onClick={(e) => this.onSettingsOpen(e, UserTab.Security)}
                />
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconSettings"
                    label={_t("All settings")}
                    onClick={(e) => this.onSettingsOpen(e, null)}
                />
                { feedbackButton }
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
                    { homeButton }
                    <IconizedContextMenuOption
                        iconClassName="mx_UserMenu_iconSettings"
                        label={_t("Settings")}
                        onClick={(e) => this.onSettingsOpen(e, null)}
                    />
                    { feedbackButton }
                </IconizedContextMenuOptionList>
            );
        }

        const position = this.props.isPanelCollapsed
            ? toRightOf(this.state.contextMenuPosition)
            : below(this.state.contextMenuPosition);

        return <IconizedContextMenu
            {...position}
            onFinished={this.onCloseMenu}
            className="mx_UserMenu_contextMenu"
        >
            <div className="mx_UserMenu_contextMenu_header">
                <div className="mx_UserMenu_contextMenu_name">
                    <span className="mx_UserMenu_contextMenu_displayName">
                        { OwnProfileStore.instance.displayName }
                    </span>
                    <span className="mx_UserMenu_contextMenu_userId">
                        { MatrixClientPeg.get().getUserId() }
                    </span>
                </div>

                <RovingAccessibleTooltipButton
                    className="mx_UserMenu_contextMenu_themeButton"
                    onClick={this.onSwitchThemeClick}
                    title={this.state.isDarkTheme ? _t("Switch to light mode") : _t("Switch to dark mode")}
                >
                    <img
                        src={require("../../../res/img/element-icons/roomlist/dark-light-mode.svg")}
                        alt={_t("Switch theme")}
                        width={16}
                    />
                </RovingAccessibleTooltipButton>
            </div>
            { customStatusSection }
            { topSection }
            { primaryOptionList }
        </IconizedContextMenu>;
    };

    public render() {
        const avatarSize = 32; // should match border-radius of the avatar

        const userId = MatrixClientPeg.get().getUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(avatarSize);

        let badge: JSX.Element;
        if (this.state.dndEnabled) {
            badge = <div className="mx_UserMenu_dndBadge" />;
        }

        let name: JSX.Element;
        if (!this.props.isPanelCollapsed) {
            name = <div className="mx_UserMenu_name">
                { displayName }
            </div>;
        }

        return <div className="mx_UserMenu">
            <ContextMenuButton
                onClick={this.onOpenMenuClick}
                inputRef={this.buttonRef}
                label={_t("User menu")}
                isExpanded={!!this.state.contextMenuPosition}
                onContextMenu={this.onContextMenu}
                className={classNames({
                    mx_UserMenu_cutout: badge,
                })}
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
                    { badge }
                </div>
                { name }

                { this.renderContextMenu() }
            </ContextMenuButton>

            { this.props.children }
        </div>;
    }
}
