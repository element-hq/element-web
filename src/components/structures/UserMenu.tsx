/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ActionPayload } from "../../dispatcher/payloads";
import { Action } from "../../dispatcher/actions";
import { _t } from "../../languageHandler";
import { ChevronFace, ContextMenu, ContextMenuButton, MenuItem } from "./ContextMenu";
import {USER_NOTIFICATIONS_TAB, USER_SECURITY_TAB} from "../views/dialogs/UserSettingsDialog";
import { OpenToTabPayload } from "../../dispatcher/payloads/OpenToTabPayload";
import RedesignFeedbackDialog from "../views/dialogs/RedesignFeedbackDialog";
import Modal from "../../Modal";
import LogoutDialog from "../views/dialogs/LogoutDialog";
import SettingsStore, {SettingLevel} from "../../settings/SettingsStore";
import {getCustomTheme} from "../../theme";
import {getHostingLink} from "../../utils/HostingLink";
import {ButtonEvent} from "../views/elements/AccessibleButton";
import SdkConfig from "../../SdkConfig";
import {getHomePageUrl} from "../../utils/pages";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import BaseAvatar from '../views/avatars/BaseAvatar';
import classNames from "classnames";
import AccessibleTooltipButton from "../views/elements/AccessibleTooltipButton";

interface IProps {
    isMinimized: boolean;
}

type PartialDOMRect = Pick<DOMRect, "width" | "left" | "top" | "height">;

interface IState {
    contextMenuPosition: PartialDOMRect;
    isDarkTheme: boolean;
}

interface IMenuButtonProps {
    iconClassName: string;
    label: string;
    onClick(ev: ButtonEvent);
}

const MenuButton: React.FC<IMenuButtonProps> = ({iconClassName, label, onClick}) => {
    return <MenuItem label={label} onClick={onClick}>
        <span className={classNames("mx_IconizedContextMenu_icon", iconClassName)} />
        <span className="mx_IconizedContextMenu_label">{label}</span>
    </MenuItem>;
};

