/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { _t, Banner } from "@element-hq/web-shared-components";
import { Button } from "@vector-im/compound-web";
import { type Room } from "matrix-js-sdk/src/matrix";
import React from "react";

import { useHistoryVisibleBannerViewModel } from "../../../viewmodels/rooms/banners/HistoryVisibleBannerViewModel";

interface HistoryVisibleBannerProps {
    room: Room;
}

/**
 * A component to alert that history is shared to new members of the room.
 *
 * @example
 * ```tsx
 *   <HistoryVisibleBanner room={room} />
 * ```
 */
export const HistoryVisibleBanner: React.FC<HistoryVisibleBannerProps> = ({ room }) => {
    const { visible, onClose } = useHistoryVisibleBannerViewModel(room);

    if (!visible) {
        return null;
    }

    return (
        <Banner
            type="info"
            actions={
                <Button
                    as="a"
                    href="https://element.io/en/help#e2ee-history-sharing"
                    target="_blank"
                    kind="tertiary"
                    size="sm"
                >
                    {_t("action|learn_more")}
                </Button>
            }
            onClose={onClose}
        >
            {_t("room|status_bar|history_visible")}
        </Banner>
    );
};
