/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "test-utils-rtl";

import ContextMenu, { toRightOf, ChevronFace } from "./ContextMenu";
import UIStore from "../../stores/UIStore";
import Modal from "../../Modal";
import BaseDialog from "../views/dialogs/BaseDialog";

describe("ContextMenu", () => {
    const rect = {
        left: 23,
        right: 46,
        top: 42,
        width: 640,
        height: 480,
    } as DOMRect;

    beforeEach(() => {
        window.scrollX = 31;
        window.scrollY = 41;
        UIStore.instance.windowWidth = 1280;
    });

    describe("toRightOf", () => {
        it("should return the correct positioning", () => {
            expect(toRightOf(rect)).toEqual({
                chevronOffset: 12,
                left: 80, // 46 + 31 + 3
                top: 303, // 42 + (480 / 2) + 41 - (12 + 8)
            });
        });
    });

    describe("<ContextMenu />", () => {
        // Hardcode window and menu dimensions
        const windowSize = 300;
        const menuSize = 200;
        vi.spyOn(UIStore, "instance", "get").mockImplementation(
            () =>
                ({
                    windowWidth: windowSize,
                    windowHeight: windowSize,
                }) as unknown as UIStore,
        );
        window.Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
            width: menuSize,
            height: menuSize,
        });

        const targetChevronOffset = 25;

        it("near top edge of window", () => {
            const targetY = -50;
            const onFinished = vi.fn();

            render(
                <ContextMenu
                    bottom={windowSize - targetY - menuSize}
                    right={menuSize}
                    onFinished={onFinished}
                    chevronFace={ChevronFace.Left}
                    chevronOffset={targetChevronOffset}
                >
                    <React.Fragment />
                </ContextMenu>,
            );
            const chevron = document.querySelector<HTMLElement>(".mx_ContextualMenu_chevron_left")!;

            const bottomStyle = parseInt(
                document.querySelector<HTMLElement>(".mx_ContextualMenu_wrapper")!.style.getPropertyValue("bottom"),
            );
            const actualY = windowSize - bottomStyle - menuSize;
            const actualChevronOffset = parseInt(chevron.style.getPropertyValue("top"));

            // stays within the window
            expect(actualY).toBeGreaterThanOrEqual(0);
            // positions the chevron correctly
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetY - actualY);
        });

        it("near right edge of window", () => {
            const targetX = windowSize - menuSize + 50;
            const onFinished = vi.fn();

            render(
                <ContextMenu
                    bottom={0}
                    onFinished={onFinished}
                    left={targetX}
                    chevronFace={ChevronFace.Top}
                    chevronOffset={targetChevronOffset}
                >
                    <React.Fragment />
                </ContextMenu>,
            );
            const chevron = document.querySelector<HTMLElement>(".mx_ContextualMenu_chevron_top")!;

            const actualX = parseInt(
                document.querySelector<HTMLElement>(".mx_ContextualMenu_wrapper")!.style.getPropertyValue("left"),
            );
            const actualChevronOffset = parseInt(chevron.style.getPropertyValue("left"));

            // stays within the window
            expect(actualX + menuSize).toBeLessThanOrEqual(windowSize);
            // positions the chevron correctly
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetX - actualX);
        });

        it("near bottom edge of window", () => {
            const targetY = windowSize - menuSize + 50;
            const onFinished = vi.fn();

            render(
                <ContextMenu
                    top={targetY}
                    left={0}
                    onFinished={onFinished}
                    chevronFace={ChevronFace.Right}
                    chevronOffset={targetChevronOffset}
                >
                    <React.Fragment />
                </ContextMenu>,
            );
            const chevron = document.querySelector<HTMLElement>(".mx_ContextualMenu_chevron_right")!;

            const actualY = parseInt(
                document.querySelector<HTMLElement>(".mx_ContextualMenu_wrapper")!.style.getPropertyValue("top"),
            );
            const actualChevronOffset = parseInt(chevron.style.getPropertyValue("top"));

            // stays within the window
            expect(actualY + menuSize).toBeLessThanOrEqual(windowSize);
            // positions the chevron correctly
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetY - actualY);
        });

        it("near left edge of window", () => {
            const targetX = -50;
            const onFinished = vi.fn();

            render(
                <ContextMenu
                    top={0}
                    right={windowSize - targetX - menuSize}
                    chevronFace={ChevronFace.Bottom}
                    onFinished={onFinished}
                    chevronOffset={targetChevronOffset}
                >
                    <React.Fragment />
                </ContextMenu>,
            );
            const chevron = document.querySelector<HTMLElement>(".mx_ContextualMenu_chevron_bottom")!;

            const rightStyle = parseInt(
                document.querySelector<HTMLElement>(".mx_ContextualMenu_wrapper")!.style.getPropertyValue("right"),
            );
            const actualX = windowSize - rightStyle - menuSize;
            const actualChevronOffset = parseInt(chevron.style.getPropertyValue("left"));

            // stays within the window
            expect(actualX).toBeGreaterThanOrEqual(0);
            // positions the chevron correctly
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetX - actualX);
        });

        it("should automatically close when a modal is opened", () => {
            const targetX = -50;
            const onFinished = vi.fn();

            render(
                <ContextMenu
                    top={0}
                    right={windowSize - targetX - menuSize}
                    chevronFace={ChevronFace.Bottom}
                    onFinished={onFinished}
                    chevronOffset={targetChevronOffset}
                >
                    <React.Fragment />
                </ContextMenu>,
            );

            expect(onFinished).not.toHaveBeenCalled();
            Modal.createDialog(BaseDialog);
            expect(onFinished).toHaveBeenCalled();
        });

        it("should not automatically close when a modal is opened under the existing one", () => {
            const targetX = -50;
            const onFinished = vi.fn();

            Modal.createDialog(BaseDialog);
            render(
                <ContextMenu
                    top={0}
                    right={windowSize - targetX - menuSize}
                    chevronFace={ChevronFace.Bottom}
                    onFinished={onFinished}
                    chevronOffset={targetChevronOffset}
                >
                    <React.Fragment />
                </ContextMenu>,
            );

            expect(onFinished).not.toHaveBeenCalled();
            Modal.createDialog(BaseDialog, {}, "", false, true);
            expect(onFinished).not.toHaveBeenCalled();
            Modal.appendDialog(BaseDialog);
            expect(onFinished).not.toHaveBeenCalled();
        });
    });
});
