/*
Copyright 2017 Vector Creations Ltd

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

const React = require('react');
const ReactDOM = require('react-dom');
const ReactTestUtils = require('react-addons-test-utils');
const expect = require('expect');

const testUtils = require('test-utils');

const sdk = require('matrix-react-sdk');
const Registration = sdk.getComponent('structures.login.Registration');

let rtsClient;
let client;

const TEAM_CONFIG = {
    supportEmail: 'support@some.domain',
    teamServerURL: 'http://someteamserver.bla',
};

const CREDENTIALS = {userId: '@me:here'};
const MOCK_REG_RESPONSE = {
    user_id: CREDENTIALS.userId,
    device_id: 'mydevice',
    access_token: '2234569864534231',
};

describe('Registration', function() {
    beforeEach(function() {
        testUtils.beforeEach(this);
        client = testUtils.createTestClient();
        client.credentials = CREDENTIALS;

        // Mock an RTS client that supports one team and naively returns team tokens when
        // tracking by mapping email SIDs to team tokens. This is fine because we only
        // want to assert the client behaviour such that a user recognised by the
        // rtsClient (which would normally talk to the RTS server) as a team member is
        // correctly logged in as one (and other such assertions).
        rtsClient = testUtils.createTestRtsClient(
            {
                'myawesometeam123': {
                    name: 'Team Awesome',
                    domain: 'team.awesome.net',
                },
            },
            {'someEmailSid1234': 'myawesometeam123'},
        );
    });

    it('should track a referral following successful registration of a team member', function(done) {
        const expectedCreds = {
            userId: MOCK_REG_RESPONSE.user_id,
            deviceId: MOCK_REG_RESPONSE.device_id,
            homeserverUrl: client.getHomeserverUrl(),
            identityServerUrl: client.getIdentityServerUrl(),
            accessToken: MOCK_REG_RESPONSE.access_token,
        };
        const onLoggedIn = function(creds, teamToken) {
            expect(creds).toEqual(expectedCreds);
            expect(teamToken).toBe('myawesometeam123');
            done();
        };

        const res = ReactTestUtils.renderIntoDocument(
            <Registration
                teamServerConfig={TEAM_CONFIG}
                onLoggedIn={onLoggedIn}
                rtsClient={rtsClient}
            />,
        );

        res._onUIAuthFinished(true, MOCK_REG_RESPONSE, {emailSid: 'someEmailSid1234'});
    });

    it('should NOT track a referral following successful registration of a non-team member', function(done) {
        const onLoggedIn = expect.createSpy().andCall(function(creds, teamToken) {
            expect(teamToken).toNotExist();
            done();
        });

        const res = ReactTestUtils.renderIntoDocument(
            <Registration
                teamServerConfig={TEAM_CONFIG}
                onLoggedIn={onLoggedIn}
                rtsClient={rtsClient}
            />,
        );

        res._onUIAuthFinished(true, MOCK_REG_RESPONSE, {emailSid: 'someOtherEmailSid11'});
    });
});
