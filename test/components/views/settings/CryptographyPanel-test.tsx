import '../../../skinned-sdk';
import * as TestUtils from '../../../test-utils';

import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import React, { ReactElement } from 'react';
import ReactDOM from 'react-dom';

import { MatrixClient } from 'matrix-js-sdk';
import CryptographyPanel from '../../../../src/components/views/settings/CryptographyPanel';

describe('CryptographyPanel', () => {
    it('shows the session ID and key', () => {
        const sessionId = "ABCDEFGHIJ";
        const sessionKey = "AbCDeFghIJK7L/m4nOPqRSTUVW4xyzaBCDef6gHIJkl";
        const sessionKeyFormatted = "<b>AbCD eFgh IJK7 L/m4 nOPq RSTU VW4x yzaB CDef 6gHI Jkl</b>";

        TestUtils.stubClient();
        const client: MatrixClient = MatrixClientPeg.get();
        client.deviceId = sessionId;
        client.getDeviceEd25519Key = () => sessionKey;

        // When we render the CryptographyPanel
        const rendered = render(<CryptographyPanel />);

        // Then it displays info about the user's session
        const codes = rendered.querySelectorAll("code");
        expect(codes.length).toEqual(2);
        expect(codes[0].innerHTML).toEqual(sessionId);
        expect(codes[1].innerHTML).toEqual(sessionKeyFormatted);
    });
});

function render(component: ReactElement<CryptographyPanel>): HTMLDivElement {
    const parentDiv = document.createElement('div');
    document.body.appendChild(parentDiv);
    ReactDOM.render(component, parentDiv);
    return parentDiv;
}
