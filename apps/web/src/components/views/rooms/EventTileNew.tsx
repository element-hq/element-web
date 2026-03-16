/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect } from "react";
import { useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { EventTileViewModel, type EventTileViewModelProps } from "../../viewmodels/rooms/EventTileViewModel";
import { EventTileView } from "./EventTileView";

export const EventTileNew: React.FC<EventTileViewModelProps> = (props) => {
    const vm = useCreateAutoDisposedViewModel(() => new EventTileViewModel(props));

    // Propagate prop changes to the view model so the snapshot stays current.
    useEffect(() => {
        vm.updateProps(props);
    });

    // Register lifecycle listeners (crypto, threads, receipts) on mount.
    useEffect(() => {
        vm.mount();
        return () => vm.unmount();
    }, [vm]);

    return <EventTileView vm={vm} />;
};
