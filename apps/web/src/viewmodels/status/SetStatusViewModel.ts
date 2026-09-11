/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type SetStatusViewSnapshot,
    type SetStatusViewActions,
    type UserStatus,
} from "@element-hq/web-shared-components";

import { clearAllUserStatus, setUserStatus } from "../../utils/userStatus";
import * as recent from "../../emojipicker/recent";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import dis from "../../dispatcher/dispatcher";
import { UserTab } from "../../components/views/dialogs/UserTab";
import { Action } from "../../dispatcher/actions";
import { type OwnProfileStore } from "../../stores/OwnProfileStore";

export interface SetStatusViewModelProps {
    /**
     * The Matrix client instance.
     */
    client: MatrixClient;
    ownProfileStore: OwnProfileStore;
}

export class SetStatusViewModel
    extends BaseViewModel<SetStatusViewSnapshot, SetStatusViewModelProps>
    implements SetStatusViewActions
{
    public constructor(props: SetStatusViewModelProps) {
        super(props, {
            userStatus: props.ownProfileStore.userStatus,
            // This is a one-time snapshot and we manually update when we add an emoji.
            // It could have a listener for when an emoji gets added but in practice, this
            // would be the only way a recent could possibly get added while the view is mounted.
            recentEmojis: recent.get(),
        });

        this.disposables.trackListener(props.ownProfileStore, UPDATE_EVENT, this.onProfileStoreUpdate);
    }

    private onProfileStoreUpdate = (): void => {
        this.snapshot.merge({ userStatus: this.props.ownProfileStore.userStatus });
    };

    public setStatus = (userStatus: UserStatus): void => {
        const oldStatus = this.snapshot.current.userStatus;

        this.snapshot.merge({ userStatus });
        setUserStatus(this.props.client, userStatus).catch((err) => {
            this.snapshot.merge({ userStatus: oldStatus });
            logger.warn("Failed to set user status", err);
        });
    };

    public recordRecentEmoji = (unicode: string): void => {
        recent.add(unicode);
        // Manually update the list of recent emojis as we know we've just added one.
        this.snapshot.merge({ recentEmojis: recent.get() });
    };

    public clearStatus = (): void => {
        const oldStatus = this.snapshot.current.userStatus;

        this.snapshot.merge({ userStatus: undefined });
        clearAllUserStatus(this.props.client).catch((err) => {
            this.snapshot.merge({ userStatus: oldStatus });
            logger.warn("Failed to clear user status", err);
        });
    };
}

/**
 * A version of the view model that overrides the click handler to open settings instead.
 */
export class UserMenuSetStatusViewModel extends SetStatusViewModel {
    public constructor(props: SetStatusViewModelProps) {
        super(props);
    }

    public onSetCustomStatusClick = (): void => {
        dis.dispatch({
            action: Action.ToggleUserMenu,
        });
        dis.dispatch({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Account,
            props: { startCustomStatus: true },
        });
    };
}
