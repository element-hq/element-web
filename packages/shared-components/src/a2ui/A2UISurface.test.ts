/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { A2UISurface, A2UISurfaceSet } from "./A2UISurface";
import { type A2UIComponent } from "./A2UITypes";
import { type A2UIContainerRenderNode, type A2UITextFieldRenderNode } from "./A2UIRenderNode";

const formComponents: A2UIComponent[] = [
    { id: "root", component: "Column", children: ["title", "name", "subscribe", "submit"] },
    { id: "title", component: "Text", text: { path: "/title" }, variant: "h2" },
    { id: "name", component: "TextField", label: "Name", value: { path: "/user/name" } },
    { id: "subscribe", component: "CheckBox", label: "Subscribe", value: { path: "/user/subscribe" } },
    {
        id: "submit",
        component: "Button",
        child: "submitLabel",
        variant: "primary",
        action: {
            event: { name: "submit", context: { formId: "contact", name: { path: "/user/name" } } },
        },
    },
    { id: "submitLabel", component: "Text", text: "Send" },
];

describe("A2UISurface", () => {
    it("resolves nothing until a root component exists", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([{ id: "title", component: "Text", text: "Hi" }]);

        expect(surface.resolve()).toEqual({ surfaceId: "main", root: null });
    });

    it("resolves bindings against the data model and fills in defaults", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents(formComponents);
        surface.updateDataModel("/", { title: "Contact us", user: { name: "Alice", subscribe: true } });

        const root = surface.resolve().root as A2UIContainerRenderNode;

        expect(root.component).toBe("Column");
        expect(root.direction).toBe("column");
        expect(root.align).toBe("stretch");
        expect(root.children).toEqual([
            { id: "title", key: "title", weight: undefined, component: "Text", text: "Contact us", variant: "h2" },
            {
                id: "name",
                key: "name",
                weight: undefined,
                component: "TextField",
                label: "Name",
                value: "Alice",
                path: "/user/name",
                variant: "shortText",
            },
            {
                id: "subscribe",
                key: "subscribe",
                weight: undefined,
                component: "CheckBox",
                label: "Subscribe",
                value: true,
                path: "/user/subscribe",
            },
            {
                id: "submit",
                key: "submit",
                weight: undefined,
                component: "Button",
                variant: "primary",
                enabled: true,
                child: {
                    id: "submitLabel",
                    key: "submitLabel",
                    weight: undefined,
                    component: "Text",
                    text: "Send",
                    variant: "body",
                },
            },
        ]);
    });

    it("applies partial data model updates and deletions", () => {
        const surface = new A2UISurface("main");
        surface.updateDataModel("/", { user: { name: "Alice" } });
        surface.updateDataModel("/user/email", "alice@example.org");
        expect(surface.getDataModel()).toEqual({ user: { name: "Alice", email: "alice@example.org" } });

        surface.updateDataModel("/user/name", undefined);
        expect(surface.getDataModel()).toEqual({ user: { email: "alice@example.org" } });
    });

    it("writes bound input edits through to the data model", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents(formComponents);
        surface.setInputValue("name", "/user/name", "Bob");

        expect(surface.getDataModel()).toEqual({ user: { name: "Bob" } });
        const root = surface.resolve().root as A2UIContainerRenderNode;
        expect((root.children[1] as A2UITextFieldRenderNode).value).toBe("Bob");
    });

    it("remembers edits to inputs that are not bound to the data model", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([{ id: "root", component: "TextField", label: "Note", value: "initial" }]);
        surface.setInputValue("root", undefined, "typed");

        expect(surface.getDataModel()).toBeUndefined();
        expect((surface.resolve().root as A2UITextFieldRenderNode).value).toBe("typed");
    });

    it("resolves button actions with context bindings", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents(formComponents);
        surface.updateDataModel("/", { user: { name: "Alice" } });
        surface.resolve();

        expect(surface.resolveAction("submit")).toEqual({
            name: "submit",
            sourceComponentId: "submit",
            context: { formId: "contact", name: "Alice" },
        });
        expect(surface.resolveAction("title")).toBeNull();
        expect(surface.resolveAction("unknown")).toBeNull();
    });

    it("disables buttons whose action is not a server event", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "Button", child: "label", action: { functionCall: { call: "noop" } } },
            { id: "label", component: "Text", text: "Local" },
        ]);

        expect(surface.resolve().root).toMatchObject({ component: "Button", enabled: false });
        expect(surface.resolveAction("root")).toBeNull();
    });

    it("expands template children with a scope per item", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "List", children: { componentId: "item", path: "/items" } },
            { id: "item", component: "Row", children: ["itemName", "pick"] },
            { id: "itemName", component: "Text", text: { path: "/name" } },
            {
                id: "pick",
                component: "Button",
                child: "itemName",
                action: { event: { name: "pick", context: { id: { path: "/id" } } } },
            },
        ]);
        surface.updateDataModel("/", {
            items: [
                { id: 1, name: "One" },
                { id: 2, name: "Two" },
            ],
        });

        const root = surface.resolve().root as A2UIContainerRenderNode;
        expect(root.children.map((child) => child.key)).toEqual(["item@/items/0", "item@/items/1"]);
        expect((root.children[1] as A2UIContainerRenderNode).children[0]).toMatchObject({
            key: "itemName@/items/1",
            text: "Two",
        });
        expect(surface.resolveAction("pick@/items/0")).toEqual({
            name: "pick",
            sourceComponentId: "pick",
            context: { id: 1 },
        });
    });

    it("renders an empty template when the bound list is missing", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "Column", children: { componentId: "item", path: "/items" } },
            { id: "item", component: "Text", text: "x" },
        ]);

        expect((surface.resolve().root as A2UIContainerRenderNode).children).toEqual([]);
    });

    it("marks unknown component types as unsupported and skips missing children", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "Row", children: ["gauge", "missing"] },
            { id: "gauge", component: "Gauge", value: 3 },
        ]);

        const root = surface.resolve().root as A2UIContainerRenderNode;
        expect(root.children).toEqual([
            { id: "gauge", key: "gauge", weight: undefined, component: "Unsupported", type: "Gauge" },
        ]);
    });

    it("resolves icons by name, by binding or as a custom path", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "Row", children: ["named", "bound", "custom"] },
            { id: "named", component: "Icon", name: "check" },
            { id: "bound", component: "Icon", name: { path: "/icon" } },
            { id: "custom", component: "Icon", name: { svgPath: "M0 0h24v24H0z" } },
        ]);
        surface.updateDataModel("/icon", "warning");

        const root = surface.resolve().root as A2UIContainerRenderNode;
        expect(root.children).toEqual([
            { id: "named", key: "named", weight: undefined, component: "Icon", name: "check" },
            { id: "bound", key: "bound", weight: undefined, component: "Icon", name: "warning" },
            { id: "custom", key: "custom", weight: undefined, component: "Icon", svgPath: "M0 0h24v24H0z" },
        ]);
    });

    it("survives cyclic component references", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "Card", child: "inner" },
            { id: "inner", component: "Card", child: "root" },
        ]);

        expect(() => surface.resolve()).not.toThrow();
    });

    it("only allows http(s) media URLs by default and lets the host override that", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([
            { id: "root", component: "Row", children: ["pic", "clip", "ok"] },
            { id: "pic", component: "Image", url: "mxc://example.org/abc" },
            { id: "clip", component: "Video", url: "mxc://example.org/def" },
            { id: "ok", component: "Video", url: "https://example.org/ok.mp4" },
        ]);
        expect((surface.resolve().root as A2UIContainerRenderNode).children).toEqual([
            {
                id: "pic",
                key: "pic",
                weight: undefined,
                component: "Image",
                url: undefined,
                description: undefined,
                fit: "fill",
                variant: "mediumFeature",
            },
            { id: "clip", key: "clip", weight: undefined, component: "Video", url: undefined },
            { id: "ok", key: "ok", weight: undefined, component: "Video", url: "https://example.org/ok.mp4" },
        ]);

        const converting = new A2UISurface("main", { resolveMediaUrl: (url) => `https://cdn/${url}` });
        converting.updateComponents([{ id: "root", component: "Video", url: "mxc://example.org/abc" }]);
        expect(converting.resolve().root).toMatchObject({
            component: "Video",
            url: "https://cdn/mxc://example.org/abc",
        });
    });

    it("ignores malformed component definitions", () => {
        const surface = new A2UISurface("main");
        surface.updateComponents([{ component: "Text" } as unknown as A2UIComponent, null as unknown as A2UIComponent]);

        expect(surface.resolve().root).toBeNull();
    });
});

