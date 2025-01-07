/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import MessageTimestamp from "../../../../../src/components/views/messages/MessageTimestamp";

jest.mock("../../../../../src/settings/SettingsStore");

describe("MessageTimestamp", () => {
    // Friday Dec 17 2021, 9:09am
    const nowDate = new Date("2021-12-17T08:09:00.000Z");

    const HOUR_MS = 3600000;
    const DAY_MS = HOUR_MS * 24;

    it("should render HH:MM", () => {
        const { asFragment } = render(<MessageTimestamp ts={nowDate.getTime()} />);
        expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <span
    aria-hidden="true"
    aria-live="off"
    class="mx_MessageTimestamp"
  >
    08:09
  </span>
</DocumentFragment>
`);
    });

    it("should show full date & time on hover", async () => {
        const { container } = render(<MessageTimestamp ts={nowDate.getTime()} />);
        await userEvent.hover(container.querySelector(".mx_MessageTimestamp")!);
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(`"Fri, Dec 17, 2021, 08:09:00"`);
    });

    it("should show sent & received time on hover if passed", async () => {
        const { container } = render(
            <MessageTimestamp ts={nowDate.getTime()} receivedTs={nowDate.getTime() + DAY_MS} />,
        );
        await userEvent.hover(container.querySelector(".mx_MessageTimestamp")!);
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(
            `"Sent at: Fri, Dec 17, 2021, 08:09:00Received at: Sat, Dec 18, 2021, 08:09:00"`,
        );
    });
});
