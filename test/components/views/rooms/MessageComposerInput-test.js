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

    beforeEach(function() {
        testUtils.beforeEach(this);
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

    afterEach((done) => {
        // hack: let the component finish mounting before unmounting, to avoid
        // warnings
        // (please can we make the components not setState() after
        // they are unmounted?)
        Q.delay(10).done(() => {
            if (parentDiv) {
                ReactDOM.unmountComponentAtNode(parentDiv);
                parentDiv.remove();
                parentDiv = null;
            }
            sandbox.restore();
            done();
        })
    });

    // XXX this fails
    xit('should change mode if indicator is clicked', (done) => {
        mci.enableRichtext(true);

        setTimeout(() => {
            const indicator = ReactTestUtils.findRenderedDOMComponentWithClass(
                mci,
                'mx_MessageComposer_input_markdownIndicator');
            ReactTestUtils.Simulate.click(indicator);

            expect(mci.state.isRichtextEnabled).toEqual(false, 'should have changed mode');
            done();
        });
    });

    it('should not send messages when composer is empty', () => {
        const textSpy = sinon.spy(client, 'sendTextMessage');
        const htmlSpy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(true);
        mci.handleReturn(sinon.stub());

        expect(textSpy.calledOnce).toEqual(false, 'should not send text message');
        expect(htmlSpy.calledOnce).toEqual(false, 'should not send html message');
    });

    it('should not change content unnecessarily on RTE -> Markdown conversion', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(true);
        addTextToDraft('a');
        mci.handleKeyCommand('toggle-mode');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('a');
    });

    it('should not change content unnecessarily on Markdown -> RTE conversion', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('a');
        mci.handleKeyCommand('toggle-mode');
        mci.handleReturn(sinon.stub());
        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('a');
    });

    it('should send emoji messages in rich text', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(true);
        addTextToDraft('☹');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true, 'should send message');
    });

    it('should send emoji messages in Markdown', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
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
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        mci.handleKeyCommand('italic');
        mci.handleReturn(sinon.stub());
        expect(['__', '**']).toContain(spy.args[0][1]);
    });

    it('should not entity-encode " in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('"');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('"');
    });

    it('should escape characters without other markup in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('\\*escaped\\*');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('*escaped*');
    });

    it('should escape characters with other markup in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(false);
        addTextToDraft('\\*escaped\\* *italic*');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('\\*escaped\\* *italic*');
        expect(spy.args[0][2]).toEqual('*escaped* <em>italic</em>');
    });

    it('should not convert -_- into a horizontal rule in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('-_-');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('-_-');
    });

    it('should not strip <del> tags in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendHtmlMessage');
        mci.enableRichtext(false);
        addTextToDraft('<del>striked-out</del>');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('<del>striked-out</del>');
        expect(spy.args[0][2]).toEqual('<del>striked-out</del>');
    });

    it('should not strike-through ~~~ in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('~~~striked-out~~~');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('~~~striked-out~~~');
    });

    it('should not mark single unmarkedup paragraphs as HTML in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
    });

    it('should not mark two unmarkedup paragraphs as HTML in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendTextMessage');
        mci.enableRichtext(false);
        addTextToDraft('Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nFusce congue sapien sed neque molestie volutpat.');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1]).toEqual('Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nFusce congue sapien sed neque molestie volutpat.');
    });
});
