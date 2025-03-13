/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../../languageHandler";
import { KebabContextMenu } from "../../context_menus/KebabContextMenu";
import { SettingsSubsectionHeading } from "../shared/SettingsSubsectionHeading";
import { IconizedContextMenuOption } from "../../context_menus/IconizedContextMenu";
import { filterBoolean } from "../../../../utils/arrays";

interface Props {
    // total count of other sessions
    // excludes current sessions
    // not affected by filters
    otherSessionsCount: number;
    disabled?: boolean;
    // not provided when sign out all other sessions is not available
    signOutAllOtherSessions?: () => void;
}

export const OtherSessionsSectionHeading: React.FC<Props> = ({
    otherSessionsCount,
    disabled,
    signOutAllOtherSessions,
}) => {
    const menuOptions = filterBoolean([
        signOutAllOtherSessions ? (
            <IconizedContextMenuOption
                key="sign-out-all-others"
                label={_t("settings|sessions|sign_out_n_sessions", { count: otherSessionsCount })}
                onClick={signOutAllOtherSessions}
                isDestructive
            />
        ) : null,
    ]);
    return (
        <SettingsSubsectionHeading heading={_t("settings|sessions|other_sessions_heading")}>
            {!!menuOptions.length && (
                <KebabContextMenu
                    disabled={disabled}
                    title={_t("common|options")}
                    options={menuOptions}
                    data-testid="other-sessions-menu"
                />
            )}
        </SettingsSubsectionHeading>
    );
};
