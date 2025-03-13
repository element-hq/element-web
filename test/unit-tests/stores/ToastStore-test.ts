/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import GenericToast from "../../../src/components/views/toasts/GenericToast";
import ToastStore, { type IToast } from "../../../src/stores/ToastStore";

describe("ToastStore", () => {
    const makeToast = (priority: number, key?: string): IToast<typeof GenericToast> => ({
        key: key ?? `toast-${priority}`,
        title: "Test toast",
        component: GenericToast,
        priority,
    });

    it("sets instance on window when doesnt exist", () => {
        const sharedInstance = ToastStore.sharedInstance();
        expect(sharedInstance).toBeTruthy();
        // using same instance
        expect(ToastStore.sharedInstance()).toBe(sharedInstance);
    });

    describe("addOrReplaceToast()", () => {
        it("adds a toast to an empty store", () => {
            const toast = makeToast(1);
            const store = new ToastStore();
            const emitSpy = jest.spyOn(store, "emit");
            store.addOrReplaceToast(toast);
            expect(emitSpy).toHaveBeenCalledWith("update");
            expect(store.getToasts()).toEqual([toast]);
        });

        it("inserts toast according to priority", () => {
            const toast1 = makeToast(1);
            const toast3a = makeToast(3, "a");
            const toast3b = makeToast(3, "b");
            const toast99 = makeToast(99);
            const store = new ToastStore();
            store.addOrReplaceToast(toast1);
            store.addOrReplaceToast(toast99);
            store.addOrReplaceToast(toast3a);
            store.addOrReplaceToast(toast3b);
            // ascending order, newest toast of given priority first
            expect(store.getToasts()).toEqual([toast99, toast3a, toast3b, toast1]);
        });

        it("replaces toasts by key without changing order", () => {
            const toastA = makeToast(1, "a");
            const toastB = makeToast(3, "b");
            const toastC = makeToast(99, "c");
            const store = new ToastStore();
            store.addOrReplaceToast(toastA);
            store.addOrReplaceToast(toastC);
            store.addOrReplaceToast(toastB);
            expect(store.getToasts()).toEqual([toastC, toastB, toastA]);

            const toastBNew = makeToast(5, "b");
            store.addOrReplaceToast(toastBNew);
            expect(store.getToasts()).toEqual([toastC, toastBNew, toastA]);
        });
    });

    describe("dismissToast()", () => {
        it("does nothing when there are no toasts", () => {
            const store = new ToastStore();
            const emitSpy = jest.spyOn(store, "emit");

            store.dismissToast("whatever");

            expect(store.getCountSeen()).toEqual(0);
            expect(emitSpy).not.toHaveBeenCalled();
        });

        it("removes toast and emits", () => {
            const store = new ToastStore();
            const toastA = makeToast(1, "a");
            const toastB = makeToast(3, "b");
            store.addOrReplaceToast(toastA);
            store.addOrReplaceToast(toastB);
            const emitSpy = jest.spyOn(store, "emit");

            store.dismissToast(toastA.key);

            expect(store.getCountSeen()).toEqual(0);
            expect(emitSpy).toHaveBeenCalledWith("update");
            expect(store.getToasts()).toEqual([toastB]);
        });

        it("increments countSeen when toast has bottom priority", () => {
            const store = new ToastStore();
            const toastA = makeToast(1, "a");
            const toastB = makeToast(3, "b");
            const toastC = makeToast(99, "c");
            store.addOrReplaceToast(toastA);
            store.addOrReplaceToast(toastC);
            store.addOrReplaceToast(toastB);
            const emitSpy = jest.spyOn(store, "emit");

            store.dismissToast(toastC.key);

            expect(store.getCountSeen()).toEqual(1);
            expect(emitSpy).toHaveBeenCalledWith("update");
        });

        it("resets countSeen when no toasts remain", () => {
            const store = new ToastStore();
            const toastA = makeToast(1, "a");
            const toastB = makeToast(3, "b");
            store.addOrReplaceToast(toastA);
            store.addOrReplaceToast(toastB);

            store.dismissToast(toastB.key);
            expect(store.getCountSeen()).toEqual(1);
            store.dismissToast(toastA.key);
            expect(store.getCountSeen()).toEqual(0);
        });
    });

    describe("reset()", () => {
        it("clears countseen and toasts", () => {
            const store = new ToastStore();
            const toastA = makeToast(1, "a");
            const toastB = makeToast(3, "b");
            store.addOrReplaceToast(toastA);
            store.addOrReplaceToast(toastB);
            // increment count seen
            store.dismissToast(toastB.key);

            store.reset();
            expect(store.getCountSeen()).toEqual(0);
            expect(store.getToasts()).toEqual([]);
        });
    });
});
