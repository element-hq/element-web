/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { PanelImperativeHandle } from "@element-hq/web-shared-components";
import { AutoCollapse } from "../../../../src/viewmodels/structures/auto-collapse/AutoCollapse";
import { MockPanelHandle } from "./mocks";
import type { CollapseHandler } from "../../../../src/viewmodels/structures/auto-collapse/CollapseHandler";
import { BaseCollapseBehaviour } from "../../../../src/viewmodels/structures/auto-collapse/behaviours/BaseCollapseBehaviour";

let instances: BaseCollapseBehaviour[] = [];

class MockBehaviour extends BaseCollapseBehaviour {
    public constructor(collapseHandler: CollapseHandler) {
        super(collapseHandler);
        instances.push(this);
    }

    public onLeftPanelResized = jest.fn();
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

jest.mock("../../../../src/viewmodels/structures/auto-collapse/behaviours/behaviours", () => {
    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        get Behaviours() {
            return [MockBehaviour, MockBehaviour, MockBehaviourWithIgnoreResize, MockBehaviourWithStartCollapsed];
        },
    };
});

describe("AutoCollapse", () => {
    beforeEach(() => {
        instances = [];
    });

    it("should call onLeftPanelResized of each behaviour", () => {
        const setCollapsed = jest.fn();
        const panelHandle = new MockPanelHandle();
        const autoCollapse = new AutoCollapse(setCollapsed);
        autoCollapse.setHandle(panelHandle as unknown as PanelImperativeHandle);
        autoCollapse.onLeftPanelResized();
        for (const behaviour of instances) {
            expect(behaviour.onLeftPanelResized).toHaveBeenCalledTimes(1);
        }
        expect(autoCollapse.isAutoCollapsed).toBe(false);
    });

    it("should calculate shouldStartCollapsed correctly", () => {
        expect(AutoCollapse.shouldStartCollapsed()).toBe(true);
    });

    it("should calculate shouldIgnoreResize correctly", () => {
        const setCollapsed = jest.fn();
        const panelHandle = new MockPanelHandle();
        const autoCollapse = new AutoCollapse(setCollapsed);
        autoCollapse.setHandle(panelHandle as unknown as PanelImperativeHandle);
        expect(autoCollapse.shouldIgnoreResize).toBe(true);
    });
});
