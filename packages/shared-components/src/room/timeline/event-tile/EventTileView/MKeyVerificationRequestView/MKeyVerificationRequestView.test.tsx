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
import { MKeyVerificationRequestView } from "./MKeyVerificationRequestView";
import * as stories from "./MKeyVerificationRequestView.stories";

const { Received, SentByMe, WithTimestamp } = composeStories(stories);

describe("MKeyVerificationRequestView", () => {
    it("renders the Received story", () => {
        const { container } = render(<Received />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("Alice wants to verify")).toBeInTheDocument();
        expect(screen.getByText("Alice (@alice:example.org)")).toBeInTheDocument();
    });

    it("renders the SentByMe story", () => {
        const { container } = render(<SentByMe />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("You sent a verification request")).toBeInTheDocument();
        expect(screen.getByText("Bob (@bob:example.org)")).toBeInTheDocument();
    });

    it("renders a timestamp", () => {
        const { container } = render(<WithTimestamp />);

        expect(container).toMatchSnapshot();
        expect(screen.getByText("14:56")).toBeInTheDocument();
    });

    it("applies a custom className to the root element", () => {
        const vm = new MockViewModel({
            title: "Alice wants to verify",
            subtitle: "Alice (@alice:example.org)",
        });
        const { container } = render(<MKeyVerificationRequestView vm={vm} className="custom-verification" />);

        expect(container.firstChild).toHaveClass("custom-verification");
    });

    it("forwards the provided ref to the root element", () => {
        const ref = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
        const vm = new MockViewModel({
            title: "Alice wants to verify",
            subtitle: "Alice (@alice:example.org)",
        });

        render(<MKeyVerificationRequestView vm={vm} ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current).toHaveTextContent("Alice wants to verify");
    });
});
