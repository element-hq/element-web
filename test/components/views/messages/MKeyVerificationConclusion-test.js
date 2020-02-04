import React from 'react';
import TestRenderer from 'react-test-renderer';
import { EventEmitter } from 'events';
import * as TestUtils from '../../../test-utils';

import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import { MatrixEvent } from 'matrix-js-sdk';
import MKeyVerificationConclusion from '../../../../src/components/views/messages/MKeyVerificationConclusion';

const trustworthy = () => ({ isCrossSigningVerified: () => true });
const untrustworthy = () => ({ isCrossSigningVerified: () => false });

describe("MKeyVerificationConclusion", () => {
    beforeEach(() => {
        TestUtils.stubClient();
        const client = MatrixClientPeg.get();
        client.checkUserTrust = trustworthy;

        const emitter = new EventEmitter();
        client.on = emitter.on.bind(emitter);
        client.removeListener = emitter.removeListener.bind(emitter);
        client.emit = emitter.emit.bind(emitter);
    });

    it("shouldn't render if there's no verificationRequest", () => {
        const event = new MatrixEvent({});
        const renderer = TestRenderer.create(
            <MKeyVerificationConclusion mxEvent={event} />,
        );
        expect(renderer.toJSON()).toBeNull();
    });

    it("shouldn't render if the verificationRequest is pending", () => {
        const event = new MatrixEvent({});
        event.verificationRequest = new EventEmitter();
        event.verificationRequest.pending = true;
        const renderer = TestRenderer.create(
            <MKeyVerificationConclusion mxEvent={event} />,
        );
        expect(renderer.toJSON()).toBeNull();
    });

    it("shouldn't render if the event type is cancel but the request type isn't", () => {
        const event = new MatrixEvent({ type: "m.key.verification.cancel" });
        event.verificationRequest = new EventEmitter();
        event.verificationRequest.cancelled = false;
        const renderer = TestRenderer.create(
            <MKeyVerificationConclusion mxEvent={event} />,
        );
        expect(renderer.toJSON()).toBeNull();
    });

    it("shouldn't render if the event type is done but the request type isn't", () => {
        const event = new MatrixEvent({ type: "m.key.verification.done" });
        event.verificationRequest = new EventEmitter();
        event.verificationRequest.done = false;
        const renderer = TestRenderer.create(
            <MKeyVerificationConclusion mxEvent={event} />,
        );
        expect(renderer.toJSON()).toBeNull();
    });

    it("shouldn't render if the user isn't actually trusted", () => {
        const client = MatrixClientPeg.get();
        client.checkUserTrust = untrustworthy;

        const event = new MatrixEvent({ type: "m.key.verification.done" });
        event.verificationRequest = new EventEmitter();
        event.verificationRequest.done = true;
        const renderer = TestRenderer.create(
            <MKeyVerificationConclusion mxEvent={event} />,
        );
        expect(renderer.toJSON()).toBeNull();
    });

    it("should rerender appropriately if user trust status changes", () => {
        const client = MatrixClientPeg.get();
        client.checkUserTrust = untrustworthy;

        const event = new MatrixEvent({ type: "m.key.verification.done" });
        event.verificationRequest = new EventEmitter();
        event.verificationRequest.done = true;
        event.verificationRequest.otherUserId = "@someuser:domain";
        const renderer = TestRenderer.create(
            <MKeyVerificationConclusion mxEvent={event} />,
        );
        expect(renderer.toJSON()).toBeNull();

        client.checkUserTrust = trustworthy;

        /* Ensure we don't rerender for every trust status change of any user */
        client.emit("userTrustStatusChanged", "@anotheruser:domain");
        expect(renderer.toJSON()).toBeNull();

        /* But when our user changes, we do rerender */
        client.emit("userTrustStatusChanged", event.verificationRequest.otherUserId);
        expect(renderer.toJSON()).not.toBeNull();
    });
});
