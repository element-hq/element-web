/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomListAccessibilityPlugin, type RoomListAccessibilityOptions } from "./RoomListAccessibilityPlugin";

// ---------------------------------------------------------------------------
// Minimal mock manager compatible with the @dnd-kit/abstract Plugin base class
// ---------------------------------------------------------------------------

type EventHandler = (event: unknown) => void;

function createMockManager(): {
    monitor: { addEventListener: ReturnType<typeof vi.fn> };
    registry: {
        draggables: { readonly value: IterableIterator<{ handle: HTMLElement | null; element: HTMLElement | null }> };
    };
    dispatch: (eventName: string, event: unknown) => void;
    draggableElements: { handle: HTMLElement | null; element: HTMLElement | null }[];
} {
    const listeners = new Map<string, EventHandler[]>();

    const monitor = {
        addEventListener: vi.fn((eventName: string, handler: EventHandler) => {
            if (!listeners.has(eventName)) listeners.set(eventName, []);
            listeners.get(eventName)!.push(handler);
            return vi.fn(() => {
                const fns = listeners.get(eventName);
                if (fns) {
                    const idx = fns.indexOf(handler);
                    if (idx >= 0) fns.splice(idx, 1);
                }
            });
        }),
    };

    // A list of fake draggable objects the effect iterates over.
    const draggableElements: { handle: HTMLElement | null; element: HTMLElement | null }[] = [];

    const registry = {
        draggables: {
            // Plain (non-reactive) getter – the effect runs once on construction.
            get value() {
                return draggableElements.values();
            },
        },
    };

    /** Trigger a monitor event on all registered handlers. */
    const dispatch = (eventName: string, event: unknown): void => {
        listeners.get(eventName)?.forEach((fn) => fn(event));
    };

    return { monitor, registry, dispatch, draggableElements };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPlugin(
    manager: ReturnType<typeof createMockManager>,
    options?: RoomListAccessibilityOptions,
): RoomListAccessibilityPlugin {
    // RoomListAccessibilityPlugin extends Plugin<DragDropManager> from @dnd-kit/abstract.
    // The base class only requires manager.monitor and manager.registry to exist, which our
    // mock satisfies.
    return new RoomListAccessibilityPlugin(manager as never, options);
}

function getLiveRegion(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[role='status'][aria-live='polite']");
}

function getInstructions(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[style*='display: none']");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RoomListAccessibilityPlugin", () => {
    let manager: ReturnType<typeof createMockManager>;

    beforeEach(() => {
        manager = createMockManager();
    });

    afterEach(() => {
        // Clean up any DOM nodes left behind by tests that don't call destroy().
        getLiveRegion()?.remove();
        getInstructions()?.remove();
    });

    describe("construction", () => {
        it("appends a polite aria-live region to the document body", () => {
            const plugin = createPlugin(manager);

            const region = getLiveRegion();
            expect(region).not.toBeNull();
            expect(region).toBeInTheDocument();
            expect(region).toHaveAttribute("role", "status");
            expect(region).toHaveAttribute("aria-live", "polite");
            expect(region).toHaveAttribute("aria-atomic", "true");

            plugin.destroy();
        });

        it("appends a hidden instructions element when the instructions option is provided", () => {
            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });

            const el = getInstructions();
            expect(el).not.toBeNull();
            expect(el).toBeInTheDocument();
            expect(el?.textContent).toBe("Press Space to drag");
            expect(el?.style.display).toBe("none");

            plugin.destroy();
        });

        it("does not append an instructions element when the option is omitted", () => {
            const plugin = createPlugin(manager);
            expect(getInstructions()).toBeNull();
            plugin.destroy();
        });

        it("adds aria-describedby pointing to the instructions element on existing draggables", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-label", "Toggle Favourites section");
            document.body.append(button);

            manager.draggableElements.push({ handle: button, element: button });

            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });

            // The ID is a generated UUID — verify the button points to the instructions element.
            const instructionsId = button.getAttribute("aria-describedby");
            expect(instructionsId).toBeTruthy();
            expect(document.getElementById(instructionsId!)).toBe(getInstructions());

            button.remove();
            plugin.destroy();
        });

        it("does not overwrite an existing aria-describedby on a draggable", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-describedby", "my-existing-id");
            document.body.append(button);

            manager.draggableElements.push({ handle: button, element: button });

            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });

            expect(button).toHaveAttribute("aria-describedby", "my-existing-id");

            button.remove();
            plugin.destroy();
        });
    });

    describe("dragstart and dragover announcements", () => {
        it("writes a dragstart message to the live region", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragstart: () => "Dragging Favourites" },
            });

            manager.dispatch("dragstart", {});

            expect(getLiveRegion()?.textContent).toBe("Dragging Favourites");

            plugin.destroy();
        });

        it("writes a dragover message to the live region", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragover: () => "Dragging Favourites over Low Priority" },
            });

            manager.dispatch("dragover", {});

            expect(getLiveRegion()?.textContent).toBe("Dragging Favourites over Low Priority");

            plugin.destroy();
        });

        it("does not update the live region when the getter returns undefined", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragstart: () => undefined },
            });

            manager.dispatch("dragstart", {});

            expect(getLiveRegion()?.textContent).toBe("");

            plugin.destroy();
        });

        it("does not update the live region when the message is the same as the current text", () => {
            const get = vi.fn(() => "Dragging Favourites");
            const plugin = createPlugin(manager, {
                announcements: { dragstart: get },
            });

            manager.dispatch("dragstart", {});
            manager.dispatch("dragstart", {});

            // The getter was called twice but the live region text is set only once (dedup).
            expect(get).toHaveBeenCalledTimes(2);
            expect(getLiveRegion()?.textContent).toBe("Dragging Favourites");

            plugin.destroy();
        });

        it("passes the raw dnd-kit event to the announcement getter", () => {
            const getter = vi.fn(() => "Dragging Favourites");
            const plugin = createPlugin(manager, {
                announcements: { dragstart: getter },
            });

            const fakeEvent = { operation: { source: { id: "fav" } } };
            manager.dispatch("dragstart", fakeEvent);

            expect(getter).toHaveBeenCalledWith(fakeEvent);

            plugin.destroy();
        });
    });

    describe("dragend announcement", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("swaps the source element's aria-label to the drop message and triggers blur then focus", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-label", "Toggle Favourites section");
            document.body.append(button);

            const blurSpy = vi.spyOn(button, "blur");
            const focusSpy = vi.spyOn(button, "focus");

            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Favourites was dropped on Low Priority" },
            });

            manager.dispatch("dragend", { operation: { source: { element: button } } });

            expect(button).toHaveAttribute("aria-label", "Favourites was dropped on Low Priority");
            expect(blurSpy).toHaveBeenCalledOnce();
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

            button.remove();
            plugin.destroy();
        });

        it("restores the original aria-label after 1 second", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-label", "Toggle Favourites section");
            document.body.append(button);

            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Favourites was dropped on Low Priority" },
            });

            manager.dispatch("dragend", { operation: { source: { element: button } } });
            expect(button).toHaveAttribute("aria-label", "Favourites was dropped on Low Priority");

            vi.advanceTimersByTime(1000);

            expect(button).toHaveAttribute("aria-label", "Toggle Favourites section");

            button.remove();
            plugin.destroy();
        });

        it("prefers the handle element over the root element when both are present", () => {
            const handle = document.createElement("button");
            handle.setAttribute("aria-label", "Toggle Favourites section");
            const root = document.createElement("div");
            document.body.append(handle, root);

            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Dropped" },
            });

            manager.dispatch("dragend", { operation: { source: { handle, element: root } } });

            expect(handle).toHaveAttribute("aria-label", "Dropped");
            expect(root).not.toHaveAttribute("aria-label");

            handle.remove();
            root.remove();
            plugin.destroy();
        });

        it("falls back to the live region when the source element has no aria-label", () => {
            const div = document.createElement("div");
            document.body.append(div);

            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Dropped" },
            });

            manager.dispatch("dragend", { operation: { source: { element: div } } });

            // No label swap took place; the live region was used instead.
            expect(div).not.toHaveAttribute("aria-label");
            expect(getLiveRegion()?.textContent).toBe("Dropped");

            div.remove();
            plugin.destroy();
        });

        it("falls back to the live region when the source has no element", () => {
            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Dropped" },
            });

            manager.dispatch("dragend", { operation: { source: null } });

            expect(getLiveRegion()?.textContent).toBe("Dropped");

            plugin.destroy();
        });

        it("does nothing when the getter returns undefined", () => {
            const button = document.createElement("button");
            button.setAttribute("aria-label", "Toggle Favourites section");
            document.body.append(button);

            const plugin = createPlugin(manager, {
                announcements: { dragend: () => undefined },
            });

            manager.dispatch("dragend", { operation: { source: { element: button } } });

            // aria-label unchanged, live region empty.
            expect(button).toHaveAttribute("aria-label", "Toggle Favourites section");
            expect(getLiveRegion()?.textContent).toBe("");

            button.remove();
            plugin.destroy();
        });
    });

    describe("destroy", () => {
        it("removes the live region from the document", () => {
            const plugin = createPlugin(manager);
            expect(getLiveRegion()).not.toBeNull();

            plugin.destroy();

            expect(getLiveRegion()).toBeNull();
        });

        it("removes the instructions element from the document", () => {
            const plugin = createPlugin(manager, { instructions: "Press Space to drag" });
            expect(getInstructions()).not.toBeNull();

            plugin.destroy();

            expect(getInstructions()).toBeNull();
        });

        it("calls the unsubscribe functions returned by monitor.addEventListener", () => {
            // Capture the unsubscribe function spy that the mock returns.
            let unsubscribeSpy: ReturnType<typeof vi.fn> | undefined;
            manager.monitor.addEventListener.mockImplementation((_eventName: string, _handler: EventHandler) => {
                unsubscribeSpy = vi.fn();
                return unsubscribeSpy as unknown as ReturnType<typeof vi.fn<() => void>>;
            });

            const plugin = createPlugin(manager, {
                announcements: { dragstart: () => "Dragging" },
            });

            plugin.destroy();

            expect(unsubscribeSpy).toHaveBeenCalled();
        });

        it("cancels pending aria-label restore timeouts", () => {
            vi.useFakeTimers();

            const button = document.createElement("button");
            button.setAttribute("aria-label", "Toggle Favourites section");
            document.body.append(button);

            const plugin = createPlugin(manager, {
                announcements: { dragend: () => "Favourites was dropped on Low Priority" },
            });

            manager.dispatch("dragend", { operation: { source: { element: button } } });

            // Destroy before the 1-second restore fires.
            plugin.destroy();

            // Advance past the restore delay – the label should NOT have been reset because the
            // timer was cancelled, and the plugin is gone anyway.
            vi.advanceTimersByTime(2000);

            // The label stays as the drop message since the restore was cancelled.
            expect(button).toHaveAttribute("aria-label", "Favourites was dropped on Low Priority");

            button.remove();
            vi.useRealTimers();
        });
    });
});
