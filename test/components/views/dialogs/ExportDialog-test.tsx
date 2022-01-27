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

import React from 'react';
import { mount } from 'enzyme';
import '../../../skinned-sdk';
import { act } from "react-dom/test-utils";
import { Room } from 'matrix-js-sdk';

import ExportDialog from '../../../../src/components/views/dialogs/ExportDialog';
import { ExportType, ExportFormat } from '../../../../src/utils/exportUtils/exportUtils';
import { createTestClient, mkStubRoom } from '../../../test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import HTMLExporter from "../../../../src/utils/exportUtils/HtmlExport";

jest.useFakeTimers();

const mockHtmlExporter = ({
    export: jest.fn().mockResolvedValue({}),
});
jest.mock("../../../../src/utils/exportUtils/HtmlExport", () => jest.fn());

describe('<ExportDialog />', () => {
    const mockClient = createTestClient();
    jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient);

    const roomId = 'test:test.org';
    const defaultProps = {
        room: mkStubRoom(roomId, 'test', mockClient) as unknown as Room,
        onFinished: jest.fn(),
    };

    const getComponent = (props = {}) => mount(<ExportDialog {...defaultProps} {...props} />);

    const getSizeInput = (component) => component.find('input[id="size-limit"]');
    const getExportTypeInput = (component) => component.find('select[id="export-type"]');
    const getAttachmentsCheckbox = (component) => component.find('input[id="include-attachments"]');
    const getMessageCountInput = (component) => component.find('input[id="message-count"]');
    const getExportFormatInput = (component, format) => component.find(`input[id="exportFormat-${format}"]`);
    const getPrimaryButton = (component) => component.find('[data-test-id="dialog-primary-button"]');
    const getSecondaryButton = (component) => component.find('[data-test-id="dialog-cancel-button"]');

    const submitForm = async (component) => act(async () => {
        getPrimaryButton(component).simulate('click');
        component.setProps({});
    });
    const selectExportFormat = async (component, format: ExportFormat) => act(async () => {
        getExportFormatInput(component, format).simulate('change');
        component.setProps({});
    });
    const selectExportType = async (component, type: ExportType) => act(async () => {
        getExportTypeInput(component).simulate('change', { target: { value: type } });
        component.setProps({});
    });
    const setMessageCount = async (component, count: number) => act(async () => {
        getMessageCountInput(component).simulate('change', { target: { value: count } });
        component.setProps({});
    });

    const setSizeLimit = async (component, limit: number) => act(async () => {
        getSizeInput(component).simulate('change', { target: { value: limit } });
        component.setProps({});
    });

    const setIncludeAttachments = async (component, checked) => act(async () => {
        getAttachmentsCheckbox(component).simulate('change', { target: { checked } });
        component.setProps({});
    });

    beforeEach(() => {
        (HTMLExporter as jest.Mock).mockImplementation(jest.fn().mockReturnValue(mockHtmlExporter));
        mockHtmlExporter.export.mockClear();
    });

    it('renders export dialog', () => {
        const component = getComponent();
        expect(component.find('.mx_ExportDialog')).toMatchSnapshot();
    });

    it('calls onFinished when cancel button is clicked', () => {
        const onFinished = jest.fn();
        const component = getComponent({ onFinished });
        act(() => {
            getSecondaryButton(component).simulate('click');
        });
        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it('exports room on submit', async () => {
        const component = getComponent();
        await submitForm(component);

        // 4th arg is an component function
        const exportConstructorProps = (HTMLExporter as jest.Mock).mock.calls[0].slice(0, 3);
        expect(exportConstructorProps).toEqual([
            defaultProps.room,
            ExportType.Timeline,
            {
                attachmentsIncluded: false,
                maxSize: 8388608, // 8MB to bytes
                numberOfMessages: 100,
            },
        ]);
        expect(mockHtmlExporter.export).toHaveBeenCalled();
    });

    it('renders success screen when export is finished', async () => {
        const component = getComponent();
        await submitForm(component);
        component.setProps({});

        jest.runAllTimers();

        expect(component.find('.mx_InfoDialog .mx_Dialog_content')).toMatchSnapshot();
    });

    describe('export format', () => {
        it('renders export format with html selected by default', () => {
            const component = getComponent();
            expect(getExportFormatInput(component, ExportFormat.Html).props().checked).toBeTruthy();
        });

        it('sets export format on radio button click', async () => {
            const component = getComponent();
            await selectExportFormat(component, ExportFormat.PlainText);
            expect(getExportFormatInput(component, ExportFormat.PlainText).props().checked).toBeTruthy();
            expect(getExportFormatInput(component, ExportFormat.Html).props().checked).toBeFalsy();
        });
    });

    describe('export type', () => {
        it('renders export type with timeline selected by default', () => {
            const component = getComponent();
            expect(getExportTypeInput(component).props().value).toEqual(ExportType.Timeline);
        });

        it('sets export type on change', async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.Beginning);
            expect(getExportTypeInput(component).props().value).toEqual(ExportType.Beginning);
        });

        it('does not render message count input', async () => {
            const component = getComponent();
            expect(getMessageCountInput(component).length).toBeFalsy();
        });

        it('renders message count input with default value 100 when export type is lastNMessages', async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            expect(getMessageCountInput(component).props().value).toEqual("100");
        });

        it('sets message count on change', async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 10);
            expect(getMessageCountInput(component).props().value).toEqual("10");
        });

        it('does not export when export type is lastNMessages and message count is falsy', async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 0);
            await submitForm(component);

            expect(mockHtmlExporter.export).not.toHaveBeenCalled();
        });

        it('does not export when export type is lastNMessages and message count is more than max', async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 99999999999);
            await submitForm(component);

            expect(mockHtmlExporter.export).not.toHaveBeenCalled();
        });

        it('exports when export type is NOT lastNMessages and message count is falsy', async () => {
            const component = getComponent();
            await selectExportType(component, ExportType.LastNMessages);
            await setMessageCount(component, 0);
            await selectExportType(component, ExportType.Timeline);
            await submitForm(component);

            expect(mockHtmlExporter.export).toHaveBeenCalled();
        });
    });

    describe('size limit', () => {
        it('renders size limit input with default value', () => {
            const component = getComponent();
            expect(getSizeInput(component).props().value).toEqual("8");
        });

        it('updates size limit on change', async () => {
            const component = getComponent();
            await setSizeLimit(component, 20);
            expect(getSizeInput(component).props().value).toEqual("20");
        });

        it('does not export when size limit is falsy', async () => {
            const component = getComponent();
            await setSizeLimit(component, 0);
            await submitForm(component);

            expect(mockHtmlExporter.export).not.toHaveBeenCalled();
        });

        it('does not export when size limit is larger than max', async () => {
            const component = getComponent();
            await setSizeLimit(component, 2001);
            await submitForm(component);

            expect(mockHtmlExporter.export).not.toHaveBeenCalled();
        });

        it('exports when size limit is max', async () => {
            const component = getComponent();
            await setSizeLimit(component, 2000);
            await submitForm(component);

            expect(mockHtmlExporter.export).toHaveBeenCalled();
        });
    });

    describe('include attachements', () => {
        it('renders input with default value of false', () => {
            const component = getComponent();
            expect(getAttachmentsCheckbox(component).props().checked).toEqual(false);
        });

        it('updates include attachments on change', async () => {
            const component = getComponent();
            await setIncludeAttachments(component, true);
            expect(getAttachmentsCheckbox(component).props().checked).toEqual(true);
        });
    });
});

