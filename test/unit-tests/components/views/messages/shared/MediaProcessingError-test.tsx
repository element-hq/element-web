/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import MediaProcessingError from "../../../../../../src/components/views/messages/shared/MediaProcessingError";

describe("<MediaProcessingError />", () => {
    const defaultProps = {
        className: "test-classname",
        children: "Something went wrong",
    };
    const getComponent = (props = {}) => render(<MediaProcessingError {...defaultProps} {...props} />);

    it("renders", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });
});
