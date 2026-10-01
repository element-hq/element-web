/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { useViewModel } from "../../core/viewmodel";

import styles from "./SectionCreationView.module.css";
import { type SectionCreationViewModel } from "./types";
import { SectionFormView } from "./SectionFormView";
import { RoomPickerView } from "../../core/RoomPickerView";

interface SectionCreationViewProps {
    /**
     * The view model for the section creation component.
     */
    vm: SectionCreationViewModel;
}

/**
 * A form component to create a new room list section or edit an existing one.
 * In creation mode it shows an explanatory description; in editing mode it is pre-filled
 * with the current section name.
 *
 * @example
 * ```tsx
 * <SectionCreationView vm={sectionCreationViewModel} />
 * ```
 */
export function SectionCreationView({ vm }: Readonly<SectionCreationViewProps>): JSX.Element {
    const { step } = useViewModel(vm);

    return (
        <>
            {(step === "creation" || step === "editing") && <SectionFormView vm={vm} className={styles.container} />}
            {step === "add_rooms" && <RoomPickerView vm={vm} className={styles.container} />}
        </>
    );
}
