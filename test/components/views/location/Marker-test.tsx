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
import { RoomMember } from 'matrix-js-sdk/src/matrix';

import Marker from '../../../../src/components/views/location/Marker';

describe('<Marker />', () => {
    const defaultProps = {
        id: 'abc123',
    };
    const getComponent = (props = {}) =>
        mount(<Marker {...defaultProps} {...props} />);

    it('renders with location icon when no room member', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
    });

    it('does not try to use member color without room member', () => {
        const component = getComponent({ useMemberColor: true });
        expect(component.find('div').at(0).props().className).toEqual('mx_Marker mx_Marker_defaultColor');
    });

    it('uses member color class', () => {
        const member = new RoomMember('!room:server', '@user:server');
        const component = getComponent({ useMemberColor: true, roomMember: member });
        expect(component.find('div').at(0).props().className).toEqual('mx_Marker mx_Username_color3');
    });

    it('renders member avatar when roomMember is truthy', () => {
        const member = new RoomMember('!room:server', '@user:server');
        const component = getComponent({ roomMember: member });
        expect(component.find('MemberAvatar').length).toBeTruthy();
    });
});
