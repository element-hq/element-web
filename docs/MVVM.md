# MVVM

General description of the pattern can be found [here](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel). But the gist of it is that you divide your code into three sections:

1. Model: This is where the business logic and data resides.
2. View Model: This code exists to provide the logic necessary for the UI. It directly uses the Model code.
3. View: This is the UI code itself and depends on the view model.

If you do MVVM right, your view should be dumb i.e it gets data from the view model and merely displays it.

## Why are we using MVVM?

1. MVVM forces a separation of concern i.e we will no longer have large react components that have a lot of state and rendering code mixed together. This improves code readability and makes it easier to introduce changes.
2. Introduces the possibility of code reuse. You can reuse an old view model with a new view or vice versa.
3. Adding to the point above, in future you could import element-web view models to your project and supply your own views thus creating something similar to the [hydrogen sdk](https://github.com/element-hq/hydrogen-web/blob/master/doc/SDK.md).

## Practical guidelines for MVVM in element-web

A first documentation and implementation of MVVM was done in [MVVM-v1.md](MVVM-v1.md). This v1 version is now deprecated and this document describes the current implementation.

#### Model

This is anywhere your data or business logic comes from. If your view model is accessing something simple exposed from `matrix-js-sdk`, then the sdk is your model. If you're using something more high level in element-web to get your data/logic (eg: `MemberListStore`), then that becomes your model.

#### View

1. Located in [`shared-components`](https://github.com/element-hq/element-web/tree/develop/packages/shared-components). Develop it in storybook!
2. Views are simple react components (eg: `FooView`) with very little state and logic.
3. Views must call `useViewModel` hook with the corresponding view model passed in as argument. This allows the view to re-render when something has changed in the view model. This entire mechanism is powered by [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore).
4. Views should define the interface of the view model they expect:

    ```tsx
    // Snapshot is the data that your view-model provides which is rendered by the view.
    interface FooViewSnapshot {
        value: string;
    }

    // To call function on the view model
    interface FooViewActions {
        doSomething: () => void;
    }

    // ViewModel is an object (usually a class) that implements both the interfaces listed above.
    // https://github.com/element-hq/element-web/blob/develop/packages/shared-components/src/ViewModel.ts
    type FooViewModel = ViewModel<FooViewSnapshot> & FooViewActions;

    interface FooViewProps {
        // Ideally the view only depends on the view model i.e you don't expect any other props here.
        vm: FooViewModel;
    }

    function FooView({ vm }: FooViewProps) {
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

### `useViewModel` hook

Your view must call this hook with the view-model as argument. Think of this as your view subscribing to the view model.<br>
This hook returns the snapshot from your view-model.

## Disposables and helper hooks

Disposables provide a mechanism for tracking and releases resources. This is necessary for avoiding memory leaks.

### Lifecycle of a view model

The lifecycle of a given view model is from its creation (usually through the constructor i.e `new FooViewModel(prop1, prop2)`) to the time the `dispose` method on it is called (eg: `fooViewModel.dispose()`). It is the responsibility of whoever creates the view model to call the dispose method when the view model is no longer necessary.

Disposable work by tracking anything that needs to be disposed of and then sequentially disposing them when `viewModel.dispose()` is called.

### How to use disposables

Consider the following scenarios:

#### Scenario 1: Your view model listens to some event on an event emitter <br>

In the example given below, how do you ensure that the listener on `props.emitter` is removed when the view model is disposed?

```ts
class FooViewModel ... {
    constructor(props: Props) {
        ...
        props.emitter.on("my-event", this.doSomething());
    }
}
```

You can use disposables to remove the listener when the view-model is disposed:

```ts
class FooViewModel ... {
    constructor(props: Props) {
        ...
        this.disposables.trackListener(props.emitter, "my-event", this.doSomething());
    }
}
```

#### Scenario 2: Your view model creates sub view models <br>

```ts
class FooViewModel ... {
    constructor(props: Props) {
        ...
        this.barViewModel = new BarViewModel(...);
    }
}
```

Here, we want to ensure that when `FooViewModel.dispose()` is called, it also disposes any sub view models (in this case `BarViewModel`):

```ts
class FooViewModel ... {
    constructor(props: Props) {
        ...
        this.barViewModel = this.disposables.track(new BarViewModel(...));
    }
}
```

#### Scenario 3: Tracking and disposing arbitrary resources <br>

A disposable is:

- a function
- an object with `dispose` method (like a view model)

You can therefore use disposables to track any resource that must be eventually relinquished, eg:

```ts
class Call {
    ....
    public endCall();
    public stopConnections();
}

class CallViewModel {
    ...
    constructor(props: Props) {
        const call = new Call();
        // When the view model is disposed, the following call methods will be called
        this.disposables.track(() => {
            call.endCall();
            call.stopConnections();
        });
    }
}
```

### Disposing view models from non-MVVMed react components

While we eventually want all our UI code to use MVVM, the current reality is that most of the existing code is just normal react components. We follow a bottoms up approach when it comes to moving code over to MVVM i.e we deal with child components before dealing with parent components.

This means that you need to dispose child view models from the non-MVVMed parent component.

#### Class component:

Create the view model in `componentDidMount()` and dispose the view model in `componentWillUnmount()`:

```ts
class FooComponent extends Component {
    componentDidMount() {
        this.barViewModel = new BarViewModel(...);
    }

    componentWillUnmount() {
        this.barViewModel.dispose();
    }
}
```

#### Functional Component:

Use the `useCreateAutoDisposedViewModel` hook:

```ts
export function FooComponent(props) {
    const vm = useCreateAutoDisposedViewModel(() => new BarViewModel(...));
    return <BarView vm={vm}>;
}
```

This hook will call the `dispose` method on the view model when `FooComponent` is unmounted.
