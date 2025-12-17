/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { HistoryVisibleBannerView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";
import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { HistoryVisibleBannerViewModel } from "../../../viewmodels/composer/HistoryVisibleBannerViewModel";

/** Wrapper around {@link HistoryVisibleBannerViewModel} for the creation of an auto-disposed view model. */
export const HistoryVisibleBanner: React.FC<{
    /** The room instance associated with this banner view model. */
    room: Room;

    /**
     * If provided, specifies the ID of the thread currently being viewed in the thread timeline side view,
     * where the banner view is displayed as a child of the message composer.
     */
    threadId: string | null;
}> = (props) => {
    const vm = useCreateAutoDisposedViewModel(() => new HistoryVisibleBannerViewModel(props));
    return <HistoryVisibleBannerView vm={vm} />;
};
