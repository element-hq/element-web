/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useContext } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { SDKContext } from "../../../contexts/SDKContext";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";

/** The phases that sit side by side under these tabs. */
const TABS: Array<{ phase: RightPanelPhases; label: () => string }> = [
    { phase: RightPanelPhases.Timeline, label: () => _t("right_panel|video_room_chat|title") },
    { phase: RightPanelPhases.FileBrowser, label: () => _t("right_panel|file_browser|title") },
];

interface Props {
    /** The phase currently being shown, which renders as the selected tab. */
    active: RightPanelPhases;
}

/**
 * Header tabs that switch the right panel between the room's chat and its files.
 *
 * Rendered in place of a plain card title, so the two panels read as one surface with two views
 * rather than as unrelated cards.
 */
export function PanelTabs({ active }: Props): JSX.Element {
    const sdkContext = useContext(SDKContext);

    return (
        <div className="mx_PanelTabs" role="tablist">
            {TABS.map(({ phase, label }) => {
                const selected = phase === active;
                return (
                    <button
                        key={phase}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={classNames("mx_PanelTabs_tab", {
                            mx_PanelTabs_tab_selected: selected,
                        })}
                        onClick={() => {
                            if (!selected) sdkContext.rightPanelStore.setCard({ phase });
                        }}
                    >
                        {label()}
                    </button>
                );
            })}
        </div>
    );
}
