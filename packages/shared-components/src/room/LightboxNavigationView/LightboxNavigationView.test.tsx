/*
 * Copyright 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, expect } from "vitest";

import * as stories from "./LightboxNavigationView.stories";
import {
    LightboxNavigationView,
    type LightboxNavigationViewActions,
    type LightboxNavigationViewSnapshot,
} from "./LightboxNavigationView";
import { MockViewModel } from "../../core/viewmodel/MockViewModel";

const { Default, FirstImage, Navigating } = composeStories(stories);

class TestViewModel extends MockViewModel<LightboxNavigationViewSnapshot> implements LightboxNavigationViewActions {
    public goToPrevious = vi.fn();
    public goToNext = vi.fn();
}

function makeViewModel(snapshot: Partial<LightboxNavigationViewSnapshot> = {}): TestViewModel {
    return new TestViewModel({ canGoToPrevious: true, canGoToNext: true, isNavigating: false, ...snapshot });
}

function view(vm: TestViewModel): React.JSX.Element {
    return (
        <LightboxNavigationView vm={vm}>
            <img alt="Sunset" />
        </LightboxNavigationView>
    );
}

describe("LightboxNavigationView", () => {
    describe("Storybook snapshots", () => {
        it("renders both buttons", () => {
            const { container } = render(<Default />);
            expect(container).toMatchSnapshot();
        });

        it("renders only the next button for the first image", () => {
            const { container } = render(<FirstImage />);
            expect(container).toMatchSnapshot();
        });

        it("renders disabled buttons while navigating", () => {
            const { container } = render(<Navigating />);
            expect(container).toMatchSnapshot();
        });
    });

    it("calls the actions when the buttons are clicked", async () => {
        const user = userEvent.setup();
        const vm = makeViewModel();
        render(view(vm));

        await user.click(screen.getByRole("button", { name: "Previous" }));
        expect(vm.goToPrevious).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", { name: "Next" }));
        expect(vm.goToNext).toHaveBeenCalledTimes(1);
    });

    it("moves focus to the other button when the focused button disappears", () => {
        const { rerender } = render(view(makeViewModel()));
        screen.getByRole("button", { name: "Next" }).focus();

        rerender(view(makeViewModel({ canGoToNext: false })));

        expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();
    });

    it("keeps focus inside the view when the focused button disappears and no other button is left", () => {
        const { rerender } = render(view(makeViewModel({ canGoToNext: false })));
        const previous = screen.getByRole("button", { name: "Previous" });
        const root = previous.closest("[tabindex='-1']");
        previous.focus();

        rerender(view(makeViewModel({ canGoToPrevious: false, canGoToNext: false })));

        expect(root).toHaveFocus();
    });

    it("leaves focus alone when a button disappears that was not focused", () => {
        const { rerender } = render(view(makeViewModel()));
        const outside = document.createElement("button");
        document.body.appendChild(outside);
        outside.focus();

        rerender(view(makeViewModel({ canGoToNext: false })));

        expect(outside).toHaveFocus();
        outside.remove();
    });
});
