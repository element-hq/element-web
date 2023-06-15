/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import MainSplit from "../../../src/components/structures/MainSplit";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";

describe("<MainSplit/>", () => {
    const resizeNotifier = new ResizeNotifier();
    const children = (
        <div>
            Child<span>Foo</span>Bar
        </div>
    );
    const panel = <div>Right panel</div>;

    it("renders", () => {
        const { asFragment, container } = render(
            <MainSplit resizeNotifier={resizeNotifier} children={children} panel={panel} />,
        );
        expect(asFragment()).toMatchSnapshot();
        // Assert it matches the default width of 350
        expect(container.querySelector<HTMLElement>(".mx_RightPanel_ResizeWrapper")!.style.width).toBe("350px");
    });

    it("respects defaultSize prop", () => {
        const { asFragment, container } = render(
            <MainSplit resizeNotifier={resizeNotifier} children={children} panel={panel} defaultSize={500} />,
        );
        expect(asFragment()).toMatchSnapshot();
        // Assert it matches the default width of 350
        expect(container.querySelector<HTMLElement>(".mx_RightPanel_ResizeWrapper")!.style.width).toBe("500px");
    });

    it("prefers size stashed in LocalStorage to the defaultSize prop", () => {
        localStorage.setItem("mx_rhs_size_thread", "333");
        const { container } = render(
            <MainSplit
                resizeNotifier={resizeNotifier}
                children={children}
                panel={panel}
                sizeKey="thread"
                defaultSize={400}
            />,
        );
        expect(container.querySelector<HTMLElement>(".mx_RightPanel_ResizeWrapper")!.style.width).toBe("333px");
    });
});
