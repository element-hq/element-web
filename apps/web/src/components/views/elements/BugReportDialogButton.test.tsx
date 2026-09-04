/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "test-utils-rtl";
import React, { type ComponentProps } from "react";
import userEvent from "@testing-library/user-event";

import { BugReportDialogButton } from "./BugReportDialogButton";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import BugReportDialog from "../dialogs/BugReportDialog";
import { BugReportEndpointURLLocal } from "../../../IConfigOptions";

describe("<BugReportDialogButton />", () => {
    const getComponent = (props: ComponentProps<typeof BugReportDialogButton> = {}) =>
        render(<BugReportDialogButton {...props} />);

    afterEach(() => {
        SdkConfig.reset();
        vi.restoreAllMocks();
    });

    it("renders nothing if the bug reporter is disabled", () => {
        SdkConfig.put({ bug_report_endpoint_url: undefined });
        const { container } = getComponent({});
        expect(container).toBeEmptyDOMElement();
    });

    it("renders 'submit' label if a URL is configured", () => {
        SdkConfig.put({ bug_report_endpoint_url: "https://example.org" });
        const { container } = getComponent({});
        expect(container).toMatchSnapshot();
    });

    it("renders 'download' label if 'loca' is configured", () => {
        SdkConfig.put({ bug_report_endpoint_url: BugReportEndpointURLLocal });
        const { container } = getComponent({});
        expect(container).toMatchSnapshot();
    });

    it("passes through props to dialog", async () => {
        SdkConfig.put({ bug_report_endpoint_url: BugReportEndpointURLLocal });
        const spy = vi.spyOn(Modal, "createDialog");
        const { getByRole } = getComponent({ label: "a label", error: "an error" });
        await userEvent.click(getByRole("button"));
        expect(spy).toHaveBeenCalledWith(BugReportDialog, { error: "an error", label: "a label" });
    });
});
