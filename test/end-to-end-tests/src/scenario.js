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
const toastScenarios = require('./scenarios/toast');
const roomDirectoryScenarios = require('./scenarios/directory');
const lazyLoadingScenarios = require('./scenarios/lazy-loading');
const e2eEncryptionScenarios = require('./scenarios/e2e-encryption');

module.exports = async function scenario(createSession, restCreator) {
    let firstUser = true;
    async function createUser(username) {
        const session = await createSession(username);
        if (firstUser) {
            // only show browser version for first browser opened
            console.log(`running tests on ${await session.browser.version()} ...`);
            firstUser = false;
        }
        await signup(session, session.username, 'testsarefun!!!', session.hsUrl);
        return session;
    }

    const alice = await createUser("alice");
    const bob = await createUser("bob");

    await toastScenarios(alice, bob);
    await roomDirectoryScenarios(alice, bob);
    await e2eEncryptionScenarios(alice, bob);
    console.log("create REST users:");
    const charlies = await createRestUsers(restCreator);
    await lazyLoadingScenarios(alice, bob, charlies);
};

async function createRestUsers(restCreator) {
    const usernames = range(1, 10).map((i) => `charly-${i}`);
    const charlies = await restCreator.createSessionRange(usernames, "testtest", "charly-1..10");
    await charlies.setDisplayName((s) => `Charly #${s.userName().split('-')[1]}`);
    return charlies;
}
