/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render } from "@testing-library/react";

import ContextMenu, { ChevronFace } from "../../../../src/components/structures/ContextMenu";
import UIStore from "../../../../src/stores/UIStore";
import Modal from "../../../../src/Modal";
import BaseDialog from "../../../../src/components/views/dialogs/BaseDialog";

describe("<ContextMenu />", () => {
    // Hardcode window and menu dimensions
    const windowSize = 300;
    const menuSize = 200;
    jest.spyOn(UIStore, "instance", "get").mockImplementation(
        () =>
            ({
                windowWidth: windowSize,
                windowHeight: windowSize,
            } as unknown as UIStore),
    );
    window.Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
        width: menuSize,
        height: menuSize,
    });

    const targetChevronOffset = 25;

    it("near top edge of window", () => {
        const targetY = -50;
        const onFinished = jest.fn();

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
        const onFinished = jest.fn();

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
        const onFinished = jest.fn();

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
        const onFinished = jest.fn();

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
        const onFinished = jest.fn();

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
        const onFinished = jest.fn();

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
