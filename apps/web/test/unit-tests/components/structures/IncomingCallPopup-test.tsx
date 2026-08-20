/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, act } from "jest-matrix-react";

import IncomingCallPopup from "../../../../src/components/structures/IncomingCallPopup";
import ToastStore from "../../../../src/stores/ToastStore";
import SettingsStore from "../../../../src/settings/SettingsStore";

// The bespoke call views pull in the full call/matrix stack; their behaviour is
// covered by the toast + hook tests. Here we only verify the popup's gating and
// EC-vs-legacy branching, so stub the views out.
jest.mock("../../../../src/components/views/voip/IncomingCallView", () => ({
    IncomingCallViewEC: () => <div data-testid="call-view-ec" />,
    IncomingCallViewLegacy: () => <div data-testid="call-view-legacy" />,
}));

const Dummy: React.FC = () => null;

const addECCallToast = (): void =>
    ToastStore.sharedInstance().addOrReplaceToast({
        key: "call_1",
        priority: 100,
        component: Dummy,
        callKind: "ec",
        props: { notificationEvent: {} } as any,
    });

const addLegacyCallToast = (): void =>
    ToastStore.sharedInstance().addOrReplaceToast({
        key: "call_legacy",
        priority: 100,
        component: Dummy,
        callKind: "legacy",
        props: { call: {} } as any,
    });

describe("<IncomingCallPopup />", () => {
    beforeEach(() => {
        ToastStore.sharedInstance().reset();
        jest.restoreAllMocks();
        jest.spyOn(SettingsStore, "watchSetting").mockReturnValue("ref");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(() => {});
    });

    it("renders nothing when the setting is disabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        addECCallToast();
        const { container } = render(<IncomingCallPopup />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when enabled but there is no incoming-call toast", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        ToastStore.sharedInstance().addOrReplaceToast({
            key: "other",
            priority: 10,
            component: Dummy,
            bodyClassName: "mx_SomeOtherToast",
            props: {},
        });
        const { container } = render(<IncomingCallPopup />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders the bespoke Element Call view full-screen when enabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        addECCallToast();
        render(<IncomingCallPopup />);
        // The view owns its own overlay; the popup just selects and renders it.
        expect(screen.getByTestId("call-view-ec")).toBeInTheDocument();
    });

    it("renders the legacy call view for a legacy toast", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        addLegacyCallToast();
        render(<IncomingCallPopup />);
        expect(screen.getByTestId("call-view-legacy")).toBeInTheDocument();
    });

    it("appears when a call toast is added after mount", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        render(<IncomingCallPopup />);
        expect(screen.queryByTestId("call-view-ec")).not.toBeInTheDocument();
        act(() => addECCallToast());
        expect(screen.getByTestId("call-view-ec")).toBeInTheDocument();
    });
});
