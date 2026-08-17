/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, expect, beforeEach, it, vi } from "vitest";
import { AutoCollapse } from "./AutoCollapse";
import { BaseCollapseBehaviour } from "./behaviours/BaseCollapseBehaviour";
import type { CollapseHandler } from "./CollapseHandler";
import { CallStore } from "../../../stores/CallStore";

let instances: BaseCollapseBehaviour[] = [];

class MockBehaviour extends BaseCollapseBehaviour {
    public constructor(collapseHandler: CollapseHandler) {
        super(collapseHandler);
        instances.push(this);
    }

    public onLeftPanelResized = vi.fn();
}

class MockBehaviourWithStartCollapsed extends MockBehaviour {
    public static shouldStartCollapsed(): boolean {
        return true;
    }
}

class MockBehaviourWithIgnoreResize extends MockBehaviour {
    public get shouldIgnoreResize(): boolean {
        return true;
    }
}

vi.mock("../../../../src/viewmodels/structures/auto-collapse/behaviours/behaviours", () => {
    return {
        get Behaviours() {
            return [MockBehaviour, MockBehaviour, MockBehaviourWithIgnoreResize, MockBehaviourWithStartCollapsed];
        },
    };
});

describe("AutoCollapse", () => {
    beforeEach(() => {
        instances = [];
    });

    it("should calculate initial collapse count correctly", () => {
        const autoCollapse = new AutoCollapse(vi.fn(), vi.fn(), CallStore.instance);
        // Since we have one behaviour that tells the app to start collapsed (MockBehaviourWithStartCollapsed),
        // isAutoCollapsed should be true from initialization.
        expect(autoCollapse.isAutoCollapsed).toBe(true);
    });

    it("should proxy onLeftPanelResized to collapseHandler", () => {
        const autoCollapse = new AutoCollapse(vi.fn(), vi.fn(), CallStore.instance);
        expect(autoCollapse.isAutoCollapsed).toBe(true);
        autoCollapse.onLeftPanelResized();
        expect(autoCollapse.isAutoCollapsed).toBe(false);
    });

    it("should calculate shouldStartCollapsed correctly", () => {
        expect(AutoCollapse.shouldStartCollapsed()).toBe(true);
    });

    it("should calculate shouldIgnoreResize correctly", () => {
        const autoCollapse = new AutoCollapse(vi.fn(), vi.fn(), CallStore.instance);
        // Because of MockBehaviourWithIgnoreResize, shouldIgnoreResize should be true.
        expect(autoCollapse.shouldIgnoreResize).toBe(true);
    });
});
