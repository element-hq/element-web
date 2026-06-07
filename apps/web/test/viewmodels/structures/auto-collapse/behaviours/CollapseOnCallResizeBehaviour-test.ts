/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import EventEmitter from "events";

import { CallStore, CallStoreEvent } from "../../../../../src/stores/CallStore";
import { CollapseOnCallResizeBehaviour } from "../../../../../src/viewmodels/structures/auto-collapse/behaviours/CollapseOnCallResizeBehaviour";
import { CollapseHandler } from "../../../../../src/viewmodels/structures/auto-collapse/CollapseHandler";

jest.useFakeTimers();

// CallStore has a circular dependency, CallStore -> Call -> ... -> Algorithm -> CallStore
jest.mock("../../../../../src/models/Call");

describe("CollapseOnCallResizeBehaviour", () => {
    it("Should collapse/expand the panel on call", () => {
        const MockCallStore = new EventEmitter();
        jest.spyOn(CallStore, "instance", "get").mockReturnValue(MockCallStore as CallStore);

        const expandPanel = jest.fn();
        const collapsePanel = jest.fn();
        const collapseHandler = new CollapseHandler(expandPanel, collapsePanel, 0);
        // @ts-ignore unused variable
        const behaviour = new CollapseOnCallResizeBehaviour(collapseHandler);

        // No calls yet
        expect(expandPanel).not.toHaveBeenCalled();
        expect(collapsePanel).not.toHaveBeenCalled();

        // Let's say we get a call
        MockCallStore.emit(CallStoreEvent.ConnectedCalls, new Set([1]));
        expect(collapsePanel).toHaveBeenCalledTimes(1);

        // When the call is over
        MockCallStore.emit(CallStoreEvent.ConnectedCalls, new Set([]));
        expect(expandPanel).toHaveBeenCalledTimes(1);
    });

    it("should set shouldIgnoreResize to true on call", () => {
        const MockCallStore = new EventEmitter();
        jest.spyOn(CallStore, "instance", "get").mockReturnValue(MockCallStore as CallStore);

        const expandPanel = jest.fn();
        const collapsePanel = jest.fn();
        const collapseHandler = new CollapseHandler(expandPanel, collapsePanel, 0);
        const behaviour = new CollapseOnCallResizeBehaviour(collapseHandler);

        // Initially shouldIgnoreResize should be false
        expect(behaviour.shouldIgnoreResize).toBe(false);
        // Let's say we get a call
        MockCallStore.emit(CallStoreEvent.ConnectedCalls, new Set([1]));
        // shouldIgnoreResize becomes true
        expect(behaviour.shouldIgnoreResize).toBe(true);
        // shouldIgnoreResize becomes false after some time
        jest.runAllTimers();
        expect(behaviour.shouldIgnoreResize).toBe(false);
    });
});
