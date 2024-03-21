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

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@vector-im/compound-web";

import MessageTimestamp from "../../../../src/components/views/messages/MessageTimestamp";

jest.mock("../../../../src/settings/SettingsStore");

describe("MessageTimestamp", () => {
    // Friday Dec 17 2021, 9:09am
    const nowDate = new Date("2021-12-17T08:09:00.000Z");

    const HOUR_MS = 3600000;
    const DAY_MS = HOUR_MS * 24;

    it("should render HH:MM", () => {
        const { asFragment } = render(<MessageTimestamp ts={nowDate.getTime()} />, { wrapper: TooltipProvider });
        expect(asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <span
                aria-hidden="true"
                aria-live="off"
                class="mx_MessageTimestamp"
                data-state="closed"
              >
                08:09
              </span>
            </DocumentFragment>
        `);
    });

    it("should show full date & time on hover", async () => {
        const { container } = render(<MessageTimestamp ts={nowDate.getTime()} />, { wrapper: TooltipProvider });
        await userEvent.hover(container.querySelector(".mx_MessageTimestamp")!);
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(`"Fri, Dec 17, 2021, 08:09:00"`);
    });

    it("should show sent & received time on hover if passed", async () => {
        const { container } = render(
            <MessageTimestamp ts={nowDate.getTime()} receivedTs={nowDate.getTime() + DAY_MS} />,
            { wrapper: TooltipProvider },
        );
        await userEvent.hover(container.querySelector(".mx_MessageTimestamp")!);
        expect((await screen.findByRole("tooltip")).textContent).toMatchInlineSnapshot(
            `"Sent at: Fri, Dec 17, 2021, 08:09:00Received at: Sat, Dec 18, 2021, 08:09:00"`,
        );
    });
});
