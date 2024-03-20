/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
