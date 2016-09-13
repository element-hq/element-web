import React from 'react';
import ReactTestUtils from 'react-addons-test-utils';
import ReactDOM from 'react-dom';
import expect, {createSpy} from 'expect';
import sinon from 'sinon';
import Q from 'q';
import * as testUtils from '../../../test-utils';
import sdk from 'matrix-react-sdk';
import UserSettingsStore from '../../../../src/UserSettingsStore';
const MessageComposerInput = sdk.getComponent('views.rooms.MessageComposerInput');
import MatrixClientPeg from 'MatrixClientPeg';

function addTextToDraft(text) {
    const components = document.getElementsByClassName('public-DraftEditor-content');
    if (components && components.length) {
        const textarea = components[0];
        const textEvent = document.createEvent('TextEvent');
        textEvent.initTextEvent('textInput', true, true, null, text);
        textarea.dispatchEvent(textEvent);
    }
}

describe('MessageComposerInput', () => {
    let parentDiv = null,
        sandbox = null,
        client = null,
        mci = null,
        room = testUtils.mkStubRoom('!DdJkzRliezrwpNebLk:matrix.org');

    // TODO Remove when RTE is out of labs.

    beforeEach(() => {
        sandbox = testUtils.stubClient(sandbox);
        client = MatrixClientPeg.get();
        UserSettingsStore.isFeatureEnabled = sinon.stub()
            .withArgs('rich_text_editor').returns(true);

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);
        mci = ReactDOM.render(
            <MessageComposerInput
                room={room}
                client={client}
            />,
            parentDiv);
    });

    afterEach(() => {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }
        sandbox.restore();
    });

    it('should change mode if indicator is clicked', () => {
        mci.enableRichtext(true);

        setTimeout(() => {
            const indicator = ReactTestUtils.findRenderedDOMComponentWithClass(
                mci,
                'mx_MessageComposer_input_markdownIndicator');
            ReactTestUtils.Simulate.click(indicator);

            expect(mci.state.isRichtextEnabled).toEqual(false, 'should have changed mode');
        });
    });

    it('should not send messages when composer is empty', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(true);
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(false, 'should not send message');
    });

    it('should not change content unnecessarily on RTE -> Markdown conversion', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(true);
        addTextToDraft('a');
        mci.handleKeyCommand('toggle-mode');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('a');
    });

    it('should not change content unnecessarily on Markdown -> RTE conversion', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(false);
        addTextToDraft('a');
        mci.handleKeyCommand('toggle-mode');
        mci.handleReturn(sinon.stub());
        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('a');
    });

    it('should send emoji messages in rich text', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(true);
        addTextToDraft('☹');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true, 'should send message');
    });

    it('should send emoji messages in Markdown', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(false);
        addTextToDraft('☹');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true, 'should send message');
    });

    // FIXME
    // it('should convert basic Markdown to rich text correctly', () => {
    //     const spy = sinon.spy(client, 'sendHtmlMessage');
    //     mci.enableRichtext(false);
    //     addTextToDraft('*abc*');
    //     mci.handleKeyCommand('toggle-mode');
    //     mci.handleReturn(sinon.stub());
    //     console.error(spy.args[0][2]);
    //     expect(spy.args[0][2]).toContain('<em>abc');
    // });
    //
    // it('should convert basic rich text to Markdown correctly', () => {
    //     const spy = sinon.spy(client, 'sendHtmlMessage');
    //     mci.enableRichtext(true);
    //     process.nextTick(() => {
    //
    //     });
    //     mci.handleKeyCommand('italic');
    //     addTextToDraft('abc');
    //     mci.handleKeyCommand('toggle-mode');
    //     mci.handleReturn(sinon.stub());
    //     expect(['_abc_', '*abc*']).toContain(spy.args[0][1]);
    // });

    it('should insert formatting characters in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(false);
        mci.handleKeyCommand('italic');
        mci.handleReturn(sinon.stub());
        expect(['__', '**']).toContain(spy.args[0][1]);
    });

});
