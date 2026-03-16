/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX } from "react";
import { QuickSettingsMenu, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { QuickSettingsMenuViewModel } from "../../viewmodels/menus/QuickSettingsMenuViewModel";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { useDispatcher } from "../../hooks/useDispatcher";
import { Action } from "../../dispatcher/actions";

export default function UserMenu(props: { isPanelCollapsed: boolean }): JSX.Element {
    const client = useMatrixClientContext();
    const vm = useCreateAutoDisposedViewModel(
        () => new QuickSettingsMenuViewModel(defaultDispatcher, client, props.isPanelCollapsed),
    );

    useDispatcher(defaultDispatcher, (payload) => {
        if (payload.action === Action.ToggleUserMenu) {
            vm.setOpen(!vm.getSnapshot().open);
        }
    });

    useEffect(() => {
        vm.setExpanded(!props.isPanelCollapsed);
    }, [vm, props.isPanelCollapsed]);

    return <QuickSettingsMenu vm={vm} />;
}
