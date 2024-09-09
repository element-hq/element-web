/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { renderHook } from "@testing-library/react-hooks";
import { waitFor } from "@testing-library/react";

import { useUserOnboardingTasks } from "../../src/hooks/useUserOnboardingTasks";
import { useUserOnboardingContext } from "../../src/hooks/useUserOnboardingContext";
import { stubClient } from "../test-utils";
import MatrixClientContext from "../../src/contexts/MatrixClientContext";
import DMRoomMap from "../../src/utils/DMRoomMap";
import PlatformPeg from "../../src/PlatformPeg";

describe("useUserOnboardingTasks", () => {
    it.each([
        {
            context: {
                hasAvatar: false,
                hasDevices: false,
                hasDmRooms: false,
                showNotificationsPrompt: false,
            },
        },
        {
            context: {
                hasAvatar: true,
                hasDevices: false,
                hasDmRooms: false,
                showNotificationsPrompt: true,
            },
        },
    ])("sequence should stay static", async ({ context }) => {
        const { result } = renderHook(() => useUserOnboardingTasks(context));

        expect(result.current).toHaveLength(5);
        expect(result.current[0].id).toBe("create-account");
        expect(result.current[1].id).toBe("find-friends");
        expect(result.current[2].id).toBe("download-apps");
        expect(result.current[3].id).toBe("setup-profile");
        expect(result.current[4].id).toBe("permission-notifications");
    });

    it("should mark desktop notifications task completed on click", async () => {
        jest.spyOn(PlatformPeg, "get").mockReturnValue({
            supportsNotifications: jest.fn().mockReturnValue(true),
            maySendNotifications: jest.fn().mockReturnValue(false),
        } as any);

        const cli = stubClient();
        cli.pushRules = {
            global: {
                override: [
                    {
                        rule_id: ".m.rule.master",
                        enabled: false,
                        actions: [],
                        default: true,
                    },
                ],
            },
        };
        DMRoomMap.makeShared(cli);
        const context = renderHook(() => useUserOnboardingContext(), {
            wrapper: (props) => {
                return <MatrixClientContext.Provider value={cli}>{props.children}</MatrixClientContext.Provider>;
            },
        });
        const { result, rerender } = renderHook(() => useUserOnboardingTasks(context.result.current));
        expect(result.current[4].id).toBe("permission-notifications");
        expect(result.current[4].completed).toBe(false);
        result.current[4].action!.onClick!({ type: "click" } as any);
        await waitFor(() => {
            rerender();
            expect(result.current[4].completed).toBe(true);
        });
    });
});
