/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import AvatarPresenceIconView from "../../../../../../src/components/views/rooms/MemberList/tiles/common/PresenceIconView";

describe("<PresenceIconView/>", () => {
    it("renders correctly for presence=online", () => {
        const { container } = render(<AvatarPresenceIconView presenceState="online" />);
        expect(container.querySelector(".mx_PresenceIconView_online")).toBeDefined();
        expect(container).toMatchSnapshot();
    });

    it("renders correctly for presence=offline", () => {
        const { container } = render(<AvatarPresenceIconView presenceState="offline" />);
        expect(container.querySelector(".mx_PresenceIconView_offline")).toBeDefined();
        expect(container).toMatchSnapshot();
    });

    it("renders correctly for presence=unavailable/unreachable", () => {
        const { container: container1 } = render(<AvatarPresenceIconView presenceState="unavailable" />);
        expect(container1.querySelector(".mx_PresenceIconView_unavailable")).toBeDefined();
        expect(container1).toMatchSnapshot();

        const { container: container2 } = render(<AvatarPresenceIconView presenceState="io.element.unreachable" />);
        expect(container2.querySelector(".mx_PresenceIconView_unavailable")).toBeDefined();
        expect(container2).toMatchSnapshot();
    });

    it("renders correctly for presence=busy", () => {
        const { container } = render(<AvatarPresenceIconView presenceState="busy" />);
        expect(container.querySelector(".mx_PresenceIconView_dnd")).toBeDefined();
        expect(container).toMatchSnapshot();
    });

    it("renders the tooltip", async () => {
        const user = userEvent.setup();

        const { container, asFragment } = render(<AvatarPresenceIconView presenceState="busy" />);

        const presence = container.querySelector(".mx_PresenceIconView")!;
        expect(presence).toBeVisible();
        await user.hover(presence!);

        // wait for the tooltip to open
        const tooltip = await waitFor(() => {
            const tooltip = document.getElementById(presence.getAttribute("aria-labelledby")!);
            expect(tooltip).toBeVisible();
            return tooltip;
        });
        expect(tooltip).toHaveTextContent("Busy");

        expect(asFragment()).toMatchSnapshot();
    });
});
