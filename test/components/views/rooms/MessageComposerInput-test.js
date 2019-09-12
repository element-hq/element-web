import React from 'react';
import ReactTestUtils from 'react-dom/test-utils';
import ReactDOM from 'react-dom';
import expect from 'expect';
import sinon from 'sinon';
import Promise from 'bluebird';
import * as testUtils from '../../../test-utils';
import sdk from 'matrix-react-sdk';
const MessageComposerInput = sdk.getComponent('views.rooms.MessageComposerInput');
import MatrixClientPeg from '../../../../src/MatrixClientPeg';

function addTextToDraft(text) {
    const components = document.getElementsByClassName('public-DraftEditor-content');
    if (components && components.length) {
        const textarea = components[0];
        const textEvent = document.createEvent('TextEvent');
        textEvent.initTextEvent('textInput', true, true, null, text);
        textarea.dispatchEvent(textEvent);
    }
}

// FIXME: These tests need to be updated from Draft to Slate.

xdescribe('MessageComposerInput', () => {
    let parentDiv = null,
        sandbox = null,
        client = null,
        mci = null,
        room = testUtils.mkStubRoom('!DdJkzRliezrwpNebLk:matrix.org');

    beforeEach(function() {
        testUtils.beforeEach(this);
        sandbox = testUtils.stubClient(sandbox);
        client = MatrixClientPeg.get();
        client.credentials = {userId: '@me:domain.com'};

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
        Promise.delay(10).done(() => {
            if (parentDiv) {
                ReactDOM.unmountComponentAtNode(parentDiv);
                parentDiv.remove();
                parentDiv = null;
            }
            sandbox.restore();
            done();
        });
    });

    // XXX this fails
    xit('should change mode if indicator is clicked', (done) => {
        mci.enableRichtext(true);

        setTimeout(() => {
            const indicator = ReactTestUtils.findRenderedDOMComponentWithClass(
                mci,
                'mx_MessageComposer_input_markdownIndicator');
            ReactTestUtils.Simulate.click(indicator);

            expect(mci.state.isRichTextEnabled).toEqual(false, 'should have changed mode');
            done();
        });
    });

    it('should not send messages when composer is empty', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(true);
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(false, 'should not send message');
    });

    it('should not change content unnecessarily on RTE -> Markdown conversion', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(true);
        addTextToDraft('a');
        mci.handleKeyCommand('toggle-mode');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('a');
    });

    it('should not change content unnecessarily on Markdown -> RTE conversion', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('a');
        mci.handleKeyCommand('toggle-mode');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('a');
    });

    it('should send emoji messages when rich text is enabled', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(true);
        addTextToDraft('☹');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true, 'should send message');
    });

    it('should send emoji messages when Markdown is enabled', () => {
        const spy = sinon.spy(client, 'sendMessage');
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
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        mci.handleKeyCommand('italic');
        mci.handleReturn(sinon.stub());
        expect(['__', '**']).toContain(spy.args[0][1].body);
    });

    it('should not entity-encode " in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('"');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('"');
    });

    it('should escape characters without other markup in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('\\*escaped\\*');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('*escaped*');
    });

    it('should escape characters with other markup in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('\\*escaped\\* *italic*');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('\\*escaped\\* *italic*');
        expect(spy.args[0][1].formatted_body).toEqual('*escaped* <em>italic</em>');
    });

    it('should not convert -_- into a horizontal rule in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('-_-');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('-_-');
    });

    it('should not strip <del> tags in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('<del>striked-out</del>');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('<del>striked-out</del>');
        expect(spy.args[0][1].formatted_body).toEqual('<del>striked-out</del>');
    });

    it('should not strike-through ~~~ in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('~~~striked-out~~~');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('~~~striked-out~~~');
    });

    it('should not mark single unmarkedup paragraphs as HTML in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
    });

    it('should not mark two unmarkedup paragraphs as HTML in Markdown mode', () => {
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        addTextToDraft('Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nFusce congue sapien sed neque molestie volutpat.');
        mci.handleReturn(sinon.stub());

        expect(spy.calledOnce).toEqual(true);
        expect(spy.args[0][1].body).toEqual('Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\nFusce congue sapien sed neque molestie volutpat.');
    });

    it('should strip tab-completed mentions so that only the display name is sent in the plain body in Markdown mode', () => {
        // Sending a HTML message because we have entities in the composer (because of completions)
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(false);
        mci.setDisplayedCompletion({
            completion: 'Some Member',
            selection: mci.state.editorState.getSelection(),
            href: `https://matrix.to/#/@some_member:domain.bla`,
        });

        mci.handleReturn(sinon.stub());

        expect(spy.args[0][1].body).toEqual(
            'Some Member',
            'the plaintext body should only include the display name',
        );
        expect(spy.args[0][1].formatted_body).toEqual(
            '<a href="https://matrix.to/#/@some_member:domain.bla">Some Member</a>',
            'the html body should contain an anchor tag with a matrix.to href and display name text',
        );
    });

    it('should strip tab-completed mentions so that only the display name is sent in the plain body in RTE mode', () => {
        // Sending a HTML message because we have entities in the composer (because of completions)
        const spy = sinon.spy(client, 'sendMessage');
        mci.enableRichtext(true);
        mci.setDisplayedCompletion({
            completion: 'Some Member',
            selection: mci.state.editorState.getSelection(),
            href: `https://matrix.to/#/@some_member:domain.bla`,
        });

        mci.handleReturn(sinon.stub());

        expect(spy.args[0][1].body).toEqual('Some Member');
        expect(spy.args[0][1].formatted_body).toEqual('<a href="https://matrix.to/#/@some_member:domain.bla">Some Member</a>');
    });

    it('should not strip non-tab-completed mentions when manually typing MD', () => {
        // Sending a HTML message because we have entities in the composer (because of completions)
        const spy = sinon.spy(client, 'sendMessage');
        // Markdown mode enabled
        mci.enableRichtext(false);
        addTextToDraft('[My Not-Tab-Completed Mention](https://matrix.to/#/@some_member:domain.bla)');

        mci.handleReturn(sinon.stub());

        expect(spy.args[0][1].body).toEqual('[My Not-Tab-Completed Mention](https://matrix.to/#/@some_member:domain.bla)');
        expect(spy.args[0][1].formatted_body).toEqual('<a href="https://matrix.to/#/@some_member:domain.bla">My Not-Tab-Completed Mention</a>');
    });

    it('should not strip arbitrary typed (i.e. not tab-completed) MD links', () => {
        // Sending a HTML message because we have entities in the composer (because of completions)
        const spy = sinon.spy(client, 'sendMessage');
        // Markdown mode enabled
        mci.enableRichtext(false);
        addTextToDraft('[Click here](https://some.lovely.url)');

        mci.handleReturn(sinon.stub());

        expect(spy.args[0][1].body).toEqual('[Click here](https://some.lovely.url)');
        expect(spy.args[0][1].formatted_body).toEqual('<a href="https://some.lovely.url">Click here</a>');
    });
});
