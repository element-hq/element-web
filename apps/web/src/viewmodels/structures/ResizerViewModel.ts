/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type LeftResizablePanelViewActions,
    type SeparatorViewActions,
    type PanelSize,
    type PanelImperativeHandle,
    type GroupViewActions,
    type ResizerSnapshot,
} from "@element-hq/web-shared-components";
import { debounce } from "lodash";
import { logger } from "matrix-js-sdk/src/logger";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";

function getInitialState(): ResizerSnapshot {
    if (SettingsStore.getValue("RoomList.isPanelCollapsed")) {
        return {
            isCollapsed: true,
            initialSize: 0,
        };
    }
    return {
        isCollapsed: false,
        initialSize: SettingsStore.getValue("RoomList.panelSize") ?? undefined,
    };
}

export class ResizerViewModel
    extends BaseViewModel<ResizerSnapshot, void>
    implements SeparatorViewActions, LeftResizablePanelViewActions, GroupViewActions
{
    /**
     * This object gives us access to the API methods of react-resizable-panels library.
     */
    private panelHandle?: PanelImperativeHandle;

    public constructor() {
        super(undefined, getInitialState());
    }

    public onLeftPanelResize = debounce((panelSize: PanelSize): void => {
        const newSize = panelSize.inPixels;
        this.snapshot.merge({ isCollapsed: newSize === 0 });
    }, 50);

    public onLeftPanelResized = (newSize: number): void => {
        const isCollapsed = newSize === 0;
        // Store the size if the panel isn't collapsed.
        if (!isCollapsed) {
            SettingsStore.setValue("RoomList.panelSize", null, SettingLevel.DEVICE, newSize);
        }
        // Store whether the panel was collapsed.
        // This is stored separately instead of being inferred from the stored panel size so that
        // the panel can be restored to its last known non-zero width even after app reload, which
        // we wouldn't be able to do if we stored panelSize as zero.
        SettingsStore.setValue("RoomList.isPanelCollapsed", null, SettingLevel.DEVICE, isCollapsed);
    };

    public setPanelHandle = (handle: PanelImperativeHandle): void => {
        this.panelHandle = handle;
    };

    public onSeparatorClick = (): void => {
        if (this.panelHandle?.isCollapsed()) {
            const restoreWidth = SettingsStore.getValue("RoomList.panelSize");
            if (!restoreWidth) {
                // This is unlikely to ever happen since onLeftPanelResized will be called
                // on initial render of the separator.
                logger.error("ResizerViewModel.onSeparatorClick: Returning because restoreWidth is zero.");
                return;
            }
            // There's an expand method but it doesn't remember the last known width correctly.
            this.panelHandle.resize(`${restoreWidth}%`);
        }
    };
}
