/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import { getMockClientWithEventEmitter } from "test-utils";
import { type Map as MapLibreMap } from "maplibre-gl";
import { type EventEmitter } from "node:events";

import { createMap } from "./map";
import { TILE_SERVER_WK_KEY } from "../WellKnownUtils";

vi.mock("maplibre-gl");

describe("createMap", () => {
    const client = getMockClientWithEventEmitter({
        getClientWellKnown: vi.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
    });

    it("marks the map busy until it has loaded and drawn its data", () => {
        const map = createMap(client, false, "map-id");
        const emitter = map as unknown as EventEmitter & MapLibreMap;
        const canvas = map.getCanvas();

        expect(canvas).toHaveAttribute("aria-busy", "true");

        emitter.emit("idle");
        expect(canvas).not.toHaveAttribute("aria-busy");

        emitter.emit("dataloading");
        expect(canvas).toHaveAttribute("aria-busy", "true");

        emitter.emit("idle");
        expect(canvas).not.toHaveAttribute("aria-busy");
    });
});
