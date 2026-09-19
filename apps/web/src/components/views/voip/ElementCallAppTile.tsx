/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useContext, useEffect } from "react";
import { ElementCallAppTileView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import type { CallAppTileProps } from "./CallAppTile";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { SDKContext } from "../../../contexts/SDKContext.ts";
import { ElementCallAppTileViewModel } from "../../../viewmodels/room/ElementCallAppTileViewModel";

/**
 * A component that provides that aquires the clinet and sdkContext to create the viewModel.
 * @param props the same props the "outer" ElementCallAppTile uses.
 * @returns A component wrapping ElementCallAppTileView with vm.
 */
const ElementCallAppTileInner = (props: CallAppTileProps): JSX.Element => {
    const { app, room, miniMode = false, fullWidth = false, pointerEvents, overlay, movePersistedElement } = props;
    const client = useContext(MatrixClientContext);
    const sdkContext = useContext(SDKContext);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ElementCallAppTileViewModel({
                app,
                room,
                client,
                sdkContext,
                miniMode,
                fullWidth,
                pointerEvents,
                movePersistedElement,
            }),
    );

    // The view model docks the call and starts listening only once the tile is really mounted;
    // disposal is handled by useCreateAutoDisposedViewModel.
    useEffect(() => vm.start(), [vm]);

    useEffect(() => {
        vm.setLayout({ miniMode, fullWidth, pointerEvents });
    }, [vm, miniMode, fullWidth, pointerEvents]);

    return <ElementCallAppTileView vm={vm} overlay={overlay} />;
};

/**
 * `AppTile` for Element Call rendered as an in-process React component rather than as an iframe.
 *
 * Takes the same props as `AppTile` so that `CallView` and `PersistentApp` can swap it in unchanged.
 * The tile itself is `ElementCallAppTileView` in shared components; everything it does beyond
 * arranging the markup — persistence, docking, teardown, leaving the room — is
 * `ElementCallAppTileViewModel`.
 *
 * The widget the call is identified by is fixed for the life of a view model, so a tile handed a
 * different widget or room remounts rather than mutating one: that undocks the old call and docks
 * the new, as the iframe path does.
 */
export const ElementCallAppTile = (props: CallAppTileProps): JSX.Element => (
    <ElementCallAppTileInner key={`${props.room?.roomId ?? ""}|${props.app.id}`} {...props} />
);
