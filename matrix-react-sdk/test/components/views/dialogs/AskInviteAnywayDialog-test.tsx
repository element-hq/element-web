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

import { getByText, render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import AskInviteAnywayDialog, {
    AskInviteAnywayDialogProps,
} from "../../../../src/components/views/dialogs/AskInviteAnywayDialog";
import SettingsStore from "../../../../src/settings/SettingsStore";

describe("AskInviteaAnywayDialog", () => {
    const onFinished: jest.Mock<any, any> = jest.fn();
    const onGiveUp: jest.Mock<any, any> = jest.fn();
    const onInviteAnyways: jest.Mock<any, any> = jest.fn();

    function renderComponent(props: Partial<AskInviteAnywayDialogProps> = {}): RenderResult {
        return render(
            <AskInviteAnywayDialog
                onFinished={onFinished}
                onGiveUp={onGiveUp}
                onInviteAnyways={onInviteAnyways}
                unknownProfileUsers={[
                    {
                        userId: "@alice:localhost",
                        errorText: "🤷‍♂️",
                    },
                ]}
                {...props}
            />,
        );
    }

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("remembers to not warn again", async () => {
        const { container } = renderComponent();

        jest.spyOn(SettingsStore, "setValue").mockImplementation(async (): Promise<void> => {});

        const neverWarnAgainBtn = getByText(container, /never warn/);
        await userEvent.click(neverWarnAgainBtn);

        expect(SettingsStore.setValue).toHaveBeenCalledWith(
            "promptBeforeInviteUnknownUsers",
            null,
            expect.any(String),
            false,
        );
        expect(onInviteAnyways).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("invites anyway", async () => {
        const { container } = renderComponent();

        jest.spyOn(SettingsStore, "setValue");

        const inviteAnywayBtn = getByText(container, "Invite anyway");
        await userEvent.click(inviteAnywayBtn);

        expect(onInviteAnyways).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("gives up", async () => {
        const { container } = renderComponent();

        jest.spyOn(SettingsStore, "setValue");

        const closeBtn = getByText(container, /Close/);
        await userEvent.click(closeBtn);

        expect(onGiveUp).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
