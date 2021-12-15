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
});
