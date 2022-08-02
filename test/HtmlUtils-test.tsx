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
import { mocked } from 'jest-mock';

import { topicToHtml } from '../src/HtmlUtils';
import SettingsStore from '../src/settings/SettingsStore';

jest.mock("../src/settings/SettingsStore");

const enableHtmlTopicFeature = () => {
    mocked(SettingsStore).getValue.mockImplementation((arg) => {
        return arg === "feature_html_topic";
    });
};

describe('HtmlUtils', () => {
    it('converts plain text topic to HTML', () => {
        const component = mount(<div>{ topicToHtml("pizza", null, null, false) }</div>);
        const wrapper = component.render();
        expect(wrapper.children().first().html()).toEqual("pizza");
    });

    it('converts plain text topic with emoji to HTML', () => {
        const component = mount(<div>{ topicToHtml("pizza 🍕", null, null, false) }</div>);
        const wrapper = component.render();
        expect(wrapper.children().first().html()).toEqual("pizza <span class=\"mx_Emoji\" title=\":pizza:\">🍕</span>");
    });

    it('converts literal HTML topic to HTML', async () => {
        enableHtmlTopicFeature();
        const component = mount(<div>{ topicToHtml("<b>pizza</b>", null, null, false) }</div>);
        const wrapper = component.render();
        expect(wrapper.children().first().html()).toEqual("&lt;b&gt;pizza&lt;/b&gt;");
    });

    it('converts true HTML topic to HTML', async () => {
        enableHtmlTopicFeature();
        const component = mount(<div>{ topicToHtml("**pizza**", "<b>pizza</b>", null, false) }</div>);
        const wrapper = component.render();
        expect(wrapper.children().first().html()).toEqual("<b>pizza</b>");
    });

    it('converts true HTML topic with emoji to HTML', async () => {
        enableHtmlTopicFeature();
        const component = mount(<div>{ topicToHtml("**pizza** 🍕", "<b>pizza</b> 🍕", null, false) }</div>);
        const wrapper = component.render();
        expect(wrapper.children().first().html())
            .toEqual("<b>pizza</b> <span class=\"mx_Emoji\" title=\":pizza:\">🍕</span>");
    });
});
