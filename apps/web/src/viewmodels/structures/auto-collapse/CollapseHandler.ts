/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Contains auto-collapsed state and methods to expand/collapse the panel.
 * This class is used by the different auto-collapse behaviours.
 */
export class CollapseHandler {
    /**
     * We use this count to control the expand/collapse calls so that the
     * behaviours do not override each other.
     *
     * For example, consider the sequence:
     * 1. Behaviour A collapses the panel
     * 2. Behaviour B collapses the panel
     * 3. Behaviour B expands the panel
     * 4. Behaviour A expands the panel
     *
     * The expand() call made by behaviour B in step 3 should noop since the panel was
     * also collapsed by behaviour A which hasn't yet expanded the panel.
     */
    private autoCollapsedCount: number;

    /**
     * @param expandPanel Callback that should expand the left panel
     * @param collapsePanel Callback that should collapse the left panel
     * @param initialAutoCollapsedCount The initial value for autoCollapsedCount, defaults to 0.
     */
    public constructor(
        private expandPanel: () => void,
        private collapsePanel: () => void,
        initialAutoCollapsedCount = 0,
    ) {
        this.autoCollapsedCount = initialAutoCollapsedCount;
    }

    /**
     * Collapse the left panel.
     */
    public collapse = (): void => {
        this.autoCollapsedCount++;
        if (this.autoCollapsedCount === 1) {
            this.collapsePanel();
        }
    };

    /**
     * Expand the left panel.
     */
    public expand = (): void => {
        /**
         * Some behaviour is asking us to expand the panel but the count is zero.
         * This happens when the user manually resized the left panel after some
         * behaviour collapsed the panel.
         * We can ignore this request to expand the panel since we don't want to
         * override the manual changes the user made.
         */
        if (this.autoCollapsedCount === 0) return;

        this.autoCollapsedCount--;
        if (this.autoCollapsedCount === 0) {
            this.expandPanel();
        }
    };

    /**
     * Whether the panel is collapsed due to some behaviour.
     */
    public get isAutoCollapsed(): boolean {
        return this.autoCollapsedCount > 0;
    }

    public onLeftPanelResized(): void {
        /**
         * The user has manually resized the left-panel, reset the count
         * so that some collapse behaviour does not override the user
         * choice.
         */
        this.autoCollapsedCount = 0;
    }
}
