/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
    type A2UIChildList,
    type A2UIComponent,
    type A2UIDynamic,
    type A2UIJsonValue,
    type A2UIServerMessage,
    isKnownA2UIComponent,
} from "./A2UITypes";
import { type A2UIRenderNode, type A2UIRenderSurface } from "./A2UIRenderNode";
import { getAtJsonPointer, joinJsonPointer, setAtJsonPointer } from "./jsonPointer";

/** The component id that every surface renders from. */
export const A2UI_ROOT_COMPONENT_ID = "root";

/** Guard against cyclic component references. */
const MAX_DEPTH = 64;

/** Options shared by all surfaces of one A2UI source. */
export interface A2UISurfaceOptions {
    /**
     * Turn an image or video URL from the agent into one the browser may load. Return undefined to leave the
     * media blank. Defaults to allowing http(s) URLs unchanged.
     */
    resolveMediaUrl?: (url: string) => string | undefined;
}

/** A user action resolved against the data model, ready to be reported to the agent. */
export interface A2UIResolvedAction {
    name: string;
    sourceComponentId: string;
    context: Record<string, A2UIJsonValue>;
}

function isBinding(value: unknown): value is { path: string } {
    return typeof value === "object" && value !== null && typeof (value as { path?: unknown }).path === "string";
}

