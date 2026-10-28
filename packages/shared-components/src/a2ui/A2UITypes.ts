/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * Types for the A2UI (Agent-to-User Interface) protocol, v0.9.
 *
 * Only the subset of the protocol and the basic catalog that the prototype renderer understands is modelled here.
 * See https://a2ui.org/ for the full specification.
 */

/** The protocol version this implementation understands. */
export const A2UI_VERSION = "v0.9";

/** Any JSON value. */
export type A2UIJsonValue = string | number | boolean | null | A2UIJsonValue[] | { [key: string]: A2UIJsonValue };

/** A reference into the data model, as a JSON Pointer. */
export interface A2UIDataBinding {
    path: string;
}

/** A literal value or a reference into the data model. */
export type A2UIDynamic<T> = T | A2UIDataBinding;

/** A list of children: either static component ids or a template expanded over a data model list. */
export type A2UIChildList = string[] | { componentId: string; path: string };

/** An action attached to a component. Only the server event form is supported. */
export interface A2UIAction {
    event?: {
        name: string;
        context?: Record<string, A2UIDynamic<A2UIJsonValue>>;
    };
    functionCall?: {
        call: string;
        args?: Record<string, A2UIJsonValue>;
    };
}

interface A2UIComponentBase {
    id: string;
    weight?: number;
}

export interface A2UITextComponent extends A2UIComponentBase {
    component: "Text";
    text: A2UIDynamic<string>;
    variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body";
}

export interface A2UIImageComponent extends A2UIComponentBase {
    component: "Image";
    url: A2UIDynamic<string>;
    description?: A2UIDynamic<string>;
    fit?: "contain" | "cover" | "fill" | "none" | "scaleDown";
    variant?: "icon" | "avatar" | "smallFeature" | "mediumFeature" | "largeFeature" | "header";
}

export interface A2UIVideoComponent extends A2UIComponentBase {
    component: "Video";
    url: A2UIDynamic<string>;
}

export interface A2UIIconComponent extends A2UIComponentBase {
    component: "Icon";
    /** A catalog icon name, a custom SVG path (24x24 viewBox) or a binding to a name. */
    name: A2UIDynamic<string> | { svgPath: string };
}

export interface A2UIRowComponent extends A2UIComponentBase {
    component: "Row";
    children: A2UIChildList;
    justify?: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch";
    align?: "start" | "center" | "end" | "stretch";
}

export interface A2UIColumnComponent extends A2UIComponentBase {
    component: "Column";
    children: A2UIChildList;
    justify?: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch";
    align?: "start" | "center" | "end" | "stretch";
}

export interface A2UIListComponent extends A2UIComponentBase {
    component: "List";
    children: A2UIChildList;
    direction?: "vertical" | "horizontal";
    align?: "start" | "center" | "end" | "stretch";
}

export interface A2UICardComponent extends A2UIComponentBase {
    component: "Card";
    child: string;
}

export interface A2UITabsComponent extends A2UIComponentBase {
    component: "Tabs";
    tabs: { title: A2UIDynamic<string>; child: string }[];
}

export interface A2UIDividerComponent extends A2UIComponentBase {
    component: "Divider";
    axis?: "horizontal" | "vertical";
}

export interface A2UIButtonComponent extends A2UIComponentBase {
    component: "Button";
    child: string;
    action: A2UIAction;
    variant?: "default" | "primary" | "borderless";
}

export interface A2UITextFieldComponent extends A2UIComponentBase {
    component: "TextField";
    label: A2UIDynamic<string>;
    value?: A2UIDynamic<string>;
    variant?: "longText" | "number" | "shortText" | "obscured";
}

export interface A2UICheckBoxComponent extends A2UIComponentBase {
    component: "CheckBox";
    label: A2UIDynamic<string>;
    value: A2UIDynamic<boolean>;
}

export interface A2UIChoicePickerComponent extends A2UIComponentBase {
    component: "ChoicePicker";
    options: { label: A2UIDynamic<string>; value: string }[];
    value: A2UIDynamic<string[]>;
    label?: A2UIDynamic<string>;
    variant?: "multipleSelection" | "mutuallyExclusive";
}

export interface A2UISliderComponent extends A2UIComponentBase {
    component: "Slider";
    value: A2UIDynamic<number>;
    max: number;
    min?: number;
    label?: A2UIDynamic<string>;
}

export interface A2UIDateTimeInputComponent extends A2UIComponentBase {
    component: "DateTimeInput";
    value: A2UIDynamic<string>;
    enableDate?: boolean;
    enableTime?: boolean;
    label?: A2UIDynamic<string>;
}

/** A component whose type this renderer does not know. It is kept so the tree stays navigable. */
export interface A2UIUnknownComponent extends A2UIComponentBase {
    component: string;
    [key: string]: unknown;
}

/** A component of the basic catalog that this renderer understands. */
export type A2UIKnownComponent =
    | A2UITextComponent
    | A2UIImageComponent
    | A2UIIconComponent
    | A2UIVideoComponent
    | A2UIRowComponent
    | A2UIColumnComponent
    | A2UIListComponent
    | A2UICardComponent
    | A2UITabsComponent
    | A2UIDividerComponent
    | A2UIButtonComponent
    | A2UITextFieldComponent
    | A2UICheckBoxComponent
    | A2UIChoicePickerComponent
    | A2UISliderComponent
    | A2UIDateTimeInputComponent;

/** A component definition as sent by the agent. */
export type A2UIComponent = A2UIKnownComponent | A2UIUnknownComponent;

const KNOWN_COMPONENT_TYPES: ReadonlySet<string> = new Set<A2UIKnownComponent["component"]>([
    "Text",
    "Image",
    "Icon",
    "Video",
    "Row",
    "Column",
    "List",
    "Card",
    "Tabs",
    "Divider",
    "Button",
    "TextField",
    "CheckBox",
    "ChoicePicker",
    "Slider",
    "DateTimeInput",
]);

/** Whether this renderer knows how to resolve the component's type. */
export function isKnownA2UIComponent(component: A2UIComponent): component is A2UIKnownComponent {
    return KNOWN_COMPONENT_TYPES.has(component.component);
}

/** A server-to-client message. Exactly one of the message kinds is present. */
export interface A2UIServerMessage {
    version?: string;
    createSurface?: {
        surfaceId: string;
        catalogId?: string;
        theme?: Record<string, A2UIJsonValue>;
        sendDataModel?: boolean;
    };
    updateComponents?: {
        surfaceId: string;
        components: A2UIComponent[];
    };
    updateDataModel?: {
        surfaceId: string;
        path?: string;
        value?: A2UIJsonValue;
    };
    deleteSurface?: {
        surfaceId: string;
    };
}

/** The `action` part of a client-to-server message reporting a user interaction. */
export interface A2UIActionMessage {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, A2UIJsonValue>;
}
