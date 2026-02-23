/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Copies the component description and props documentation from a View's
 * `__docgenInfo` (injected at build time by Storybook's react-docgen-typescript
 * Vite plugin) onto the story wrapper component.
 *
 * This lets Storybook's default `extractComponentDescription` pick up the
 * View's JSDoc and display per-field descriptions in the ArgTypes table.
 *
 * **Important:** the wrapper must be defined as a named variable *before*
 * being passed here so that react-docgen-typescript can extract its props.
 *
 * @example
 * ```ts
 * const MyViewWrapperImpl = (props: MyViewProps) => {
 *     const vm = useMockedViewModel(props, {});
 *     return <MyView vm={vm} />;
 * };
 * const MyViewWrapper = withViewDocs(MyViewWrapperImpl, MyView);
 * ```
 */
export function withViewDocs<T extends (...args: never[]) => unknown>(wrapper: T, view: object): T {
    const viewInfo = (view as { __docgenInfo?: DocgenInfo }).__docgenInfo;
    const viewDescription = viewInfo?.description;
    if (!viewDescription) return wrapper;

    // The wrapper must be defined as a named variable (not inline) so that
    // react-docgen-typescript can extract its props.  The docgen Vite plugin
    // appends a `Wrapper.__docgenInfo = { … }` assignment at the *end* of the
    // module, which runs **after** this function.  We install a setter trap so
    // that the View's description is merged into the generated info.
    let stored: DocgenInfo | undefined = (wrapper as { __docgenInfo?: DocgenInfo }).__docgenInfo;
    Object.defineProperty(wrapper, "__docgenInfo", {
        get() {
            return stored;
        },
        set(incoming: DocgenInfo) {
            stored = {
                ...incoming,
                description: incoming.description || viewDescription,
            };
        },
        configurable: true,
        enumerable: true,
    });

    // Also apply immediately for the current state.
    stored = { ...stored, description: viewDescription };

    return wrapper;
}

interface DocgenInfo {
    description?: string;
    props?: Record<string, unknown>;
}
