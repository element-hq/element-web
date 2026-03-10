/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { describe, it, expect } from "vitest";
import React from "react";
import { composeStories } from "@storybook/react-vite";

import * as stories from "./LinkedText.stories.tsx";
import { LinkedText } from "./LinkedText.tsx";
import { LinkifyOptionalSlashProtocols, PERMITTED_URL_SCHEMES } from "../linkify";

const { Default, WithUserId, WithRoomAlias, WithCustomHref, WithCustomUrlTarget } = composeStories(stories);

describe("LinkedText", () => {
    it.each(
        PERMITTED_URL_SCHEMES.filter((protocol) => !LinkifyOptionalSlashProtocols.includes(protocol)).map(
            (protocol) => `${protocol}://abcdef/`,
        ),
    )("renders protocol with no optional slash '%s'", (path) => {
        const { getByRole } = render(<LinkedText>Check out this link {path}</LinkedText>);
        expect(getByRole("link")).toBeInTheDocument();
    });

    it.each(LinkifyOptionalSlashProtocols.map((protocol) => `${protocol}://abcdef`))(
        "renders protocol with optional slash '%s'",
        (path) => {
            const { getByRole } = render(<LinkedText>Check out this link {path}</LinkedText>);
            expect(getByRole("link")).toBeInTheDocument();
        },
    );

    it("renders a standard link", () => {
        const { container } = render(<Default />);
        expect(container).toMatchSnapshot();
    });

    it("renders an unclickable link", () => {
        const { container } = render(<Unclickable />);
        expect(container).toMatchSnapshot();
    });

    it("renders a user ID", () => {
        const { container } = render(<WithUserId />);
        expect(container).toMatchSnapshot();
    });

    it("renders a room alias", () => {
        const { container } = render(<WithRoomAlias />);
        expect(container).toMatchSnapshot();
    });

    it("renders a custom target", () => {
        const { container } = render(<WithCustomUrlTarget />);
        expect(container).toMatchSnapshot();
    });

    it("renders a custom href", () => {
        const { container } = render(<WithCustomHref />);
        expect(container).toMatchSnapshot();
    });
});