describe("A2UISurfaceSet", () => {
    it("routes messages to surfaces by id and creates them on demand", () => {
        const set = new A2UISurfaceSet();
        set.apply({ version: "v0.9", createSurface: { surfaceId: "main", sendDataModel: true } });
        set.apply({
            version: "v0.9",
            updateComponents: {
                surfaceId: "main",
                components: [{ id: "root", component: "Text", text: { path: "/greeting" } }],
            },
        });
        set.apply({ version: "v0.9", updateDataModel: { surfaceId: "main", path: "/greeting", value: "Hello" } });
        set.apply({ version: "v0.9", updateComponents: { surfaceId: "side", components: [] } });

        expect(set.all().map((surface) => surface.surfaceId)).toEqual(["main", "side"]);
        expect(set.get("main")?.sendDataModel).toBe(true);
        expect(set.get("main")?.resolve().root).toMatchObject({ component: "Text", text: "Hello" });
    });

    it("deletes surfaces", () => {
        const set = new A2UISurfaceSet();
        set.apply({ createSurface: { surfaceId: "modal" } });
        set.apply({ deleteSurface: { surfaceId: "modal" } });

        expect(set.all()).toEqual([]);
        expect(set.get("modal")).toBeUndefined();
    });

    it("ignores messages without a known kind", () => {
        const set = new A2UISurfaceSet();
        set.apply({ version: "v0.9" });
        set.apply({} as never);

        expect(set.all()).toEqual([]);
    });
});
