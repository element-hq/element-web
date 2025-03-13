/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export interface IStoredLayout {
    // Where to store the widget. Required.
    container: Container;

    // The index (order) to position the widgets in. Only applies for
    // ordered containers (like the top container). Smaller numbers first,
    // and conflicts resolved by comparing widget IDs.
    index?: number;

    // Percentage (integer) for relative width of the container to consume.
    // Clamped to 0-100 and may have minimums imposed upon it. Only applies
    // to containers which support inner resizing (currently only the top
    // container).
    width?: number;

    // Percentage (integer) for relative height of the container. Note that
    // this only applies to the top container currently, and that container
    // will take the highest value among widgets in the container. Clamped
    // to 0-100 and may have minimums imposed on it.
    height?: number | null;

    // TODO: [Deferred] Maximizing (fullscreen) widgets by default.
}

export interface IWidgetLayouts {
    [widgetId: string]: IStoredLayout;
}

export interface ILayoutStateEvent {
    // TODO: [Deferred] Forced layout (fixed with no changes)

    // The widget layouts.
    widgets: IWidgetLayouts;
}

export const WIDGET_LAYOUT_EVENT_TYPE = "io.element.widgets.layout";

export enum Container {
    // "Top" is the app drawer, and currently the only sensible value.
    Top = "top",

    // "Right" is the right panel, and the default for widgets. Setting
    // this as a container on a widget is essentially like saying "no
    // changes needed", though this may change in the future.
    Right = "right",

    Center = "center",
}
