/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import PresenceLabel from "../../../../../src/components/views/rooms/PresenceLabel";

describe("<PresenceLabel/>", () => {
    it("should render 'Offline' for presence=offline", () => {
        const { asFragment } = render(<PresenceLabel presenceState="offline" />);
        expect(asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <div
                class="mx_PresenceLabel"
              >
                Offline
              </div>
            </DocumentFragment>
        `);
    });

    it("should render 'Unreachable' for presence=unreachable", () => {
        const { asFragment } = render(<PresenceLabel presenceState="io.element.unreachable" />);
        expect(asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <div
                class="mx_PresenceLabel"
              >
                User's server unreachable
              </div>
            </DocumentFragment>
        `);
    });
});
