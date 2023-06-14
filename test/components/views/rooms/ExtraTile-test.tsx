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

import { getByRole, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { ComponentProps } from "react";

import ExtraTile from "../../../../src/components/views/rooms/ExtraTile";

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
