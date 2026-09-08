/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, type JSX } from "react";
import { CustomThemesView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import BaseTool, { DevtoolsContext } from "./BaseTool";
import SettingsStore from "../../../../settings/SettingsStore";
import { RoomRententionConfigViewModel } from "../../../../viewmodels/room/RoomRetentionConfig";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";

interface CustomThemesProps {
    /** Callback to invoke when the back button is clicked. */
    onBack(this: void): void;
}

/**
 * Developer tool for installing custom themes from a URL, and removing installed ones.
 */
export function RoomRetentionDevtool({ onBack }: CustomThemesProps): JSX.Element {
    const { room } = useContext(DevtoolsContext);
    const client = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(
        () => new RoomRententionConfigViewModel({ settingsStore: SettingsStore, client, room }),
    );

    return (
        <BaseTool onBack={onBack} className="mx_CustomThemes">
            <CustomThemesView vm={vm} />
        </BaseTool>
    );
}
