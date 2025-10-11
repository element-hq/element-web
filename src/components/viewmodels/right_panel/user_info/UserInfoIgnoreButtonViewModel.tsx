/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, useState, useCallback } from "react";
import { type RoomMember, User, ClientEvent, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { _t } from "../../../../languageHandler";
import Modal from "../../../../Modal";
import QuestionDialog from "../../../views/dialogs/QuestionDialog";
import { useTypedEventEmitter } from "../../../../hooks/useEventEmitter";

export interface UserInfoPowerLevelState {
    /**
     * Weither the member is ignored by current user or not
     */
    isIgnored: boolean;
    /**
     * Trigger the method to ignore or unignore a user
     * @param ev - The click event
     */
    ignoreButtonClick: (ev: Event) => void;
}

export const useUserInfoIgnoreButtonViewModel = (member: User | RoomMember): UserInfoPowerLevelState => {
    const cli = useContext(MatrixClientContext);

    const unignore = useCallback(() => {
        const ignoredUsers = cli.getIgnoredUsers();
        const index = ignoredUsers.indexOf(member.userId);
        if (index !== -1) ignoredUsers.splice(index, 1);
        cli.setIgnoredUsers(ignoredUsers);
    }, [cli, member]);

    const ignore = useCallback(async () => {
        const name = (member instanceof User ? member.displayName : member.name) || member.userId;
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("user_info|ignore_confirm_title", { user: name }),
            description: <div>{_t("user_info|ignore_confirm_description")}</div>,
            button: _t("action|ignore"),
        });
        const [confirmed] = await finished;

        if (confirmed) {
            const ignoredUsers = cli.getIgnoredUsers();
            ignoredUsers.push(member.userId);
            cli.setIgnoredUsers(ignoredUsers);
        }
    }, [cli, member]);

    // Check whether the user is ignored
    const [isIgnored, setIsIgnored] = useState(cli.isUserIgnored(member.userId));
    // Recheck if the user or client changes
    useEffect(() => {
        setIsIgnored(cli.isUserIgnored(member.userId));
    }, [cli, member.userId]);

    // Recheck also if we receive new accountData m.ignored_user_list
    const accountDataHandler = useCallback(
        (ev: MatrixEvent) => {
            if (ev.getType() === "m.ignored_user_list") {
                setIsIgnored(cli.isUserIgnored(member.userId));
            }
        },
        [cli, member.userId],
    );
    useTypedEventEmitter(cli, ClientEvent.AccountData, accountDataHandler);

    const ignoreButtonClick = (ev: Event): void => {
        ev.preventDefault();
        if (isIgnored) {
            unignore();
        } else {
            ignore();
        }
    };

    return {
        ignoreButtonClick,
        isIgnored,
    };
};
