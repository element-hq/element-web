/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, ClientEvent } from "matrix-js-sdk/src/matrix";
import { BaseViewModel, type UserStatusIconViewSnapshot } from "@element-hq/web-shared-components";

import { fetchUserStatus, validateUserStatus } from "../../utils/userStatus";
import SettingsStore from "../../settings/SettingsStore";
import { logger } from "matrix-js-sdk/src/logger";

export interface UserStatusIconViewModelProps {
    /**
     * The ID of the user whose status should be displayed.
     */
    userId: string;
    /**
     * The Matrix client instance.
     */
    matrixClient: MatrixClient;
}

export class UserStatusIconViewModel extends BaseViewModel<UserStatusIconViewSnapshot, UserStatusIconViewModelProps> {
    public constructor(props: UserStatusIconViewModelProps) {
        super(props, { status: undefined });

        if (!SettingsStore.getValue("feature_user_status")) {
            return;
        }

        this.disposables.trackListener(
            props.matrixClient,
            ClientEvent.UserProfileUpdate,
            this.onUserProfileUpdate as (...args: unknown[]) => void,
        );

        fetchUserStatus(props.matrixClient, props.userId)
            .then((status) => {
                if (this.isDisposed) return;
                this.snapshot.merge({ status });
            })
            .catch((err) => {
                logger.warn("Failed to fetch user status:", err);
            });
    }

    private onUserProfileUpdate = (syncedUserId: string, syncProfile: Record<string, unknown> | null): void => {
        if (syncedUserId !== this.props.userId) return;
        this.snapshot.merge({ status: validateUserStatus(syncProfile?.["org.matrix.msc4426.status"]) });
    };
}
