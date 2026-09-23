/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { composeStories } from "@storybook/react-vite";
import { render, screen } from "@test-utils";
import React from "react";
import { describe, expect, it } from "vitest";

import { MockViewModel } from "../../../../../core/viewmodel";
import { MJitsiWidgetEventView } from "./MJitsiWidgetEventView";
import * as stories from "./MJitsiWidgetEventView.stories";

const { Started, Updated, Ended, Hidden, WithTimestamp } = composeStories(stories);

describe("MJitsiWidgetEventView", () => {
    it("renders the Started story", () => {
        const { container } = render(<Started />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Video conference started by Alice")).toBeInTheDocument();
        expect(screen.getByText("Join the conference at the top of this room")).toBeInTheDocument();
    });

    it("renders the Updated story", () => {
        const { container } = render(<Updated />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Video conference updated by Alice")).toBeInTheDocument();
        expect(screen.getByText("Join the conference from the room information card on the right")).toBeInTheDocument();
    });

    it("renders the Ended story without a subtitle", () => {
        const { container } = render(<Ended />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Video conference ended by Alice")).toBeInTheDocument();
        expect(screen.queryByText(/Join the conference/)).not.toBeInTheDocument();
    });

    it("renders nothing when hidden", () => {
        const { container } = render(<Hidden />);

        expect(container).toMatchSnapshot();
        expect(screen.queryByText(/Video conference/)).not.toBeInTheDocument();
    });

    it("renders a timestamp", () => {
        const { container } = render(<WithTimestamp />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("14:56")).toBeInTheDocument();
    });

    it("applies a custom className to the root element", () => {
        const vm = new MockViewModel({
            isVisible: true,
            title: "Video conference started by Alice",
            subtitle: null,
        });
        const { container } = render(<MJitsiWidgetEventView vm={vm} className="custom-jitsi" />);

        expect(container.firstChild).toHaveClass("custom-jitsi");
    });

    it("forwards the provided ref to the root element", () => {
        const ref = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
        const vm = new MockViewModel({
            isVisible: true,
            title: "Video conference started by Alice",
            subtitle: null,
        });

        render(<MJitsiWidgetEventView vm={vm} ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current).toHaveTextContent("Video conference started by Alice");
    });
});
