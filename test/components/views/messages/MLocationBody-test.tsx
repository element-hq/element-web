/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { mount } from "enzyme";
import { mocked } from 'jest-mock';
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";
import maplibregl from 'maplibre-gl';
import { logger } from 'matrix-js-sdk/src/logger';

import MLocationBody from "../../../../src/components/views/messages/MLocationBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import { getTileServerWellKnown } from "../../../../src/utils/WellKnownUtils";
import SdkConfig from "../../../../src/SdkConfig";
import { makeLocationEvent } from "../../../test-utils/location";

jest.mock("../../../../src/utils/WellKnownUtils", () => ({
    getTileServerWellKnown: jest.fn(),
}));

describe("MLocationBody", () => {
    describe('<MLocationBody>', () => {
        describe('with error', () => {
            const mockClient = {
                on: jest.fn(),
                off: jest.fn(),
            };
            const defaultEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Pin);
            const defaultProps = {
                mxEvent: defaultEvent,
                highlights: [],
                highlightLink: '',
                onHeightChanged: jest.fn(),
                onMessageAllowed: jest.fn(),
                permalinkCreator: {} as RoomPermalinkCreator,
                mediaEventHelper: {} as MediaEventHelper,
            };
            const getComponent = (props = {}) => mount(<MLocationBody {...defaultProps} {...props} />, {
                wrappingComponent: MatrixClientContext.Provider,
                wrappingComponentProps: { value: mockClient },
            });
            let sdkConfigSpy;

            beforeEach(() => {
                // eat expected errors to keep console clean
                jest.spyOn(logger, 'error').mockImplementation(() => { });
                mocked(getTileServerWellKnown).mockReturnValue({});
                sdkConfigSpy = jest.spyOn(SdkConfig, 'get').mockReturnValue({});
            });

            afterAll(() => {
                sdkConfigSpy.mockRestore();
                jest.spyOn(logger, 'error').mockRestore();
            });

            it('displays correct fallback content without error style when map_style_url is not configured', () => {
                const component = getComponent();
                expect(component.find(".mx_EventTile_body")).toMatchSnapshot();
            });

            it('displays correct fallback content when map_style_url is misconfigured', () => {
                const mockMap = new maplibregl.Map();
                mocked(getTileServerWellKnown).mockReturnValue({ map_style_url: 'bad-tile-server.com' });
                const component = getComponent();

                // simulate error initialising map in maplibregl
                // @ts-ignore
                mockMap.emit('error', { status: 404 });
                component.setProps({});
                expect(component.find(".mx_EventTile_body")).toMatchSnapshot();
            });
        });
    });
});
