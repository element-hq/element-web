/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { PolicyServerView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import SettingsFieldset from "./SettingsFieldset";
import { PolicyServerViewModel } from "../../../viewmodels/room/settings/PolicyServerViewModel";

interface Props {
    room: Room;
}

/**
 * Room settings section to view and change the room's policy server (MSC4284).
 *
 * Wraps the shared `PolicyServerView` in the fieldset used by the other sections of the
 * "Roles & Permissions" tab.
 */
export function PolicyServerSettings({ room }: Props): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new PolicyServerViewModel({ room }));

    return (
        <SettingsFieldset
            legend={_t("room_settings|permissions|policy_server_title")}
            description={_t("room_settings|permissions|policy_server_description")}
        >
            <PolicyServerView vm={vm} />
        </SettingsFieldset>
    );
}