function defaultResolveMediaUrl(url: string): string | undefined {
    return /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * One A2UI surface: a set of component definitions plus the data model they are bound to.
 *
 * The surface applies `updateComponents` and `updateDataModel` messages, records user input and resolves the
 * component graph into an {@link A2UIRenderNode} tree. It has no knowledge of where messages come from.
 */
export class A2UISurface {
    private components = new Map<string, A2UIComponent>();
    private dataModel: A2UIJsonValue | undefined = undefined;
    /** Values typed into inputs that are not bound to the data model, keyed by render node key. */
    private localValues = new Map<string, A2UIJsonValue>();
    /** Where each rendered node came from, so actions can be resolved in the right scope. */
    private nodeIndex = new Map<string, { component: A2UIComponent; scope?: string }>();

    /** Whether the agent asked for the data model to accompany each action. */
    public sendDataModel = false;

    public constructor(
        public readonly surfaceId: string,
        private readonly options: A2UISurfaceOptions = {},
    ) {}

    /** Add or replace component definitions. */
    public updateComponents(components: A2UIComponent[]): void {
        for (const component of components) {
            if (typeof component?.id !== "string" || typeof component.component !== "string") continue;
            this.components.set(component.id, component);
        }
    }

    /** Write `value` at `path` in the data model. Omitting the value deletes the key. */
    public updateDataModel(path: string | undefined, value: A2UIJsonValue | undefined): void {
        this.dataModel = setAtJsonPointer(this.dataModel, path ?? "/", value);
    }

    /** The current data model. */
    public getDataModel(): A2UIJsonValue | undefined {
        return this.dataModel;
    }

    /**
     * Record a user edit to an input. Bound inputs write through to the data model at `path`; unbound inputs
     * remember the value under the node's key.
     */
    public setInputValue(key: string, path: string | undefined, value: A2UIJsonValue): void {
        if (path !== undefined) {
            this.updateDataModel(path, value);
        } else {
            this.localValues.set(key, value);
        }
    }

    /** Resolve the tree under `root`. Returns null when no root component exists yet. */
    public resolve(): A2UIRenderSurface {
        this.nodeIndex.clear();
        const root = this.components.has(A2UI_ROOT_COMPONENT_ID)
            ? this.resolveNode(A2UI_ROOT_COMPONENT_ID, undefined, 0)
            : null;
        return { surfaceId: this.surfaceId, root };
    }

    /**
     * Resolve the action of the node with the given key, looking up any context bindings in the data model.
     * Returns null if the node has no server event action.
     */
    public resolveAction(key: string): A2UIResolvedAction | null {
        const entry = this.nodeIndex.get(key);
        if (!entry || !isKnownA2UIComponent(entry.component) || entry.component.component !== "Button") return null;
        const event = entry.component.action?.event;
        if (typeof event?.name !== "string") return null;

        const context: Record<string, A2UIJsonValue> = {};
        for (const [name, value] of Object.entries(event.context ?? {})) {
            const resolved = this.resolveDynamic(value, entry.scope);
            if (resolved !== undefined) context[name] = resolved;
        }
        return { name: event.name, sourceComponentId: entry.component.id, context };
    }

    /**
     * Look up a binding in the data model, or return the literal. The data model is untyped, so the caller
     * is responsible for checking the shape of a bound value.
     */
    private resolveDynamic<T>(value: A2UIDynamic<T> | undefined, scope: string | undefined): T | undefined {
        if (isBinding(value)) {
            // The data model is untyped JSON; callers validate the shape.
            return getAtJsonPointer(this.dataModel, joinJsonPointer(scope, value.path)) as T | undefined;
        }
        return value;
    }

    private resolveString(value: A2UIDynamic<string> | undefined, scope?: string): string | undefined {
        const resolved: unknown = this.resolveDynamic(value, scope);
        if (resolved === undefined || resolved === null) return undefined;
        if (typeof resolved === "string") return resolved;
        if (typeof resolved === "number" || typeof resolved === "boolean") return String(resolved);
        return JSON.stringify(resolved);
    }

    private resolveMediaUrl(value: A2UIDynamic<string> | undefined, scope: string | undefined): string | undefined {
        const url = this.resolveString(value, scope);
        if (url === undefined) return undefined;
        return (this.options.resolveMediaUrl ?? defaultResolveMediaUrl)(url);
    }

    private bindingPath(value: unknown, scope: string | undefined): string | undefined {
        return isBinding(value) ? joinJsonPointer(scope, value.path) : undefined;
    }

    private inputValue<T>(
        key: string,
        value: A2UIDynamic<T> | undefined,
        scope: string | undefined,
    ): { path?: string; value: T | undefined } {
        const path = this.bindingPath(value, scope);
        if (path === undefined && this.localValues.has(key)) {
            return { value: this.localValues.get(key) as T };
        }
        return { path, value: this.resolveDynamic<T>(value, scope) };
    }

    private resolveChildren(
        children: A2UIChildList | undefined,
        scope: string | undefined,
        depth: number,
    ): A2UIRenderNode[] {
        if (Array.isArray(children)) {
            return children
                .map((id) => this.resolveNode(id, scope, depth + 1))
                .filter((node): node is A2UIRenderNode => node !== null);
        }
        if (children && typeof children.componentId === "string" && typeof children.path === "string") {
            const listPath = joinJsonPointer(scope, children.path);
            const list = getAtJsonPointer(this.dataModel, listPath);
            if (!Array.isArray(list)) return [];
            return list
                .map((_item, index) => this.resolveNode(children.componentId, `${listPath}/${index}`, depth + 1))
                .filter((node): node is A2UIRenderNode => node !== null);
        }
        return [];
    }

    private resolveNode(id: string, scope: string | undefined, depth: number): A2UIRenderNode | null {
        const component = this.components.get(id);
        if (!component || depth > MAX_DEPTH) return null;

        const key = scope ? `${id}@${scope}` : id;
        this.nodeIndex.set(key, { component, scope });
        const base = { id, key, weight: typeof component.weight === "number" ? component.weight : undefined };
        const child = (childId: unknown): A2UIRenderNode | null =>
            typeof childId === "string" ? this.resolveNode(childId, scope, depth + 1) : null;

        if (!isKnownA2UIComponent(component)) {
            return { ...base, component: "Unsupported", type: component.component };
        }

        switch (component.component) {
            case "Text":
                return {
                    ...base,
                    component: "Text",
                    text: this.resolveString(component.text, scope) ?? "",
                    variant: component.variant ?? "body",
                };
            case "Image": {
                return {
                    ...base,
                    component: "Image",
                    url: this.resolveMediaUrl(component.url, scope),
                    description: this.resolveString(component.description, scope),
                    fit: component.fit ?? "fill",
                    variant: component.variant ?? "mediumFeature",
                };
            }
            case "Video":
                return { ...base, component: "Video", url: this.resolveMediaUrl(component.url, scope) };
            case "Icon": {
                const svgPath = (component.name as { svgPath?: unknown } | undefined)?.svgPath;
                if (typeof svgPath === "string") return { ...base, component: "Icon", svgPath };
                return {
                    ...base,
                    component: "Icon",
                    name: this.resolveString(component.name as A2UIDynamic<string>, scope),
                };
            }
            case "Row":
            case "Column":
                return {
                    ...base,
                    component: component.component,
                    direction: component.component === "Row" ? "row" : "column",
                    children: this.resolveChildren(component.children, scope, depth),
                    justify: component.justify ?? "start",
                    align: component.align ?? "stretch",
                };
            case "List":
                return {
                    ...base,
                    component: "List",
                    direction: component.direction === "horizontal" ? "row" : "column",
                    children: this.resolveChildren(component.children, scope, depth),
                    justify: "start",
                    align: component.align ?? "stretch",
                };
            case "Card":
                return { ...base, component: "Card", child: child(component.child) };
            case "Tabs":
                return {
                    ...base,
                    component: "Tabs",
                    tabs: (Array.isArray(component.tabs) ? component.tabs : []).map((tab) => ({
                        title: this.resolveString(tab.title, scope) ?? "",
                        child: child(tab.child),
                    })),
                };
            case "Divider":
                return { ...base, component: "Divider", axis: component.axis ?? "horizontal" };
            case "Button":
                return {
                    ...base,
                    component: "Button",
                    child: child(component.child),
                    variant: component.variant ?? "default",
                    enabled: typeof component.action?.event?.name === "string",
                };
            case "TextField": {
                const { path, value } = this.inputValue<string>(key, component.value, scope);
                return {
                    ...base,
                    component: "TextField",
                    label: this.resolveString(component.label, scope) ?? "",
                    value: value === undefined || value === null ? "" : String(value),
                    path,
                    variant: component.variant ?? "shortText",
                };
            }
            case "CheckBox": {
                const { path, value } = this.inputValue<boolean>(key, component.value, scope);
                return {
                    ...base,
                    component: "CheckBox",
                    label: this.resolveString(component.label, scope) ?? "",
                    value: value === true,
                    path,
                };
            }
            case "ChoicePicker": {
                const { path, value } = this.inputValue<string[]>(key, component.value, scope);
                return {
                    ...base,
                    component: "ChoicePicker",
                    label: this.resolveString(component.label, scope),
                    options: (Array.isArray(component.options) ? component.options : []).map((option) => ({
                        label: this.resolveString(option.label, scope) ?? String(option.value),
                        value: String(option.value),
                    })),
                    value: Array.isArray(value) ? value.map(String) : [],
                    path,
                    variant: component.variant ?? "mutuallyExclusive",
                };
            }
            case "Slider": {
                const { path, value } = this.inputValue<number>(key, component.value, scope);
                const min = typeof component.min === "number" ? component.min : 0;
                return {
                    ...base,
                    component: "Slider",
                    label: this.resolveString(component.label, scope),
                    value: typeof value === "number" ? value : min,
                    min,
                    max: typeof component.max === "number" ? component.max : 100,
                    path,
                };
            }
            case "DateTimeInput": {
                const { path, value } = this.inputValue<string>(key, component.value, scope);
                return {
                    ...base,
                    component: "DateTimeInput",
                    label: this.resolveString(component.label, scope),
                    value: typeof value === "string" ? value : "",
                    path,
                    enableDate: component.enableDate ?? false,
                    enableTime: component.enableTime ?? false,
                };
            }
        }
    }
}

/**
 * The surfaces belonging to one A2UI source, keyed by surface id, with routing of server messages to them.
 */
export class A2UISurfaceSet {
    private surfaces = new Map<string, A2UISurface>();

    public constructor(private readonly options: A2UISurfaceOptions = {}) {}

    /** Apply one server-to-client message. Surfaces are created on first use if the agent skipped createSurface. */
    public apply(message: A2UIServerMessage): void {
        if (message.createSurface?.surfaceId) {
            const surface = this.getOrCreate(message.createSurface.surfaceId);
            surface.sendDataModel = message.createSurface.sendDataModel === true;
        }
        if (message.updateComponents?.surfaceId) {
            this.getOrCreate(message.updateComponents.surfaceId).updateComponents(
                Array.isArray(message.updateComponents.components) ? message.updateComponents.components : [],
            );
        }
        if (message.updateDataModel?.surfaceId) {
            this.getOrCreate(message.updateDataModel.surfaceId).updateDataModel(
                message.updateDataModel.path,
                message.updateDataModel.value,
            );
        }
        if (message.deleteSurface?.surfaceId) {
            this.surfaces.delete(message.deleteSurface.surfaceId);
        }
    }

    public get(surfaceId: string): A2UISurface | undefined {
        return this.surfaces.get(surfaceId);
    }

    /** All surfaces in creation order. */
    public all(): A2UISurface[] {
        return [...this.surfaces.values()];
    }

    private getOrCreate(surfaceId: string): A2UISurface {
        let surface = this.surfaces.get(surfaceId);
        if (!surface) {
            surface = new A2UISurface(surfaceId, this.options);
            this.surfaces.set(surfaceId, surface);
        }
        return surface;
    }
}
