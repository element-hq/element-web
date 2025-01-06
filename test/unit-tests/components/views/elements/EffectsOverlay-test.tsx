/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, waitFor } from "jest-matrix-react";

import dis from "../../../../../src/dispatcher/dispatcher";
import EffectsOverlay from "../../../../../src/components/views/elements/EffectsOverlay.tsx";

describe("<EffectsOverlay/>", () => {
    let isStarted: boolean;
    beforeEach(() => {
        isStarted = false;
        jest.mock("../../../../../src/effects/confetti/index.ts", () => {
            return class Confetti {
                start = () => {
                    isStarted = true;
                };
                stop = jest.fn();
            };
        });
    });

    afterEach(() => jest.useRealTimers());

    it("should render", () => {
        const { asFragment } = render(<EffectsOverlay roomWidth={100} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should start the confetti effect", async () => {
        render(<EffectsOverlay roomWidth={100} />);
        dis.dispatch({ action: "effects.confetti" });
        await waitFor(() => expect(isStarted).toBe(true));
    });

    it("should start the confetti effect when the event is not outdated", async () => {
        const eventDate = new Date("2024-09-01");
        const date = new Date("2024-09-02");
        jest.useFakeTimers().setSystemTime(date);

        render(<EffectsOverlay roomWidth={100} />);
        dis.dispatch({ action: "effects.confetti", event: { getTs: () => eventDate.getTime() } });
        await waitFor(() => expect(isStarted).toBe(true));
    });
});
