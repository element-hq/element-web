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
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";

import ContextMenu, { ChevronFace } from "../../../../src/components/structures/ContextMenu";
import UIStore from "../../../../src/stores/UIStore";

describe("<ContextMenu />", () => {
    // Hardcode window and menu dimensions
    const windowSize = 300;
    const menuSize = 200;
    jest.spyOn(UIStore, "instance", "get").mockImplementation(() => ({
        windowWidth: windowSize,
        windowHeight: windowSize,
    }) as unknown as UIStore);
    window.Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
        width: menuSize,
        height: menuSize,
    });

    const targetChevronOffset = 25;

    describe("near top edge of window", () => {
        const targetY = -50;
        const onFinished = jest.fn();

        const wrapper = mount(
            <ContextMenu
                bottom={windowSize - targetY - menuSize}
                right={menuSize}
                onFinished={onFinished}
                chevronFace={ChevronFace.Left}
                chevronOffset={targetChevronOffset}
            />,
        );
        const chevron = wrapper.find(".mx_ContextualMenu_chevron_left");

        const bottomStyle = parseInt(wrapper.getDOMNode<HTMLElement>().style.getPropertyValue("bottom"));
        const actualY = windowSize - bottomStyle - menuSize;
        const actualChevronOffset = parseInt(chevron.getDOMNode<HTMLElement>().style.getPropertyValue("top"));

        it("stays within the window", () => {
            expect(actualY).toBeGreaterThanOrEqual(0);
        });
        it("positions the chevron correctly", () => {
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetY - actualY);
        });
    });

    describe("near right edge of window", () => {
        const targetX = windowSize - menuSize + 50;
        const onFinished = jest.fn();

        const wrapper = mount(
            <ContextMenu
                bottom={0}
                onFinished={onFinished}
                left={targetX}
                chevronFace={ChevronFace.Top}
                chevronOffset={targetChevronOffset}
            />,
        );
        const chevron = wrapper.find(".mx_ContextualMenu_chevron_top");

        const actualX = parseInt(wrapper.getDOMNode<HTMLElement>().style.getPropertyValue("left"));
        const actualChevronOffset = parseInt(chevron.getDOMNode<HTMLElement>().style.getPropertyValue("left"));

        it("stays within the window", () => {
            expect(actualX + menuSize).toBeLessThanOrEqual(windowSize);
        });
        it("positions the chevron correctly", () => {
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetX - actualX);
        });
    });

    describe("near bottom edge of window", () => {
        const targetY = windowSize - menuSize + 50;
        const onFinished = jest.fn();

        const wrapper = mount(
            <ContextMenu
                top={targetY}
                left={0}
                onFinished={onFinished}
                chevronFace={ChevronFace.Right}
                chevronOffset={targetChevronOffset}
            />,
        );
        const chevron = wrapper.find(".mx_ContextualMenu_chevron_right");

        const actualY = parseInt(wrapper.getDOMNode<HTMLElement>().style.getPropertyValue("top"));
        const actualChevronOffset = parseInt(chevron.getDOMNode<HTMLElement>().style.getPropertyValue("top"));

        it("stays within the window", () => {
            expect(actualY + menuSize).toBeLessThanOrEqual(windowSize);
        });
        it("positions the chevron correctly", () => {
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetY - actualY);
        });
    });

    describe("near left edge of window", () => {
        const targetX = -50;
        const onFinished = jest.fn();

        const wrapper = mount(
            <ContextMenu
                top={0}
                right={windowSize - targetX - menuSize}
                chevronFace={ChevronFace.Bottom}
                onFinished={onFinished}
                chevronOffset={targetChevronOffset}
            />,
        );
        const chevron = wrapper.find(".mx_ContextualMenu_chevron_bottom");

        const rightStyle = parseInt(wrapper.getDOMNode<HTMLElement>().style.getPropertyValue("right"));
        const actualX = windowSize - rightStyle - menuSize;
        const actualChevronOffset = parseInt(chevron.getDOMNode<HTMLElement>().style.getPropertyValue("left"));

        it("stays within the window", () => {
            expect(actualX).toBeGreaterThanOrEqual(0);
        });
        it("positions the chevron correctly", () => {
            expect(actualChevronOffset).toEqual(targetChevronOffset + targetX - actualX);
        });
    });
});
