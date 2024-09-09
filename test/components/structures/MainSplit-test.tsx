/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
