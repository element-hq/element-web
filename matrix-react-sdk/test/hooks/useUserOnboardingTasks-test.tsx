/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { renderHook } from "@testing-library/react-hooks";

import { useUserOnboardingTasks } from "../../src/hooks/useUserOnboardingTasks";

describe("useUserOnboardingTasks", () => {
    it.each([
        {
            context: {
                hasAvatar: false,
                hasDevices: false,
                hasDmRooms: false,
                hasNotificationsEnabled: false,
            },
        },
        {
            context: {
                hasAvatar: true,
                hasDevices: false,
                hasDmRooms: false,
                hasNotificationsEnabled: true,
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
});
