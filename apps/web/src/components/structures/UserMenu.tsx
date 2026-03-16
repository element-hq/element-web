/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import {
    HomeSolidIcon,
    LockSolidIcon,
    QrCodeIcon,
    SettingsSolidIcon,
    ChatProblemIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { MenuItem } from "@vector-im/compound-web";
import { QuickSettingsMenu } from "@element-hq/web-shared-components";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { _t } from "../../languageHandler";
import { UserTab } from "../views/dialogs/UserTab";
import FeedbackDialog from "../views/dialogs/FeedbackDialog";
import Modal from "../../Modal";
import SettingsStore from "../../settings/SettingsStore";
import SdkConfig from "../../SdkConfig";
import { getHomePageUrl } from "../../utils/pages";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { type ViewHomePagePayload } from "../../dispatcher/payloads/ViewHomePagePayload";
import { SDKContext, SdkContextClass } from "../../contexts/SDKContext";
import { shouldShowFeedback } from "../../utils/Feedback";

interface IProps {
    isPanelCollapsed: boolean;
    children?: ReactNode;
}

interface IState {
    selectedSpace?: Room | null;
    open: boolean;
}

export default class UserMenu extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    private dispatcherRef?: string;
    private themeWatcherRef?: string;
    private readonly dndWatcherRef?: string;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            selectedSpace: SpaceStore.instance.activeSpaceRoom,
            open: false,
        };
    }

    private get hasHomePage(): boolean {
        return !!getHomePageUrl(SdkConfig.get(), this.context.client!);
    }

    public componentDidMount(): void {
        OwnProfileStore.instance.on(UPDATE_EVENT, this.onProfileUpdate);
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdate);
        this.dispatcherRef = defaultDispatcher.register((action) => {
            if (action.action === Action.ToggleUserMenu) {
                this.setState((s) => ({ open: !s.open }));
            }
        });
    }

    public componentWillUnmount(): void {
        SettingsStore.unwatchSetting(this.themeWatcherRef);
        SettingsStore.unwatchSetting(this.dndWatcherRef);
        defaultDispatcher.unregister(this.dispatcherRef);
        OwnProfileStore.instance.off(UPDATE_EVENT, this.onProfileUpdate);
        SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdate);
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

    // TODO: Remove Action.ToggleUserMenu
    private renderContextMenu = (): JSX.Element[] => {
        if (MatrixClientPeg.safeGet().isGuest()) {
            // TODO: More guest buttons?
            return [
                <MenuItem
                    key="sign_in"
                    label={_t("auth|sign_in_prompt")}
                    onSelect={() => defaultDispatcher.dispatch({ action: "start_login" })}
                />,
                <MenuItem
                    key="start_reg"
                    label={_t("auth|create_account_prompt")}
                    onSelect={() => defaultDispatcher.dispatch({ action: "start_registration" })}
                />,
                <MenuItem
                    key="settings"
                    Icon={SettingsSolidIcon}
                    label={_t("user_menu|settings")}
                    onSelect={() =>
                        defaultDispatcher.dispatch({
                            action: Action.ViewUserSettings,
                        })
                    }
                />,
            ];
        }

        return [
            this.hasHomePage ? (
                <MenuItem
                    key="view_homepage"
                    Icon={HomeSolidIcon}
                    label={_t("common|home")}
                    onSelect={() => defaultDispatcher.dispatch<ViewHomePagePayload>({ action: Action.ViewHomePage })}
                />
            ) : null,
            <MenuItem
                key="link_new_device"
                Icon={QrCodeIcon}
                label={_t("user_menu|link_new_device")}
                onSelect={() =>
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.SessionManager,
                        props: { showMsc4108QrCode: true },
                    })
                }
            />,
            <MenuItem
                key="security"
                Icon={LockSolidIcon}
                label={_t("room_settings|security|title")}
                onSelect={() =>
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.Security,
                    })
                }
            />,
            shouldShowFeedback() ? (
                <MenuItem
                    key="feedback"
                    Icon={ChatProblemIcon}
                    label={_t("common|feedback")}
                    onSelect={() => Modal.createDialog(FeedbackDialog)}
                />
            ) : null,
            <MenuItem
                key="settings"
                Icon={SettingsSolidIcon}
                label={_t("user_menu|settings")}
                onSelect={() =>
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                    })
                }
            />,
        ].filter<JSX.Element>((item) => item !== null);
    };

    public render(): React.ReactNode {
        const avatarSize = 88; // should match border-radius of the avatar
        const userId = MatrixClientPeg.safeGet().getSafeUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(avatarSize) ?? undefined;
        const externalAccountManagementUrl = SdkContextClass.instance.oidcClientStore.accountManagementEndpoint;

        return (
            <QuickSettingsMenu
                open={this.state.open}
                setOpen={(open) => this.setState({ open })}
                expanded={!this.props.isPanelCollapsed}
                userId={userId}
                displayName={displayName}
                avatarUrl={avatarUrl}
                manageAccountHref={externalAccountManagementUrl}
            >
                {this.renderContextMenu()}
            </QuickSettingsMenu>
        );
    }
}
