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
import { render, RenderResult } from "@testing-library/react";

import PictureInPictureDragger, {
    CreatePipChildren,
} from "../../../../src/components/views/voip/PictureInPictureDragger";

describe("PictureInPictureDragger", () => {
    let renderResult: RenderResult;

    const mkContent1: CreatePipChildren = () => {
        return <div>content 1</div>;
    };

    const mkContent2: CreatePipChildren = () => {
        return (
            <div>
                content 2<br />
                content 2.2
            </div>
        );
    };

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
});
