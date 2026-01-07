# MVVM

General description of the pattern can be found [here](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel). But the gist of it is that you divide your code into three sections:

1. Model: This is where the business logic and data resides.
2. View Model: This code exists to provide the logic necessary for the UI. It directly uses the Model code.
3. View: This is the UI code itself and depends on the view model.

If you do MVVM right, your view should be dumb i.e it gets data from the view model and merely displays it.

### Practical guidelines for MVVM in element-web

A first documentation and implementation of MVVM was done in [MVVM-v1.md](MVVM-v1.md). This v1 version is now deprecated and this document describes the current implementation.

#### Model

This is anywhere your data or business logic comes from. If your view model is accessing something simple exposed from `matrix-js-sdk`, then the sdk is your model. If you're using something more high level in element-web to get your data/logic (eg: `MemberListStore`), then that becomes your model.

#### View

1. Located in [`shared-components`](https://github.com/element-hq/element-web/tree/develop/packages/shared-components). Develop it in storybook!
2. Views are simple react components (eg: `FooView`).
3. Views use [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) internally where the view model is the external store.
4. Views should define the interface of the view model they expect:

    ```tsx
    // Snapshot is the return type of your view model
    interface FooViewSnapshot {
        value: string;
    }

    // To call function on the view model
    interface FooViewActions {
        doSomething: () => void;
    }

    // ViewModel is a type defining the methods needed for `useSyncExternalStore`
    // https://github.com/element-hq/element-web/blob/develop/packages/shared-components/src/ViewModel.ts
    type FooViewModel = ViewModel<FooViewSnapshot> & FooViewActions;

    interface FooViewProps {
        vm: FooViewModel;
    }

    function FooView({ vm }: FooViewProps) {
        // useViewModel is a helper function that uses useSyncExternalStore under the hood
        const { value } = useViewModel(vm);
        return (
            <button type="button" onClick={() => vm.doSomething()}>
                {value}
            </button>
        );
    }
    ```

5. Multiple views can share the same view model if necessary.
6. A full example is available [here](https://github.com/element-hq/element-web/blob/develop/packages/shared-components/src/audio/AudioPlayerView/AudioPlayerView.tsx)

#### View Model

1. A View model is a class extending [`BaseViewModel`](https://github.com/element-hq/element-web/blob/develop/src/viewmodels/base/BaseViewModel.ts).
2. Implements the interface defined in the view (e.g `FooViewModel` in the example above).
3. View models define a snapshot type that defines the data the view will consume. The snapshot is immutable and can only be changed by calling `this.snapshot.set(...)` in the view model. This will trigger a re-render in the view.

    ```ts
    interface Props {
        propsValue: string;
    }

    class FooViewModel extends BaseViewModel<FooViewSnapshot, Props> implements FooViewModel {
        constructor(props: Props) {
            // Call super with initial snapshot
            super(props, { value: "initial" });
        }

        public doSomething() {
            // Call this.snapshot.set to update the snapshot
            this.snapshot.set({ value: "changed" });
        }
    }
    ```

4. A full example is available [here](https://github.com/element-hq/element-web/blob/develop/src/viewmodels/audio/AudioPlayerViewModel.ts)

### Benefits

1. MVVM forces a separation of concern i.e we will no longer have large react components that have a lot of state and rendering code mixed together. This improves code readability and makes it easier to introduce changes.
2. Introduces the possibility of code reuse. You can reuse an old view model with a new view or vice versa.
3. Adding to the point above, in future you could import element-web view models to your project and supply your own views thus creating something similar to the [hydrogen sdk](https://github.com/element-hq/hydrogen-web/blob/master/doc/SDK.md).
