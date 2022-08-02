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
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";
import { ClientEvent, RoomMember } from 'matrix-js-sdk/src/matrix';
import maplibregl from 'maplibre-gl';
import { logger } from 'matrix-js-sdk/src/logger';
import { act } from 'react-dom/test-utils';
import { SyncState } from 'matrix-js-sdk/src/sync';

import MLocationBody from "../../../../src/components/views/messages/MLocationBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import Modal from '../../../../src/Modal';
import SdkConfig from "../../../../src/SdkConfig";
import { TILE_SERVER_WK_KEY } from '../../../../src/utils/WellKnownUtils';
import { makeLocationEvent } from "../../../test-utils/location";
import { getMockClientWithEventEmitter } from '../../../test-utils';

describe("MLocationBody", () => {
    describe('<MLocationBody>', () => {
        const roomId = '!room:server';
        const userId = '@user:server';
        const mockClient = getMockClientWithEventEmitter({
            getClientWellKnown: jest.fn().mockReturnValue({
                [TILE_SERVER_WK_KEY.name]: { map_style_url: 'maps.com' },
            }),
            isGuest: jest.fn().mockReturnValue(false),
        });
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
        const getMapErrorComponent = () => {
            const mockMap = new maplibregl.Map();
            mockClient.getClientWellKnown.mockReturnValue({
                [TILE_SERVER_WK_KEY.name]: { map_style_url: 'bad-tile-server.com' },
            });
            const component = getComponent();

            // simulate error initialising map in maplibregl
            // @ts-ignore
            mockMap.emit('error', { status: 404 });

            return component;
        };

        beforeAll(() => {
            maplibregl.AttributionControl = jest.fn();
        });

        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('with error', () => {
            let sdkConfigSpy;

            beforeEach(() => {
                // eat expected errors to keep console clean
                jest.spyOn(logger, 'error').mockImplementation(() => { });
                mockClient.getClientWellKnown.mockReturnValue({});
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
                const component = getMapErrorComponent();
                component.setProps({});
                expect(component.find(".mx_EventTile_body")).toMatchSnapshot();
            });

            it('should clear the error on reconnect', () => {
                const component = getMapErrorComponent();
                expect((component.state() as React.ComponentState).error).toBeDefined();
                mockClient.emit(ClientEvent.Sync, SyncState.Reconnecting, SyncState.Error);
                expect((component.state() as React.ComponentState).error).toBeUndefined();
            });
        });

        describe('without error', () => {
            beforeEach(() => {
                mockClient.getClientWellKnown.mockReturnValue({
                    [TILE_SERVER_WK_KEY.name]: { map_style_url: 'maps.com' },
                });

                // MLocationBody uses random number for map id
                // stabilise for test
                jest.spyOn(global.Math, 'random').mockReturnValue(0.123456);
            });

            afterAll(() => {
                jest.spyOn(global.Math, 'random').mockRestore();
            });

            it('renders map correctly', () => {
                const mockMap = new maplibregl.Map();
                const component = getComponent();

                expect(component).toMatchSnapshot();
                // map was centered
                expect(mockMap.setCenter).toHaveBeenCalledWith({
                    lat: 51.5076, lon: -0.1276,
                });
            });

            it('opens map dialog on click', () => {
                const modalSpy = jest.spyOn(Modal, 'createDialog').mockReturnValue(undefined);
                const component = getComponent();

                act(() => {
                    component.find('Map').at(0).simulate('click');
                });

                expect(modalSpy).toHaveBeenCalled();
            });

            it('renders marker correctly for a non-self share', () => {
                const mockMap = new maplibregl.Map();
                const component = getComponent();

                expect(component.find('SmartMarker').at(0).props()).toEqual(
                    expect.objectContaining({
                        map: mockMap,
                        geoUri: 'geo:51.5076,-0.1276',
                        roomMember: undefined,
                    }),
                );
            });

            it('renders marker correctly for a self share', () => {
                const selfShareEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Self);
                const member = new RoomMember(roomId, userId);
                // @ts-ignore cheat assignment to property
                selfShareEvent.sender = member;
                const component = getComponent({ mxEvent: selfShareEvent });

                // render self locations with user avatars
                expect(component.find('SmartMarker').at(0).props()['roomMember']).toEqual(
                    member,
                );
            });
        });
    });
});
