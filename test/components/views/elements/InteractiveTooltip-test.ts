/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { Direction, mouseWithinRegion } from "../../../../src/components/views/elements/InteractiveTooltip";

describe("InteractiveTooltip", () => {
    describe("mouseWithinRegion", () => {
        it("direction=left", () => {
            const targetRect = {
                width: 20,
                height: 20,
                top: 300,
                right: 370,
                bottom: 320,
                left: 350,
            } as DOMRect;

            const contentRect = {
                width: 100,
                height: 400,
                top: 100,
                right: 200,
                bottom: 500,
                left: 100,
            } as DOMRect;

            // just within top left corner of contentRect
            expect(mouseWithinRegion(101, 101, Direction.Left, targetRect, contentRect)).toBe(true);
            // just outside top left corner of contentRect, within buffer
            expect(mouseWithinRegion(101, 90, Direction.Left, targetRect, contentRect)).toBe(true);
            // just within top right corner of targetRect
            expect(mouseWithinRegion(369, 301, Direction.Left, targetRect, contentRect)).toBe(true);
            // within the top triangular portion of the trapezoid
            expect(mouseWithinRegion(300, 200, Direction.Left, targetRect, contentRect)).toBe(true);
            // within the bottom triangular portion of the trapezoid
            expect(mouseWithinRegion(300, 350, Direction.Left, targetRect, contentRect)).toBe(true);
            // outside the top triangular portion of the trapezoid
            expect(mouseWithinRegion(300, 140, Direction.Left, targetRect, contentRect)).toBe(false);
            // outside the bottom triangular portion of the trapezoid
            expect(mouseWithinRegion(300, 460, Direction.Left, targetRect, contentRect)).toBe(false);
        });

        it("direction=right", () => {
            const targetRect = {
                width: 20,
                height: 20,
                top: 300,
                right: 370,
                bottom: 320,
                left: 350,
            } as DOMRect;

            const contentRect = {
                width: 100,
                height: 400,
                top: 100,
                right: 620,
                bottom: 500,
                left: 520,
            } as DOMRect;

            // just within top right corner of contentRect
            expect(mouseWithinRegion(619, 101, Direction.Right, targetRect, contentRect)).toBe(true);
            // just outside top right corner of contentRect, within buffer
            expect(mouseWithinRegion(619, 90, Direction.Right, targetRect, contentRect)).toBe(true);
            // just within top left corner of targetRect
            expect(mouseWithinRegion(351, 301, Direction.Right, targetRect, contentRect)).toBe(true);
            // within the top triangular portion of the trapezoid
            expect(mouseWithinRegion(420, 200, Direction.Right, targetRect, contentRect)).toBe(true);
            // within the bottom triangular portion of the trapezoid
            expect(mouseWithinRegion(420, 350, Direction.Right, targetRect, contentRect)).toBe(true);
            // outside the top triangular portion of the trapezoid
            expect(mouseWithinRegion(420, 140, Direction.Right, targetRect, contentRect)).toBe(false);
            // outside the bottom triangular portion of the trapezoid
            expect(mouseWithinRegion(420, 460, Direction.Right, targetRect, contentRect)).toBe(false);
        });

        it("direction=top", () => {
            const targetRect = {
                width: 20,
                height: 20,
                top: 300,
                right: 370,
                bottom: 320,
                left: 350,
            } as DOMRect;

            const contentRect = {
                width: 400,
                height: 100,
                top: 100,
                right: 550,
                bottom: 200,
                left: 150,
            } as DOMRect;

            // just within top right corner of contentRect
            expect(mouseWithinRegion(549, 101, Direction.Top, targetRect, contentRect)).toBe(true);
            // just outside top right corner of contentRect, within buffer
            expect(mouseWithinRegion(549, 99, Direction.Top, targetRect, contentRect)).toBe(true);
            // just within bottom left corner of targetRect
            expect(mouseWithinRegion(351, 319, Direction.Top, targetRect, contentRect)).toBe(true);
            // within the left triangular portion of the trapezoid
            expect(mouseWithinRegion(240, 260, Direction.Top, targetRect, contentRect)).toBe(true);
            // within the right triangular portion of the trapezoid
            expect(mouseWithinRegion(480, 260, Direction.Top, targetRect, contentRect)).toBe(true);
            // outside the left triangular portion of the trapezoid
            expect(mouseWithinRegion(220, 260, Direction.Top, targetRect, contentRect)).toBe(false);
            // outside the right triangular portion of the trapezoid
            expect(mouseWithinRegion(500, 260, Direction.Top, targetRect, contentRect)).toBe(false);
        });

        it("direction=bottom", () => {
            const targetRect = {
                width: 20,
                height: 20,
                top: 300,
                right: 370,
                bottom: 320,
                left: 350,
            } as DOMRect;

            const contentRect = {
                width: 400,
                height: 100,
                top: 420,
                right: 550,
                bottom: 520,
                left: 150,
            } as DOMRect;

            // just within bottom left corner of contentRect
            expect(mouseWithinRegion(101, 519, Direction.Bottom, targetRect, contentRect)).toBe(true);
            // just outside bottom left corner of contentRect, within buffer
            expect(mouseWithinRegion(101, 521, Direction.Bottom, targetRect, contentRect)).toBe(true);
            // just within top left corner of targetRect
            expect(mouseWithinRegion(351, 301, Direction.Bottom, targetRect, contentRect)).toBe(true);
            // within the left triangular portion of the trapezoid
            expect(mouseWithinRegion(240, 360, Direction.Bottom, targetRect, contentRect)).toBe(true);
            // within the right triangular portion of the trapezoid
            expect(mouseWithinRegion(480, 360, Direction.Bottom, targetRect, contentRect)).toBe(true);
            // outside the left triangular portion of the trapezoid
            expect(mouseWithinRegion(220, 360, Direction.Bottom, targetRect, contentRect)).toBe(false);
            // outside the right triangular portion of the trapezoid
            expect(mouseWithinRegion(500, 360, Direction.Bottom, targetRect, contentRect)).toBe(false);
        });
    });
});
