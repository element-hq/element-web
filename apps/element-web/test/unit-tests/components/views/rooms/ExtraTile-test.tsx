/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getByRole, render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React, { type ComponentProps } from "react";

import ExtraTile from "../../../../../src/components/views/rooms/ExtraTile";

describe("ExtraTile", () => {
    function renderComponent(props: Partial<ComponentProps<typeof ExtraTile>> = {}) {
        const defaultProps: ComponentProps<typeof ExtraTile> = {
            isMinimized: false,
            isSelected: false,
            displayName: "test",
            avatar: <React.Fragment />,
            onClick: () => {},
        };
        return render(<ExtraTile {...defaultProps} {...props} />);
    }

    it("renders", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchSnapshot();
    });

    it("hides text when minimized", () => {
        const { container } = renderComponent({
            isMinimized: true,
            displayName: "testDisplayName",
        });
        expect(container).not.toHaveTextContent("testDisplayName");
    });

    it("registers clicks", async () => {
        const onClick = jest.fn();

        const { container } = renderComponent({
            onClick,
        });

        const btn = getByRole(container, "treeitem");

        await userEvent.click(btn);

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
