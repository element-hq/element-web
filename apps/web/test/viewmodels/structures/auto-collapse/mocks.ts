/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

export class MockCollapseHandler {
    public collapse = jest.fn().mockImplementation(() => {
        this.isAutoCollapsed = true;
    });
    public expand = jest.fn().mockImplementation(() => {
        this.isAutoCollapsed = false;
    });
    public isAutoCollapsed = false;
    public panelHandle = new MockPanelHandle();
}

export class MockPanelHandle {
    private _isCollapsed = false;
    public inPixels = 100;
    public isCollapsed = jest.fn().mockImplementation(() => {
        return this._isCollapsed;
    });
    public collapse = jest.fn().mockImplementation(() => {
        this._isCollapsed = true;
    });
    public resize = jest.fn().mockImplementation(() => {
        this._isCollapsed = false;
    });
    getSize = jest.fn().mockReturnValue({
        inPixels: this.inPixels,
    });
}
