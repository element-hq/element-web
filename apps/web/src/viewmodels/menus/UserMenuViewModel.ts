/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel, type UserMenuSnapshot, type UserMenuViewActions } from "@element-hq/web-shared-components";

import { OwnProfileStore } from "../../stores/OwnProfileStore";
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

// Matches maximum size of an avatar in the UserMenu
const AVATAR_PX = 88;

export class UserMenuViewModel extends BaseViewModel<UserMenuSnapshot, undefined> implements UserMenuViewActions {
    private static computeSnapshot(
        client: MatrixClient,
        isPanelCollapsed: boolean,
        accountManagementEndpoint?: string,
    ): UserMenuSnapshot {
        const hasHomePage = !!getHomePageUrl(SdkConfig.get(), client);
        const isAuthenticated = !client.isGuest();
        const userId = client.getSafeUserId();
        const displayName = OwnProfileStore.instance.displayName || userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;

        return {
            open: false,
            userId,
            displayName,
            avatarUrl,
            expanded: !isPanelCollapsed,
            manageAccountHref: accountManagementEndpoint,
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
        private readonly dispatcher: MatrixDispatcher,
        client: MatrixClient,
        isPanelCollapsed: boolean,
        accountManagementEndpoint?: string,
    ) {
        super(undefined, UserMenuViewModel.computeSnapshot(client, isPanelCollapsed, accountManagementEndpoint));
        OwnProfileStore.instance.on(UPDATE_EVENT, this.recalculateProfile);
    }

    public dispose(): void {
        OwnProfileStore.instance.off(UPDATE_EVENT, this.recalculateProfile);
        super.dispose();
    }

    public readonly recalculateProfile = (): void => {
        const displayName = OwnProfileStore.instance.displayName || this.snapshot.current.userId;
        const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(AVATAR_PX) ?? undefined;
        this.snapshot.merge({ displayName, avatarUrl });
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
}
