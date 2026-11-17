/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React, { useLayoutEffect } from "react";
import { render } from "test-utils-rtl";
// oxlint-disable-next-line no-restricted-imports
import { EventEmitter } from "events";

import { useEventEmitter } from "./useEventEmitter";

describe("useEventEmitter", () => {
    it("calls the handler with the event's arguments until unmounted", () => {
        const emitter = new EventEmitter();
        const handler = vi.fn();
        const Listener: React.FC = () => {
            useEventEmitter(emitter, "event", handler);
            return null;
        };

        const { unmount } = render(<Listener />);
        emitter.emit("event", 1, "two");
        expect(handler).toHaveBeenCalledWith(1, "two");

        unmount();
        emitter.emit("event");
        expect(handler).toHaveBeenCalledTimes(1);
        expect(emitter.listenerCount("event")).toBe(0);
    });

    it("removes the same listener it added, even after re-rendering with a new handler", () => {
        const emitter = new EventEmitter();
        const on = vi.spyOn(emitter, "on");
        const off = vi.spyOn(emitter, "off");
        const Listener: React.FC<{ handler: () => void }> = ({ handler }) => {
            useEventEmitter(emitter, "event", handler);
            return null;
        };

        const { rerender, unmount } = render(<Listener handler={vi.fn()} />);
        // A new handler gives a new function from useEffectEvent, but must not change what is removed
        rerender(<Listener handler={vi.fn()} />);
        unmount();

        expect(on).toHaveBeenCalledTimes(1);
        expect(off).toHaveBeenCalledTimes(1);
        expect(off).toHaveBeenCalledWith("event", on.mock.calls[0][1]);
    });

    it("moves its listener to the new event when the event name changes", () => {
        const emitter = new EventEmitter();
        const on = vi.spyOn(emitter, "on");
        const off = vi.spyOn(emitter, "off");
        const Listener: React.FC<{ eventName: string }> = ({ eventName }) => {
            useEventEmitter(emitter, eventName, vi.fn());
            return null;
        };

        const { rerender, unmount } = render(<Listener eventName="first" />);
        rerender(<Listener eventName="second" />);
        unmount();

        expect(on.mock.calls.map(([eventName]) => eventName)).toEqual(["first", "second"]);
        expect(off.mock.calls).toEqual(on.mock.calls);
        expect(emitter.listenerCount("first") + emitter.listenerCount("second")).toBe(0);
    });

    it("calls the handler from the latest render as soon as that render is committed", () => {
        const emitter = new EventEmitter();
        const seen: string[] = [];
        const Listener: React.FC<{ value: string }> = ({ value }) => {
            useEventEmitter(emitter, "event", () => seen.push(value));
            // Layout effects run while the render is being committed, before any passive effect
            useLayoutEffect(() => {
                emitter.emit("event");
            }, [value]);
            return null;
        };

        // The first render's event goes unheard, as the listener is only added once that render's effects run
        const { rerender } = render(<Listener value="first" />);
        rerender(<Listener value="second" />);

        expect(seen).toEqual(["second"]);
    });

    it("does not listen when there is no emitter", () => {
        const handler = vi.fn();
        const Listener: React.FC = () => {
            useEventEmitter(undefined, "event", handler);
            return null;
        };

        expect(() => render(<Listener />)).not.toThrow();
    });
});
