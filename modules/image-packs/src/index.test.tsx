/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Api } from "@element-hq/element-web-module-api";

import ImagePacksModule from "./index.tsx";
import type { UseImagePacksOptions } from "./useImagePacks.ts";

afterEach(cleanup);

const options = {
    client: {
        getUserId: () => null,
        getRoom: () => null,
        getAccountData: () => null,
        setAccountData: vi.fn().mockResolvedValue(undefined),
    },
    writers: {},
} as unknown as UseImagePacksOptions;

describe("ImagePacksModule", () => {
    it("does nothing when the host has no image-pack mount registration", async () => {
        const module = new ImagePacksModule({ customisations: {} } as unknown as Api);
        await expect(module.load()).resolves.toBeUndefined();
    });

    it("registers a renderer that mounts the settings UI", async () => {
        const registerImagePacksMount = vi.fn();
        const module = new ImagePacksModule({
            customisations: { registerImagePacksMount },
        } as unknown as Api);

        await module.load();
        const renderer = registerImagePacksMount.mock.calls[0][0] as (value: UseImagePacksOptions) => React.ReactNode;
        function Mounted(): React.ReactElement {
            return <>{renderer(options)}</>;
        }

        render(<Mounted />);

        expect(screen.getByTestId("image-packs-tab")).toBeTruthy();
    });
});
