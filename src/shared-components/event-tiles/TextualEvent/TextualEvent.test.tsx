/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { composeStories } from "@storybook/react-vite";
import { render } from "jest-matrix-react";
import React from "react";

import * as stories from "./TextualEvent.stories.tsx";

const { Default } = composeStories(stories);

describe("TextualEvent", () => {
    it("renders a textual event", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });
});
