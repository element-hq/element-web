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

import React, { MouseEventHandler } from "react";
import { screen, render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PictureInPictureDragger, { CreatePipChildren } from "../../../src/components/structures/PictureInPictureDragger";

describe("PictureInPictureDragger", () => {
    let renderResult: RenderResult;

    const mkContent1: Array<CreatePipChildren> = [
        () => {
            return <div>content 1</div>;
        },
    ];

    const mkContent2: Array<CreatePipChildren> = [
        () => {
            return (
                <div>
                    content 2<br />
                    content 2.2
                </div>
            );
        },
    ];

    describe("when rendering the dragger with PiP content 1", () => {
        beforeEach(() => {
            renderResult = render(<PictureInPictureDragger draggable={true}>{mkContent1}</PictureInPictureDragger>);
        });

        it("should render the PiP content", () => {
            expect(renderResult.container).toMatchSnapshot("pip-content-1");
        });

        describe("and rerendering PiP content 1", () => {
            beforeEach(() => {
                renderResult.rerender(<PictureInPictureDragger draggable={true}>{mkContent1}</PictureInPictureDragger>);
            });

            it("should not change the PiP content", () => {
                expect(renderResult.container).toMatchSnapshot("pip-content-1");
            });
        });

        describe("and rendering PiP content 2", () => {
            beforeEach(() => {
                renderResult.rerender(<PictureInPictureDragger draggable={true}>{mkContent2}</PictureInPictureDragger>);
            });

            it("should update the PiP content", () => {
                expect(renderResult.container).toMatchSnapshot();
            });
        });
    });

    describe("when rendering the dragger with PiP content 1 and 2", () => {
        beforeEach(() => {
            renderResult = render(
                <PictureInPictureDragger draggable={true}>{[...mkContent1, ...mkContent2]}</PictureInPictureDragger>,
            );
        });

        it("should render both contents", () => {
            expect(renderResult.container).toMatchSnapshot();
        });
    });

    describe("when rendering the dragger", () => {
        let clickSpy: jest.Mocked<MouseEventHandler>;
        let target: HTMLElement;

        beforeEach(() => {
            clickSpy = jest.fn();
            render(
                <PictureInPictureDragger draggable={true}>
                    {[
                        ({ onStartMoving }) => (
                            <div onMouseDown={onStartMoving} onClick={clickSpy}>
                                Hello
                            </div>
                        ),
                    ]}
                </PictureInPictureDragger>,
            );
            target = screen.getByText("Hello");
        });

        it("and clicking without a drag motion, it should pass the click to children", async () => {
            await userEvent.pointer([{ keys: "[MouseLeft>]", target }, { keys: "[/MouseLeft]" }]);
            expect(clickSpy).toHaveBeenCalled();
        });

        it("and clicking with a drag motion above the threshold of 5px, it should not pass the click to children", async () => {
            await userEvent.pointer([{ keys: "[MouseLeft>]", target }, { coords: { x: 60, y: 2 } }, "[/MouseLeft]"]);
            expect(clickSpy).not.toHaveBeenCalled();
        });

        it("and clickign with a drag motion below the threshold of 5px, it should pass the click to the children", async () => {
            await userEvent.pointer([{ keys: "[MouseLeft>]", target }, { coords: { x: 4, y: 4 } }, "[/MouseLeft]"]);
            expect(clickSpy).toHaveBeenCalled();
        });
    });
});
