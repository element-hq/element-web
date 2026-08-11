/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { SectionCreationViewModel } from "./SectionCreationViewModel";

describe("SectionCreationViewModel", () => {
    let onFinished: Mock<(shouldCreateSection: boolean, sectionName: string) => void>;

    beforeEach(() => {
        onFinished = vi.fn();
    });

    describe("creation mode (no section to edit)", () => {
        it("should initialize an empty, invalid snapshot", () => {
            const vm = new SectionCreationViewModel({ onFinished });

            expect(vm.getSnapshot()).toEqual({ value: "", isEdition: false, isSectionValid: false });
        });

        it("should not call onFinished on createOrEditSection while invalid", () => {
            const vm = new SectionCreationViewModel({ onFinished });

            vm.createOrEditSection();
            expect(onFinished).not.toHaveBeenCalled();
        });
    });

    describe("edition mode (existing section name)", () => {
        it("should initialize the snapshot from the section name", () => {
            const vm = new SectionCreationViewModel({ onFinished, sectionToEdit: "My section" });

            expect(vm.getSnapshot()).toEqual({ value: "My section", isEdition: true, isSectionValid: true });
        });
    });

    describe("setSection", () => {
        it("should update the value and mark it valid for a non-empty name", () => {
            const vm = new SectionCreationViewModel({ onFinished });

            vm.setSection("General");
            expect(vm.getSnapshot()).toMatchObject({ value: "General", isSectionValid: true });
        });

        it("should mark a whitespace-only name as invalid", () => {
            const vm = new SectionCreationViewModel({ onFinished });

            vm.setSection("   ");
            expect(vm.getSnapshot()).toMatchObject({ value: "   ", isSectionValid: false });
        });
    });

    describe("createOrEditSection", () => {
        it("should call onFinished with the current value once the name is valid", () => {
            const vm = new SectionCreationViewModel({ onFinished });

            vm.setSection("General");
            vm.createOrEditSection();

            expect(onFinished).toHaveBeenCalledWith(true, "General");
        });

        it("should not call onFinished when the name is emptied", () => {
            const vm = new SectionCreationViewModel({ onFinished, sectionToEdit: "My section" });

            vm.setSection("");
            vm.createOrEditSection();

            expect(onFinished).not.toHaveBeenCalled();
        });
    });
});
