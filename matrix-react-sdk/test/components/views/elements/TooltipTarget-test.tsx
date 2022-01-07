// skinned-sdk should be the first import in most tests
import '../../../skinned-sdk';
import React from "react";
import {
    renderIntoDocument,
    Simulate,
} from 'react-dom/test-utils';
import { act } from "react-dom/test-utils";

import { Alignment } from '../../../../src/components/views/elements/Tooltip';
import TooltipTarget from "../../../../src/components/views/elements/TooltipTarget";

describe('<TooltipTarget />', () => {
    const defaultProps = {
        "tooltipTargetClassName": 'test tooltipTargetClassName',
        "className": 'test className',
        "tooltipClassName": 'test tooltipClassName',
        "label": 'test label',
        "yOffset": 1,
        "alignment": Alignment.Left,
        "id": 'test id',
        'data-test-id': 'test',
    };

    const getComponent = (props = {}) => {
        const wrapper = renderIntoDocument<HTMLSpanElement>(
        // wrap in element so renderIntoDocument can render functional component
            <span>
                <TooltipTarget {...defaultProps} {...props}>
                    <span>child</span>
                </TooltipTarget>
            </span>,
        ) as HTMLSpanElement;
        return wrapper.querySelector('[data-test-id=test]');
    };

    const getVisibleTooltip = () => document.querySelector('.mx_Tooltip.mx_Tooltip_visible');

    afterEach(() => {
        // clean up visible tooltips
        const tooltipWrapper = document.querySelector('.mx_Tooltip_wrapper');
        document.body.removeChild(tooltipWrapper);
    });

    it('renders container', () => {
        const component = getComponent();
        expect(component).toMatchSnapshot();
        expect(getVisibleTooltip()).toBeFalsy();
    });

    it('displays tooltip on mouseover', () => {
        const wrapper = getComponent();
        act(() => {
            Simulate.mouseOver(wrapper);
        });
        expect(getVisibleTooltip()).toMatchSnapshot();
    });

    it('hides tooltip on mouseleave', () => {
        const wrapper = getComponent();
        act(() => {
            Simulate.mouseOver(wrapper);
        });
        expect(getVisibleTooltip()).toBeTruthy();
        act(() => {
            Simulate.mouseLeave(wrapper);
        });
        expect(getVisibleTooltip()).toBeFalsy();
    });

    it('displays tooltip on focus', () => {
        const wrapper = getComponent();
        act(() => {
            Simulate.focus(wrapper);
        });
        expect(getVisibleTooltip()).toBeTruthy();
    });

    it('hides tooltip on blur', async () => {
        const wrapper = getComponent();
        act(() => {
            Simulate.focus(wrapper);
        });
        expect(getVisibleTooltip()).toBeTruthy();
        await act(async () => {
            await Simulate.blur(wrapper);
        });
        expect(getVisibleTooltip()).toBeFalsy();
    });
});
