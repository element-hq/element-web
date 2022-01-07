/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { assertNoToasts, acceptToast, rejectToast } from "../usecases/toasts";
import { ElementSession } from "../session";

export async function toastScenarios(alice: ElementSession, bob: ElementSession): Promise<void> {
    console.log(" checking and clearing toasts:");

    alice.log.startGroup(`clears toasts`);
    alice.log.step(`reject desktop notifications toast`);
    await rejectToast(alice, "Notifications");
    alice.log.done();

    alice.log.step(`accepts analytics toast`);
    await acceptToast(alice, "Help improve Element");
    await rejectToast(alice, "Testing small changes");
    alice.log.done();

    alice.log.step(`checks no remaining toasts`);
    await assertNoToasts(alice);
    alice.log.done();
    alice.log.endGroup();

    bob.log.startGroup(`clears toasts`);
    bob.log.step(`reject desktop notifications toast`);
    await rejectToast(bob, "Notifications");
    bob.log.done();

    bob.log.step(`reject analytics toast`);
    await rejectToast(bob, "Help improve Element");
    await rejectToast(bob, "Testing small changes");
    bob.log.done();

    bob.log.step(`checks no remaining toasts`);
    await assertNoToasts(bob);
    bob.log.done();
    bob.log.endGroup();
}
