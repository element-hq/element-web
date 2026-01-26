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

export const HistoryVisibleBanner: React.FC<{ room: Room }> = ({ room }) => {
    const vm = useCreateAutoDisposedViewModel(() => new HistoryVisibleBannerViewModel({ room }));
    return <HistoryVisibleBannerView vm={vm} />;
};