export default class UserMenu extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private themeWatcherRef: string;
    private buttonRef: React.RefObject<HTMLButtonElement> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            contextMenuPosition: null,
            isDarkTheme: this.isUserOnDarkTheme(),
        };

        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileUpdate);
    }

    private get hasHomePage(): boolean {
        return !!getHomePageUrl(SdkConfig.get());
    }

    public componentDidMount() {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.themeWatcherRef = SettingsStore.watchSetting("theme", null, this.onThemeChanged);
    }

    public componentWillUnmount() {
        if (this.themeWatcherRef) SettingsStore.unwatchSetting(this.themeWatcherRef);
        if (this.dispatcherRef) defaultDispatcher.unregister(this.dispatcherRef);
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
    }

    private isUserOnDarkTheme(): boolean {
        const theme = SettingsStore.getValue("theme");
        if (theme.startsWith("custom-")) {
            return getCustomTheme(theme.substring("custom-".length)).is_dark;
        }
        return theme === "dark";
    }

    private onProfileUpdate = async () => {
        // the store triggered an update, so force a layout update. We don't
        // have any state to store here for that to magically happen.
        this.forceUpdate();
    };

    private onThemeChanged = () => {
        this.setState({isDarkTheme: this.isUserOnDarkTheme()});
    };

    private onAction = (ev: ActionPayload) => {
        if (ev.action !== Action.ToggleUserMenu) return; // not interested

        if (this.state.contextMenuPosition) {
            this.setState({contextMenuPosition: null});
        } else {
            if (this.buttonRef.current) this.buttonRef.current.click();
        }
    };

    private onOpenMenuClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({contextMenuPosition: target.getBoundingClientRect()});
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
        this.setState({contextMenuPosition: null});
    };

    private onSwitchThemeClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // Disable system theme matching if the user hits this button
        SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, false);

        const newTheme = this.state.isDarkTheme ? "light" : "dark";
        SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme); // set at same level as Appearance tab
    };

    private onSettingsOpen = (ev: ButtonEvent, tabId: string) => {
        ev.preventDefault();
        ev.stopPropagation();

        const payload: OpenToTabPayload = {action: Action.ViewUserSettings, initialTabId: tabId};
        defaultDispatcher.dispatch(payload);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onShowArchived = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // TODO: Archived room view: https://github.com/vector-im/riot-web/issues/14038
        // Note: You'll need to uncomment the button too.
        console.log("TODO: Show archived rooms");
    };

    private onProvideFeedback = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Report bugs & give feedback', '', RedesignFeedbackDialog);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onSignOutClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        Modal.createTrackedDialog('Logout from LeftPanel', '', LogoutDialog);
        this.setState({contextMenuPosition: null}); // also close the menu
    };

    private onHomeClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({action: 'view_home_page'});
    };

    private renderContextMenu = (): React.ReactNode => {
        if (!this.state.contextMenuPosition) return null;

        let hostingLink;
        const signupLink = getHostingLink("user-context-menu");
        if (signupLink) {
            hostingLink = (
                <div className="mx_UserMenu_contextMenu_header">
                    {_t(
                        "<a>Upgrade</a> to your own domain", {},
                        {
                            a: sub => (
                                <a
                                    href={signupLink}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    tabIndex={-1}
                                >{sub}</a>
                            ),
                        },
                    )}
                </div>
            );
        }

        let homeButton = null;
        if (this.hasHomePage) {
            homeButton = (
                <MenuButton
                    iconClassName="mx_UserMenu_iconHome"
                    label={_t("Home")}
                    onClick={this.onHomeClick}
                />
            );
        }

        return (
            <ContextMenu
                chevronFace={ChevronFace.None}
                // -20 to overlap the context menu by just over the width of the `...` icon and make it look connected
                left={this.state.contextMenuPosition.width + this.state.contextMenuPosition.left - 20}
                top={this.state.contextMenuPosition.top + this.state.contextMenuPosition.height}
                onFinished={this.onCloseMenu}
            >
                <div className="mx_IconizedContextMenu mx_UserMenu_contextMenu">
                    <div className="mx_UserMenu_contextMenu_header">
                        <div className="mx_UserMenu_contextMenu_name">
                            <span className="mx_UserMenu_contextMenu_displayName">
                                {OwnProfileStore.instance.displayName}
                            </span>
                            <span className="mx_UserMenu_contextMenu_userId">
                                {MatrixClientPeg.get().getUserId()}
                            </span>
                        </div>
                        <AccessibleTooltipButton
                            className="mx_UserMenu_contextMenu_themeButton"
                            onClick={this.onSwitchThemeClick}
                            title={this.state.isDarkTheme ? _t("Switch to light mode") : _t("Switch to dark mode")}
                        >
                            <img
                                src={require("../../../res/img/element-icons/roomlist/dark-light-mode.svg")}
                                alt={_t("Switch theme")}
                                width={16}
                            />
                        </AccessibleTooltipButton>
                    </div>
                    {hostingLink}
                    <div className="mx_IconizedContextMenu_optionList mx_IconizedContextMenu_optionList_notFirst">
                        {homeButton}
                        <MenuButton
                            iconClassName="mx_UserMenu_iconBell"
                            label={_t("Notification settings")}
                            onClick={(e) => this.onSettingsOpen(e, USER_NOTIFICATIONS_TAB)}
                        />
                        <MenuButton
                            iconClassName="mx_UserMenu_iconLock"
                            label={_t("Security & privacy")}
                            onClick={(e) => this.onSettingsOpen(e, USER_SECURITY_TAB)}
                        />
                        <MenuButton
                            iconClassName="mx_UserMenu_iconSettings"
                            label={_t("All settings")}
                            onClick={(e) => this.onSettingsOpen(e, null)}
                        />
                        {/* <MenuButton
                            iconClassName="mx_UserMenu_iconArchive"
                            label={_t("Archived rooms")}
                            onClick={this.onShowArchived}
                        /> */}
                        <MenuButton
                            iconClassName="mx_UserMenu_iconMessage"
                            label={_t("Feedback")}
                            onClick={this.onProvideFeedback}
                        />
                    </div>
                    <div className="mx_IconizedContextMenu_optionList mx_UserMenu_contextMenu_redRow">
                        <MenuButton
                            iconClassName="mx_UserMenu_iconSignOut"
                            label={_t("Sign out")}
                            onClick={this.onSignOutClick}
                        />
                    </div>
                </div>
            </ContextMenu>
        );
    };

    public render() {
        const avatarSize = 32; // should match border-radius of the avatar

        let name = <span className="mx_UserMenu_userName">{OwnProfileStore.instance.displayName}</span>;
        let buttons = (
            <span className="mx_UserMenu_headerButtons">
                {/* masked image in CSS */}
            </span>
        );
        if (this.props.isMinimized) {
            name = null;
            buttons = null;
        }

        const classes = classNames({
            'mx_UserMenu': true,
            'mx_UserMenu_minimized': this.props.isMinimized,
        });

        return (
            <React.Fragment>
                <ContextMenuButton
                    className={classes}
                    onClick={this.onOpenMenuClick}
                    inputRef={this.buttonRef}
                    label={_t("User menu")}
                    isExpanded={!!this.state.contextMenuPosition}
                    onContextMenu={this.onContextMenu}
                >
                    <div className="mx_UserMenu_row">
                        <span className="mx_UserMenu_userAvatarContainer">
                            <BaseAvatar
                                idName={MatrixClientPeg.get().getUserId()}
                                name={OwnProfileStore.instance.displayName || MatrixClientPeg.get().getUserId()}
                                url={OwnProfileStore.instance.getHttpAvatarUrl(avatarSize)}
                                width={avatarSize}
                                height={avatarSize}
                                resizeMethod="crop"
                                className="mx_UserMenu_userAvatar"
                            />
                        </span>
                        {name}
                        {buttons}
                    </div>
                </ContextMenuButton>
                {this.renderContextMenu()}
            </React.Fragment>
        );
    }
}
