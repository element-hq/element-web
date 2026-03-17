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
import whatInput from "what-input";

import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";
import { AutoCollapseBehaviour } from "./behaviours/AutoCollapseBehaviour";
import { CallStore, CallStoreEvent } from "../../stores/CallStore";
import type { Call } from "../../models/Call";

function getInitialState(): ResizerViewSnapshot {
    const shouldStartCollapsed =
        SettingsStore.getValue("RoomList.isPanelCollapsed") || AutoCollapseBehaviour.shouldStartCollapsed();
    if (shouldStartCollapsed) {
        return {
            isCollapsed: true,
            initialSize: 0,
            isFocusedViaKeyboard: false,
        };
    }
    return {
        isCollapsed: false,
        initialSize: SettingsStore.getValue("RoomList.panelSize") ?? undefined,
        isFocusedViaKeyboard: false,
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

    private readonly autoCollapseBehaviour: AutoCollapseBehaviour;

    public constructor() {
        super(undefined, getInitialState());
        this.autoCollapseBehaviour = this.disposables.track(
            new AutoCollapseBehaviour((isCollapsed) => {
                this.snapshot.merge({ isCollapsed });
            }),
        );
        this.disposables.trackListener(CallStore.instance, CallStoreEvent.ConnectedCalls, (calls) => {
            this.onCallConnected(calls as Set<Call>);
        });
    }

    public onLeftPanelResize = debounce((panelSize: PanelSize): void => {
        if (this.autoCollapseBehaviour.isAutoCollapsed) return;
        const newSize = panelSize.inPixels;
        this.snapshot.merge({ isCollapsed: newSize === 0 });
    }, 50);

    public onLeftPanelResized = (newSize: number): void => {
        // When the window is resized, the panel is resized in various ways.
        // These transient changes should not be persisted in settings.
        // So early return if that is the case.
        if (this.autoCollapseBehaviour.isResizeInProgress) return;

        this.autoCollapseBehaviour.onLeftPanelResized();

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
        this.autoCollapseBehaviour.setHandle(handle);
    };

    public onSeparatorClick = (): void => {
        this.expandPanel();
    };

    public onFocus = (): void => {
        /**
         * The intention here is to make the separator visible when it is focused by keyboard
         * navigation i.e tabbing through the app.
         *
         * There's a good reason to take this approach instead of just relying on the focus-visible
         * selector:
         * When exactly an element gets focus-visible is determined by browser heuristics and usually
         * interacting with the mouse will not give an element focus-visible.
         * However with this separator on chrome, mouse interaction occasionally gives it focus-visible.
         * The leads to flakey separator behaviour.
         */
        const currentNavigation = whatInput.ask();
        if (currentNavigation === "keyboard") {
            this.snapshot.merge({ isFocusedViaKeyboard: true });
        }
    };

    public onBlur = (): void => {
        if (this.getSnapshot().isFocusedViaKeyboard) this.snapshot.merge({ isFocusedViaKeyboard: false });
    };

    private onCallConnected = (calls: Set<Call>): void => {
        if (calls.size > 0 && !this.panelHandle?.isCollapsed()) this.panelHandle?.collapse();
        if (calls.size === 0 && this.panelHandle?.isCollapsed()) this.expandPanel();
    };

    private expandPanel = (): void => {
        if (this.panelHandle?.isCollapsed()) this.panelHandle.resize(`100%`);
    };
}
