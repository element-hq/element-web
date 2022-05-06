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
import { renderIntoDocument } from 'react-dom/test-utils';

import Heading from "../../../../src/components/views/typography/Heading";
describe('<Heading />', () => {
    const defaultProps = {
        size: 'h1',
        children: <div>test</div>,
        ['data-test-id']: 'test',
        className: 'test',
    } as any;
    const getComponent = (props = {}) => {
        const wrapper = renderIntoDocument<HTMLDivElement>(
            <div><Heading {...defaultProps} {...props} /></div>,
        ) as HTMLDivElement;
        return wrapper.children[0];
    };

    it('renders h1 with correct attributes', () => {
        expect(getComponent({ size: 'h1' })).toMatchSnapshot();
    });
    it('renders h2 with correct attributes', () => {
        expect(getComponent({ size: 'h2' })).toMatchSnapshot();
    });
    it('renders h3 with correct attributes', () => {
        expect(getComponent({ size: 'h3' })).toMatchSnapshot();
    });

    it('renders h4 with correct attributes', () => {
        expect(getComponent({ size: 'h4' })).toMatchSnapshot();
    });
});
