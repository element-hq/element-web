/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { _t } from "../../../../languageHandler";
import { KebabContextMenu } from "../../context_menus/KebabContextMenu";
import { SettingsSubsectionHeading } from "../shared/SettingsSubsectionHeading";
import { IconizedContextMenuOption } from "../../context_menus/IconizedContextMenu";

interface Props {
    // total count of other sessions
    // excludes current sessions
    // not affected by filters
    otherSessionsCount: number;
    disabled?: boolean;
    signOutAllOtherSessions: () => void;
}

export const OtherSessionsSectionHeading: React.FC<Props> = ({
    otherSessionsCount,
    disabled,
    signOutAllOtherSessions,
}) => {
    const menuOptions = [
        <IconizedContextMenuOption
            key="sign-out-all-others"
            label={_t("Sign out of %(count)s sessions", { count: otherSessionsCount })}
            onClick={signOutAllOtherSessions}
            isDestructive
        />,
    ];
    return (
        <SettingsSubsectionHeading heading={_t("Other sessions")}>
            <KebabContextMenu
                disabled={disabled}
                title={_t("Options")}
                options={menuOptions}
                data-testid="other-sessions-menu"
            />
        </SettingsSubsectionHeading>
    );
};
