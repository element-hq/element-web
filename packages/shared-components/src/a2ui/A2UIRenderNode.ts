/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * Resolved A2UI component tree, ready for a view to render.
 *
 * Every data binding has been looked up in the data model and template children have been expanded, so a view
 * only needs to walk the tree. Input nodes keep the absolute data model `path` they are bound to so the view can
 * report edits back through the view model.
 */

interface A2UIRenderNodeBase {
    /** Component id from the agent. Repeats for each item of a template. */
    id: string;
    /** Unique key within the surface, including the template scope. Use this for React keys and for actions. */
    key: string;
    /** Relative size within a Row or Column. */
    weight?: number;
}

export interface A2UITextRenderNode extends A2UIRenderNodeBase {
    component: "Text";
    text: string;
    variant: "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body";
}

export interface A2UIImageRenderNode extends A2UIRenderNodeBase {
    component: "Image";
    /** A URL a browser can load, or undefined if the renderer could not resolve it. */
    url?: string;
    description?: string;
    fit: "contain" | "cover" | "fill" | "none" | "scaleDown";
    variant: "icon" | "avatar" | "smallFeature" | "mediumFeature" | "largeFeature" | "header";
}

export interface A2UIVideoRenderNode extends A2UIRenderNodeBase {
    component: "Video";
    /** A URL a browser can load, or undefined if the renderer could not resolve it. */
    url?: string;
}

export interface A2UIIconRenderNode extends A2UIRenderNodeBase {
    component: "Icon";
    /** A catalog icon name, when the icon is named. */
    name?: string;
    /** SVG path data in a 24x24 viewBox, when the agent supplied its own icon. */
    svgPath?: string;
}

export interface A2UIContainerRenderNode extends A2UIRenderNodeBase {
    component: "Row" | "Column" | "List";
    children: A2UIRenderNode[];
    direction: "row" | "column";
    justify: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch";
    align: "start" | "center" | "end" | "stretch";
}

export interface A2UICardRenderNode extends A2UIRenderNodeBase {
    component: "Card";
    child: A2UIRenderNode | null;
}

export interface A2UITabsRenderNode extends A2UIRenderNodeBase {
    component: "Tabs";
    tabs: { title: string; child: A2UIRenderNode | null }[];
}

export interface A2UIDividerRenderNode extends A2UIRenderNodeBase {
    component: "Divider";
    axis: "horizontal" | "vertical";
}

export interface A2UIButtonRenderNode extends A2UIRenderNodeBase {
    component: "Button";
    child: A2UIRenderNode | null;
    variant: "default" | "primary" | "borderless";
    /** False when the button's action is of a kind this client cannot run. */
    enabled: boolean;
}

export interface A2UITextFieldRenderNode extends A2UIRenderNodeBase {
    component: "TextField";
    label: string;
    value: string;
    path?: string;
    variant: "longText" | "number" | "shortText" | "obscured";
}

export interface A2UICheckBoxRenderNode extends A2UIRenderNodeBase {
    component: "CheckBox";
    label: string;
    value: boolean;
    path?: string;
}

export interface A2UIChoicePickerRenderNode extends A2UIRenderNodeBase {
    component: "ChoicePicker";
    label?: string;
    options: { label: string; value: string }[];
    value: string[];
    path?: string;
    variant: "multipleSelection" | "mutuallyExclusive";
}

export interface A2UISliderRenderNode extends A2UIRenderNodeBase {
    component: "Slider";
    label?: string;
    value: number;
    min: number;
    max: number;
    path?: string;
}

export interface A2UIDateTimeInputRenderNode extends A2UIRenderNodeBase {
    component: "DateTimeInput";
    label?: string;
    value: string;
    path?: string;
    enableDate: boolean;
    enableTime: boolean;
}

export interface A2UIUnsupportedRenderNode extends A2UIRenderNodeBase {
    component: "Unsupported";
    /** The component type the agent asked for. */
    type: string;
}

export type A2UIRenderNode =
    | A2UITextRenderNode
    | A2UIImageRenderNode
    | A2UIIconRenderNode
    | A2UIVideoRenderNode
    | A2UIContainerRenderNode
    | A2UICardRenderNode
    | A2UITabsRenderNode
    | A2UIDividerRenderNode
    | A2UIButtonRenderNode
    | A2UITextFieldRenderNode
    | A2UICheckBoxRenderNode
    | A2UIChoicePickerRenderNode
    | A2UISliderRenderNode
    | A2UIDateTimeInputRenderNode
    | A2UIUnsupportedRenderNode;

/** A resolved surface: its id and the tree under the `root` component, or null before a root has been defined. */
export interface A2UIRenderSurface {
    surfaceId: string;
    root: A2UIRenderNode | null;
}
