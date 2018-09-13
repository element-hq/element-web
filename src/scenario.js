/*
Copyright 2018 New Vector Ltd

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


const {range} = require('./util');
const signup = require('./usecases/signup');
const acceptServerNoticesInviteAndConsent = require('./usecases/server-notices-consent');
const roomDirectoryScenarios = require('./scenarios/directory');
const lazyLoadingScenarios = require('./scenarios/lazy-loading');
const e2eEncryptionScenarios = require('./scenarios/e2e-encryption');

module.exports = async function scenario(createSession, restCreator) {
    async function createUser(username) {
        const session = await createSession(username);
        await signup(session, session.username, 'testtest', session.hsUrl);
        await acceptServerNoticesInviteAndConsent(session);
        return session;
    }

    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const charlies = await createRestUsers(restCreator);

    await roomDirectoryScenarios(alice, bob);
    await e2eEncryptionScenarios(alice, bob);
    await lazyLoadingScenarios(alice, bob, charlies);
}

async function createRestUsers(restCreator) {
    const usernames = range(1, 10).map((i) => `charly-${i}`);
    const charlies = await restCreator.createSessionRange(usernames, 'testtest');
    await charlies.setDisplayName((s) => `Charly #${s.userName().split('-')[1]}`);
    return charlies;
}
