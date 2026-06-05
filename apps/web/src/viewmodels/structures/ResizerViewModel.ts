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
    type ResizerViewSnapshot,
} from "@element-hq/web-shared-components";
import { debounce } from "lodash";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";

function getInitialState(): ResizerViewSnapshot {
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

/**
 * Viewmodel that drives the resizable left panel.
 */
export class ResizerViewModel
    extends BaseViewModel<ResizerViewSnapshot, void>
    implements SeparatorViewActions, LeftResizablePanelViewActions, GroupViewActions
{
    /**
     * This object gives us access to the API methods of react-resizable-panels library.
     */
    private panelHandle?: PanelImperativeHandle;

    /**
     * Needed to distinguish between a drag and a click on the separator.
     */
    private readonly mouseClickHandler: MouseClickHandler;

    public constructor() {
        super(undefined, getInitialState());
        // Run onSeparatorClick when the separator is clicked.
        this.mouseClickHandler = new MouseClickHandler(this.onSeparatorClick);
    }

    public onLeftPanelResize = debounce((panelSize: PanelSize): void => {
        const newSize = panelSize.inPixels;
        this.snapshot.merge({ isCollapsed: newSize === 0 });
    }, 50);

    public onLeftPanelResized = (newSize: number): void => {
        // We don't want the panels to have fractional widths as that can cause blurry UI elements.
        if (!Number.isInteger(newSize)) {
            this.panelHandle?.resize(`${Math.round(newSize)}%`);
            return;
        }

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

    private onSeparatorClick = (): void => {
        // When panel is collapsed, single click should expand the panel.
        if (this.panelHandle?.isCollapsed()) {
            const lastSize = SettingsStore.getValue("RoomList.panelSize");
            this.panelHandle.resize(`${lastSize ?? 100}%`);
        }
    };

    public onDoubleClick = (): void => {
        // When the panel is expanded, double click should collapse.
        if (!this.panelHandle?.isCollapsed()) this.panelHandle?.collapse();
    };

    public onPointerUp = (): void => {
        this.mouseClickHandler.onPointerUp();
    };

    public onPointerMove = (): void => {
        this.mouseClickHandler.onPointerMove();
    };

    public onPointerDown = (): void => {
        this.mouseClickHandler.onPointerDown();
    };
}

/**
 * Dragging the separator will emit a click event.
 * This class uses pointer event handlers to distinguish between a drag and a click
 * on the separator.
 */
class MouseClickHandler {
    public constructor(private readonly onClick: () => void) {}

    private isResize = false;

    public onPointerUp = (): void => {
        if (!this.isResize) this.onClick();
    };

    public onPointerDown = (): void => {
        this.isResize = false;
    };

    public onPointerMove = (): void => {
        this.isResize = true;
    };
}
