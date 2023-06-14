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

import { toLeftOf, toLeftOrRightOf, toRightOf } from "../../../src/components/structures/ContextMenu";
import UIStore from "../../../src/stores/UIStore";

describe("ContextMenu", () => {
    const rect = new DOMRect();
    // @ts-ignore
    rect.left = 23;
    // @ts-ignore
    rect.right = 46;
    // @ts-ignore
    rect.top = 42;
    rect.width = 640;
    rect.height = 480;

    beforeEach(() => {
        window.scrollX = 31;
        window.scrollY = 41;
        UIStore.instance.windowWidth = 1280;
    });

    describe("toLeftOf", () => {
        it("should return the correct positioning", () => {
            expect(toLeftOf(rect)).toEqual({
                chevronOffset: 12,
                right: 1285, // 1280 - 23 + 31 - 3
                top: 303, // 42 + (480 / 2) + 41 - (12 + 8)
            });
        });
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

    describe("toLeftOrRightOf", () => {
        describe("when there is more space to the right", () => {
            // default case from test setup

            it("should return a position to the right", () => {
                expect(toLeftOrRightOf(rect)).toEqual({
                    chevronOffset: 12,
                    left: 80, // 46 + 31 + 3
                    top: 303, // 42 + (480 / 2) + 41 - (12 + 8)
                });
            });
        });

        describe("when there is more space to the left", () => {
            beforeEach(() => {
                // @ts-ignore
                rect.left = 500;
                // @ts-ignore
                rect.right = 1000;
            });

            it("should return a position to the left", () => {
                expect(toLeftOrRightOf(rect)).toEqual({
                    chevronOffset: 12,
                    right: 808, // 1280 - 500 + 31 - 3
                    top: 303, // 42 + (480 / 2) + 41 - (12 + 8)
                });
            });
        });
    });
});
