# MVVM

General description of the pattern can be found [here](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel). But the gist of it is that you divide your code into three sections:

1. Model: This is where the business logic and data resides.
2. View Model: This code exists to provide the logic necessary for the UI. It directly uses the Model code.
3. View: This is the UI code itself and depends on the view model.

If you do MVVM right, your view should be dumb i.e it gets data from the view model and merely displays it.

### Practical guidelines for MVVM in element-web

#### Model

This is anywhere your data or business logic comes from. If your view model is accessing something simple exposed from `matrix-js-sdk`, then the sdk is your model. If you're using something more high level in element-web to get your data/logic (eg: `MemberListStore`), then that becomes your model.

#### View Model

1. View model is always a custom react hook named like `useFooViewModel()`.
2. The return type of your view model (known as view state) must be defined as a typescript interface:
    ```ts
    inteface FooViewState {
    	somethingUseful: string;
    	somethingElse: BarType;
    	update: () => Promise<void>
    	...
    }
    ```
3. Any react state that your UI needs must be in the view model.

#### View

1. Views are simple react components (eg: `FooView`).
2. Views usually start by calling the view model hook, eg:
    ```tsx
    const FooView: React.FC<IProps> = (props: IProps) => {
    	const vm = useFooViewModel();
    	....
    	return(
    		<div>
    			{vm.somethingUseful}
    		</div>
    	);
    }
    ```
3. Views are also allowed to accept the view model as a prop, eg:
    ```tsx
    const FooView: React.FC<IProps> = ({ vm }: IProps) => {
    	....
    	return(
    		<div>
    			{vm.somethingUseful}
    		</div>
    	);
    }
    ```
4. Multiple views can share the same view model if necessary.

### Benefits

1. MVVM forces a separation of concern i.e we will no longer have large react components that have a lot of state and rendering code mixed together. This improves code readability and makes it easier to introduce changes.
2. Introduces the possibility of code reuse. You can reuse an old view model with a new view or vice versa.
3. Adding to the point above, in future you could import element-web view models to your project and supply your own views thus creating something similar to the [hydrogen sdk](https://github.com/element-hq/hydrogen-web/blob/master/doc/SDK.md).

### Example

We started experimenting with MVVM in the redesigned memberlist, you can see the code [here](https://github.com/vector-im/element-web/blob/develop/src/components/views/rooms/MemberList/MemberListView.tsx).
