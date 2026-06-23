/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, type RenderResult, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type Room } from "matrix-js-sdk/src/matrix";

import ExportDialog from "../../../../../src/components/views/dialogs/ExportDialog";
import { ExportType, ExportFormat } from "../../../../../src/utils/exportUtils/exportUtils";
import { createTestClient, mkStubRoom } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import HTMLExporter from "../../../../../src/utils/exportUtils/HtmlExport";
import PlainTextExporter from "../../../../../src/utils/exportUtils/PlainTextExport";

jest.useFakeTimers();

const htmlExporterInstance = {
    export: jest.fn().mockResolvedValue({}),
};
const plainTextExporterInstance = {
    export: jest.fn().mockResolvedValue({}),
};
jest.mock("../../../../../src/utils/exportUtils/HtmlExport", () => jest.fn());
jest.mock("../../../../../src/utils/exportUtils/PlainTextExport", () => jest.fn());

const HTMLExporterMock = mocked(HTMLExporter);
const PlainTextExporterMock = mocked(PlainTextExporter);

describe("<ExportDialog />", () => {
    const mockClient = createTestClient();
    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);

    const roomId = "test:test.org";
    const defaultProps = {
        room: mkStubRoom(roomId, "test", mockClient) as unknown as Room,
        onFinished: jest.fn(),
    };

    const getComponent = (props = {}) => render(<ExportDialog {...defaultProps} {...props} />);

    const getSizeInput = ({ container }: RenderResult) => container.querySelector('input[id="size-limit"]')!;
    const getExportTypeInput = ({ container }: RenderResult) => container.querySelector('select[id="export-type"]')!;
    const getAttachmentsCheckbox = ({ container }: RenderResult) =>
        container.querySelector('input[id="include-attachments"]')!;
    const getMessageCountInput = ({ container }: RenderResult) => container.querySelector('input[id="message-count"]')!;
    const getExportFormatInput = ({ container }: RenderResult, format: ExportFormat) =>
        container.querySelector(`input[id="exportFormat-${format}"]`)!;
    const getPrimaryButton = ({ getByTestId }: RenderResult) => getByTestId("dialog-primary-button")!;
    const getSecondaryButton = ({ getByTestId }: RenderResult) => getByTestId("dialog-cancel-button")!;

    const submitForm = async (component: RenderResult) => fireEvent.click(getPrimaryButton(component));
    const selectExportFormat = async (component: RenderResult, format: ExportFormat) =>
        fireEvent.click(getExportFormatInput(component, format));
    const selectExportType = async (component: RenderResult, type: ExportType) =>
        fireEvent.change(getExportTypeInput(component), { target: { value: type } });
    const setMessageCount = async (component: RenderResult, count: number) =>
        fireEvent.change(getMessageCountInput(component), { target: { value: count } });

    const setSizeLimit = async (component: RenderResult, limit: number) =>
        fireEvent.change(getSizeInput(component), { target: { value: limit } });

    beforeEach(() => {
        HTMLExporterMock.mockClear().mockImplementation(jest.fn().mockReturnValue(htmlExporterInstance));
        PlainTextExporterMock.mockClear().mockImplementation(jest.fn().mockReturnValue(plainTextExporterInstance));
        htmlExporterInstance.export.mockClear();
        plainTextExporterInstance.export.mockClear();
    });

    it("renders export dialog", () => {
        const component = getComponent();
        expect(component.container.querySelector(".mx_ExportDialog")).toMatchSnapshot();
    });

    it("calls onFinished when cancel button is clicked", () => {
        const onFinished = jest.fn();
        const component = getComponent({ onFinished });
        fireEvent.click(getSecondaryButton(component));
        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it("exports room on submit", async () => {
        const component = getComponent();
        await submitForm(component);

        await waitFor(() => {
            // 4th arg is an component function
            const exportConstructorProps = HTMLExporterMock.mock.calls[0].slice(0, 3);
            expect(exportConstructorProps).toEqual([
                defaultProps.room,
                ExportType.Timeline,
                {
                    attachmentsIncluded: false,
                    maxSize: 8388608, // 8MB to bytes
                    numberOfMessages: 100,
                },
            ]);
        });
        expect(htmlExporterInstance.export).toHaveBeenCalled();
    });

    it("renders success screen when export is finished", async () => {
        const component = getComponent();
        await submitForm(component);

        jest.runAllTimers();

        expect(component.container.querySelector(".mx_InfoDialog .mx_Dialog_content")).toMatchSnapshot();
    });

    describe("export format", () => {
        it("renders export format with html selected by default", () => {
            const component = getComponent();
            expect(getExportFormatInput(component, ExportFormat.Html)).toBeChecked();
        });

        it("sets export format on radio button click", async () => {
            const component = getComponent();
            await selectExportFormat(component, ExportFormat.PlainText);
            expect(getExportFormatInput(component, ExportFormat.PlainText)).toBeChecked();
            expect(getExportFormatInput(component, ExportFormat.Html)).not.toBeChecked();
        });
    });

    describe("export type", () => {
        it("renders export type with timeline selected by default", () => {
            const component = getComponent();
            expect(getExportTypeInput(component)).toHaveValue(ExportType.Timeline);
        });

        it("sets export type on change", async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.Beginning);
            expect(getExportTypeInput(component)).toHaveValue(ExportType.Beginning);
        });

        it("does not render message count input", async () => {
            const component = getComponent();
            expect(getMessageCountInput(component)).toBeFalsy();
        });

        it("renders message count input with default value 100 when export type is lastNMessages", async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            expect(getMessageCountInput(component)).toHaveValue(100);
        });

        it("sets message count on change", async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 10);
            expect(getMessageCountInput(component)).toHaveValue(10);
        });

        it("does not export when export type is lastNMessages and message count is falsy", async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 0);
            await submitForm(component);

            expect(htmlExporterInstance.export).not.toHaveBeenCalled();
        });

        it("does not export when export type is lastNMessages and message count is more than max", async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 99999999999);
            await submitForm(component);

            expect(htmlExporterInstance.export).not.toHaveBeenCalled();
        });

        it("exports when export type is NOT lastNMessages and message count is falsy", async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 0);
            await selectExportType(component, ExportType.Timeline);
            await submitForm(component);

            await waitFor(() => {
                expect(htmlExporterInstance.export).toHaveBeenCalled();
            });
        });
    });

    describe("size limit", () => {
        it("renders size limit input with default value", () => {
            const component = getComponent();
            expect(getSizeInput(component)).toHaveValue(8);
        });

        it("updates size limit on change", async () => {
            const component = getComponent();
            await setSizeLimit(component, 20);
            expect(getSizeInput(component)).toHaveValue(20);
        });

        it("does not export when size limit is falsy", async () => {
            const component = getComponent();
            await setSizeLimit(component, 0);
            await submitForm(component);

            expect(htmlExporterInstance.export).not.toHaveBeenCalled();
        });

        it("does not export when size limit is larger than max", async () => {
            const component = getComponent();
            await setSizeLimit(component, 2001);
            await submitForm(component);

            expect(htmlExporterInstance.export).not.toHaveBeenCalled();
        });

        it("exports when size limit is max", async () => {
            const component = getComponent();
            await setSizeLimit(component, 2000);
            await submitForm(component);

            await waitFor(() => {
                expect(htmlExporterInstance.export).toHaveBeenCalled();
            });
        });
    });

    describe("include attachments", () => {
        it("renders input with default value of false", () => {
            const component = getComponent();
            expect(getAttachmentsCheckbox(component)).not.toBeChecked();
        });

        it("updates include attachments on change", async () => {
            const component = getComponent();
            fireEvent.click(getAttachmentsCheckbox(component));
            expect(getAttachmentsCheckbox(component)).toBeChecked();
        });
    });
});
