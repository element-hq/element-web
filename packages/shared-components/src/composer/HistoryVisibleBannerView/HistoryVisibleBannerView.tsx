/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Link } from "@vector-im/compound-web";
import React, { type JSX } from "react";

import { useViewModel } from "../../useViewModel";
import { _t } from "../../utils/i18n";
import { type ViewModel } from "../../viewmodel";
import { Banner } from "../Banner";

export interface HistoryVisibleBannerViewActions {
    /**
     * Called when the user dismisses the banner.
     */
    onClose: () => void;
}

export interface HistoryVisibleBannerViewSnapshot {
    /**
     * Whether the banner is currently visible.
     */
    visible: boolean;
}

/**
 * The view model for the banner.
 */
export type HistoryVisibleBannerViewModel = ViewModel<HistoryVisibleBannerViewSnapshot> &
    HistoryVisibleBannerViewActions;

interface HistoryVisibleBannerViewProps {
    /**
     * The view model for the banner.
     */
    vm: HistoryVisibleBannerViewModel;
}

/**
 * A component to alert that history is shared to new members of the room.
 *
 * @example
 * ```tsx
 * <HistoryVisibleBannerView vm={historyVisibleBannerViewModel} />
 * ```
 */
export function HistoryVisibleBannerView({ vm }: Readonly<HistoryVisibleBannerViewProps>): JSX.Element {
    const { visible } = useViewModel(vm);

    const contents = _t(
        "room|status_bar|history_visible",
        {},
        {
            a: substituteATag,
        },
    );

    return (
        <>
            {visible && (
                <Banner type="info" onClose={() => vm.onClose()}>
                    {contents}
                </Banner>
            )}
        </>
    );
}

function substituteATag(sub: string): JSX.Element {
    return (
        <Link href="https://element.io/en/help#e2ee-history-sharing" target="_blank">
            {sub}
        </Link>
    );
}
