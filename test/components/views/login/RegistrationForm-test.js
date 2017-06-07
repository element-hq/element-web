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
const ReactDOM = require("react-dom");
const ReactTestUtils = require('react-addons-test-utils');
const expect = require('expect');

const testUtils = require('test-utils');

const sdk = require('matrix-react-sdk');
const RegistrationForm = sdk.getComponent('views.login.RegistrationForm');

const TEAM_CONFIG = {
    supportEmail: "support@some.domain",
    teams: [
        { name: "The Team Org.", domain: "team.ac.uk" },
        { name: "The Super Team", domain: "superteam.ac.uk" },
    ],
};

function doInputEmail(inputEmail, onTeamSelected) {
    const res = ReactTestUtils.renderIntoDocument(
        <RegistrationForm
            teamsConfig={TEAM_CONFIG}
            onTeamSelected={onTeamSelected}
        />,
    );

    const teamInput = res.refs.email;
    teamInput.value = inputEmail;

    ReactTestUtils.Simulate.change(teamInput);
    ReactTestUtils.Simulate.blur(teamInput);

    return res;
}

function expectTeamSelectedFromEmailInput(inputEmail, expectedTeam) {
    const onTeamSelected = expect.createSpy();
    doInputEmail(inputEmail, onTeamSelected);

    expect(onTeamSelected).toHaveBeenCalledWith(expectedTeam);
}

function expectSupportFromEmailInput(inputEmail, isSupportShown) {
    const onTeamSelected = expect.createSpy();
    const res = doInputEmail(inputEmail, onTeamSelected);

    expect(res.state.showSupportEmail).toBe(isSupportShown);
}

describe('RegistrationForm', function() {
    beforeEach(function() {
        testUtils.beforeEach(this);
    });

    it('should select a team when a team email is entered', function() {
        expectTeamSelectedFromEmailInput("member@team.ac.uk", TEAM_CONFIG.teams[0]);
    });

    it('should not select a team when an unrecognised team email is entered', function() {
        expectTeamSelectedFromEmailInput("member@someunknownteam.ac.uk", null);
    });

    it('should show support when an unrecognised team email is entered', function() {
        expectSupportFromEmailInput("member@someunknownteam.ac.uk", true);
    });

    it('should NOT show support when an unrecognised non-team email is entered', function() {
        expectSupportFromEmailInput("someone@yahoo.com", false);
    });
});
