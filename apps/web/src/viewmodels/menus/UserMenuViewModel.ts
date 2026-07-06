/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type UserMenuSnapshot, type UserMenuViewActions } from "@element-hq/web-shared-components";
import { logger } from "matrix-js-sdk/src/logger";

import { type OwnProfileStore } from "../../stores/OwnProfileStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import type { MatrixDispatcher } from "../../dispatcher/dispatcher";
import Modal from "../../Modal";
import { Action } from "../../dispatcher/actions";
import { UserTab } from "../../components/views/dialogs/UserTab";
import FeedbackDialog from "../../components/views/dialogs/FeedbackDialog";
import { shouldShowFeedback } from "../../utils/Feedback";
import { getHomePageUrl } from "../../utils/pages";
import SdkConfig from "../../SdkConfig";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { clearUserStatus } from "../../utils/userStatus";
import { type SetStatusViewModel, UserMenuSetStatusViewModel } from "../status/SetStatusViewModel";
import SettingsStore from "../../settings/SettingsStore";

// Matches maximum size of an avatar in the UserMenu
const AVATAR_PX = 88;

interface UserMenuViewModelProps {
    ownProfileStore: OwnProfileStore;
}

export class UserMenuViewModel
    extends BaseViewModel<UserMenuSnapshot, UserMenuViewModelProps>
    implements UserMenuViewActions
{
    public readonly setStatusVm: SetStatusViewModel;
    private static computeSnapshot(
        client: MatrixClient,
        ownProfileStore: OwnProfileStore,
        isPanelCollapsed: boolean,
        accountManagementEndpoint?: string,
    ): UserMenuSnapshot {
        const hasHomePage = !!getHomePageUrl(SdkConfig.get(), client);
        const isAuthenticated = !client.isGuest();
        const userId = client.getSafeUserId();
        const displayName = ownProfileStore.displayName || userId;
        const avatarUrl = ownProfileStore.getHttpAvatarUrl(AVATAR_PX) ?? undefined;

        const setStatusViewModel = new UserMenuSetStatusViewModel({
            client,
            ownProfileStore,
        });

        return {
            open: false,
            userId,
            displayName,
            avatarUrl,
            expanded: !isPanelCollapsed,
            manageAccountHref: accountManagementEndpoint,
            showAvatar: isAuthenticated,
            userStatus: ownProfileStore.userStatus,
            showUserStatus: SettingsStore.getValue("feature_user_status") && isAuthenticated,
            setStatusViewModel,
            actions: {
                createAccount: !isAuthenticated,
                signIn: !isAuthenticated,
                openHomePage: hasHomePage,
                linkNewDevice: isAuthenticated,
                openSecurity: isAuthenticated,
                openFeedback: shouldShowFeedback(),
                openSettings: true,
            },
        };
    }

    public constructor(
        props: UserMenuViewModelProps,
        private readonly dispatcher: MatrixDispatcher,
        private readonly client: MatrixClient,
        isPanelCollapsed: boolean,
        accountManagementEndpoint?: string,
    ) {
        super(
            props,
            UserMenuViewModel.computeSnapshot(
                client,
                props.ownProfileStore,
                isPanelCollapsed,
                accountManagementEndpoint,
            ),
        );
        this.setStatusVm = new UserMenuSetStatusViewModel({ client, ownProfileStore: props.ownProfileStore });
        props.ownProfileStore.on(UPDATE_EVENT, this.recalculateProfile);
    }

    public dispose(): void {
        this.props.ownProfileStore.off(UPDATE_EVENT, this.recalculateProfile);
        this.setStatusVm.dispose();
        super.dispose();
    }

    public readonly recalculateProfile = (): void => {
        const displayName = this.props.ownProfileStore.displayName || this.snapshot.current.userId;
        const avatarUrl = this.props.ownProfileStore.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        const userStatus = this.props.ownProfileStore.userStatus;
        this.snapshot.merge({ displayName, avatarUrl, userStatus });
    };

    public readonly setOpen = (isOpen: boolean): void => {
        this.snapshot.merge({ open: isOpen });
    };

    public readonly setExpanded = (expanded: boolean): void => {
        this.snapshot.merge({ expanded });
    };

    public readonly createAccount = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: "start_registration" });
    };

    public readonly signIn = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: "start_login" });
    };

    public readonly openHomePage = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({ action: Action.ViewHomePage });
    };

    public readonly openFeedback = (): void => {
        this.setOpen(false);
        Modal.createDialog(FeedbackDialog);
    };

    public readonly linkNewDevice = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.SessionManager,
            props: { showMsc4108QrCode: true },
        });
    };

    public readonly openSecurity = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Security,
        });
    };

    public readonly openSettings = (): void => {
        this.setOpen(false);
        this.dispatcher.dispatch({
            action: Action.ViewUserSettings,
        });
    };

    public readonly clearStatus = (): void => {
        this.setOpen(false);
        clearUserStatus(this.client).catch((err) => {
            logger.warn("Failed to clear user status", err);
        });
    };
}
