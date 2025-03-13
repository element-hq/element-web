/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, fireEvent } from "jest-matrix-react";

import MainSplit from "../../../../src/components/structures/MainSplit";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { PosthogAnalytics } from "../../../../src/PosthogAnalytics.ts";

describe("<MainSplit/>", () => {
    const resizeNotifier = new ResizeNotifier();
    const children = (
        <div>
            Child<span>Foo</span>Bar
        </div>
    );
    const panel = <div>Right panel</div>;

    beforeEach(() => {
        localStorage.clear();
    });

    it("renders", () => {
        const { asFragment, container } = render(
            <MainSplit
                resizeNotifier={resizeNotifier}
                children={children}
                panel={panel}
                analyticsRoomType="other_room"
            />,
        );
        expect(asFragment()).toMatchSnapshot();
        // Assert it matches the default width of 320
        expect(container.querySelector<HTMLElement>(".mx_RightPanel_ResizeWrapper")!.style.width).toBe("320px");
    });

    it("respects defaultSize prop", () => {
        const { asFragment, container } = render(
            <MainSplit
                resizeNotifier={resizeNotifier}
                children={children}
                panel={panel}
                defaultSize={500}
                analyticsRoomType="other_room"
            />,
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
                analyticsRoomType="other_room"
            />,
        );
        expect(container.querySelector<HTMLElement>(".mx_RightPanel_ResizeWrapper")!.style.width).toBe("333px");
    });

    it("should report to analytics on resize stop", () => {
        const { container } = render(
            <MainSplit
                resizeNotifier={resizeNotifier}
                children={children}
                panel={panel}
                sizeKey="thread"
                defaultSize={400}
                analyticsRoomType="other_room"
            />,
        );

        const spy = jest.spyOn(PosthogAnalytics.instance, "trackEvent");

        const handle = container.querySelector(".mx_ResizeHandle--horizontal")!;
        fireEvent.mouseDown(handle);
        fireEvent.resize(handle, { clientX: 0 });
        fireEvent.mouseUp(handle);

        expect(spy).toHaveBeenCalledWith({
            eventName: "WebPanelResize",
            panel: "right",
            roomType: "other_room",
            size: 400,
        });
    });
});
