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
// eslint-disable-next-line deprecate/import
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import maplibregl from 'maplibre-gl';
import { ClientEvent } from 'matrix-js-sdk/src/matrix';
import { logger } from 'matrix-js-sdk/src/logger';

import Map from '../../../../src/components/views/location/Map';
import { findByTestId, getMockClientWithEventEmitter } from '../../../test-utils';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import { TILE_SERVER_WK_KEY } from '../../../../src/utils/WellKnownUtils';

describe('<Map />', () => {
    const defaultProps = {
        centerGeoUri: 'geo:52,41',
        id: 'test-123',
        onError: jest.fn(),
        onClick: jest.fn(),
    };
    const matrixClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: 'maps.com' },
        }),
    });
    const getComponent = (props = {}) =>
        mount(<Map {...defaultProps} {...props} />, {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: matrixClient },
        });

    beforeAll(() => {
        maplibregl.AttributionControl = jest.fn();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        matrixClient.getClientWellKnown.mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: 'maps.com' },
        });

        jest.spyOn(logger, 'error').mockRestore();
    });

    const mockMap = new maplibregl.Map();

    it('renders', () => {
        const component = getComponent();
        expect(component).toBeTruthy();
    });

    describe('onClientWellKnown emits', () => {
        it('updates map style when style url is truthy', () => {
            getComponent();

            act(() => {
                matrixClient.emit(ClientEvent.ClientWellKnown, {
                    [TILE_SERVER_WK_KEY.name]: { map_style_url: 'new.maps.com' },
                });
            });

            expect(mockMap.setStyle).toHaveBeenCalledWith('new.maps.com');
        });

        it('does not update map style when style url is truthy', () => {
            getComponent();

            act(() => {
                matrixClient.emit(ClientEvent.ClientWellKnown, {
                    [TILE_SERVER_WK_KEY.name]: { map_style_url: undefined },
                });
            });

            expect(mockMap.setStyle).not.toHaveBeenCalledWith();
        });
    });

    describe('map centering', () => {
        it('does not try to center when no center uri provided', () => {
            getComponent({ centerGeoUri: null });
            expect(mockMap.setCenter).not.toHaveBeenCalled();
        });

        it('sets map center to centerGeoUri', () => {
            getComponent({ centerGeoUri: 'geo:51,42' });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 51, lon: 42 });
        });

        it('handles invalid centerGeoUri', () => {
            const logSpy = jest.spyOn(logger, 'error').mockImplementation();
            getComponent({ centerGeoUri: '123 Sesame Street' });
            expect(mockMap.setCenter).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith('Could not set map center');
        });

        it('updates map center when centerGeoUri prop changes', () => {
            const component = getComponent({ centerGeoUri: 'geo:51,42' });

            component.setProps({ centerGeoUri: 'geo:53,45' });
            component.setProps({ centerGeoUri: 'geo:56,47' });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 51, lon: 42 });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 53, lon: 45 });
            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 56, lon: 47 });
        });
    });

    describe('map bounds', () => {
        it('does not try to fit map bounds when no bounds provided', () => {
            getComponent({ bounds: null });
            expect(mockMap.fitBounds).not.toHaveBeenCalled();
        });

        it('fits map to bounds', () => {
            const bounds = { north: 51, south: 50, east: 42, west: 41 };
            getComponent({ bounds });
            expect(mockMap.fitBounds).toHaveBeenCalledWith(new maplibregl.LngLatBounds([bounds.west, bounds.south],
                [bounds.east, bounds.north]), { padding: 100, maxZoom: 15 });
        });

        it('handles invalid bounds', () => {
            const logSpy = jest.spyOn(logger, 'error').mockImplementation();
            const bounds = { north: 'a', south: 'b', east: 42, west: 41 };
            getComponent({ bounds });
            expect(mockMap.fitBounds).not.toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalledWith('Invalid map bounds');
        });

        it('updates map bounds when bounds prop changes', () => {
            const component = getComponent({ centerGeoUri: 'geo:51,42' });

            const bounds = { north: 51, south: 50, east: 42, west: 41 };
            const bounds2 = { north: 53, south: 51, east: 45, west: 44 };
            component.setProps({ bounds });
            component.setProps({ bounds: bounds2 });
            expect(mockMap.fitBounds).toHaveBeenCalledTimes(2);
        });
    });

    describe('children', () => {
        it('renders without children', () => {
            const component = getComponent({ children: null });

            component.setProps({});

            // no error
            expect(component).toBeTruthy();
        });

        it('renders children with map renderProp', () => {
            const children = ({ map }) => <div data-test-id='test-child' data-map={map}>Hello, world</div>;

            const component = getComponent({ children });

            // renders child with map instance
            expect(findByTestId(component, 'test-child').props()['data-map']).toEqual(mockMap);
        });
    });

    describe('onClick', () => {
        it('eats clicks to maplibre attribution button', () => {
            const onClick = jest.fn();
            const component = getComponent({ onClick });

            act(() => {
                // this is added to the dom by maplibregl
                // which is mocked
                // just fake the target
                const fakeEl = document.createElement('div');
                fakeEl.className = 'maplibregl-ctrl-attrib-button';
                component.simulate('click', { target: fakeEl });
            });

            expect(onClick).not.toHaveBeenCalled();
        });

        it('calls onClick', () => {
            const onClick = jest.fn();
            const component = getComponent({ onClick });

            act(() => {
                component.simulate('click');
            });

            expect(onClick).toHaveBeenCalled();
        });
    });
});
