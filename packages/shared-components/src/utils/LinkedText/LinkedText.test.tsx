/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render } from "@test-utils";
import { describe, it, expect } from "vitest";
import React from "react";

import { LinkedText } from "./LinkedText.tsx";
import { LinkifyOptionalSlashProtocols, PERMITTED_URL_SCHEMES } from "./linkifyOptions.ts";

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
});
