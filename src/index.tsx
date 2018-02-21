import * as React from "react"
import * as ReactDOM from "react-dom"
import * as Redux from "redux"
import { createStore, applyMiddleware, compose } from "redux"
import { Provider, connect } from "react-redux"
import { AppContainer } from "react-hot-loader"
import dispatch from "./dispatchMiddleware"
import * as Router from "./router"
import { RouteToUri, UriToRoute } from "./router"
import EditableText from "./EditableText"

export * from "type-zoo"
export * from "./types"

import List from "./list"

export { React, EditableText, JSX, List }

export type AnyAction = Redux.Action

export type Dispatch = <A extends Redux.Action, E>(action: A, e?: React.SyntheticEvent<E>) => void

export type Dispatcher = {dispatch: Dispatch}

export class Component<P> extends React.PureComponent<P & Dispatcher> {
  constructor(props: P & Dispatcher) {
    super(props)
    this.dispatch = this.dispatch.bind(this)
  }

  dispatch<A extends Redux.Action, E>(
           action: A,
           eventToStop?: React.SyntheticEvent<E>) {
    if (eventToStop) eventToStop.stopPropagation()
    return this.props.dispatch(action)
  }
}

export type Goto<Route> = Router.Action<Route>
export type GotoType = Router.ActionType
export const GotoType = Router.ActionType.Goto
export const goto = Router.goto

export type Update<S, A extends AnyAction> =
  (state: S, action: A, dispatch: Dispatch) => S

export type WrappedUpdate<S, A extends AnyAction> = (state: S, action: A) => S

let store: Redux.Store<any>

export const load = function
    <State extends Router.State<Route>,
     Action extends Redux.Action,
     Route>(
    initialState: State,
    reactsTo: (action: AnyAction) => action is Action,
    update: Update<State, Action>,
    RootJSXElement:
      ((state: State) => JSX.Element) |
      { new(state: State & Dispatcher): Component<State> },
    routeToUri: RouteToUri<Route>,
    uriToRoute: UriToRoute<Route>,
    module: NodeModule,
    baseUri = "",
    rootHTMLElement= document.body.firstElementChild) {

  const wrappedUpdate = (state: State, action: Action & Dispatcher) => {
    let newState = state as Router.State<Route>
    if (Router.reactsTo<Route>(action)) {
       newState = Router.update(
        state,
        action,
        routeToUri,
        baseUri
      )
    }
    if (reactsTo(action)) {
      newState = update(
        newState as State,
        action,
        action.dispatch
      )
    }
    return newState
  }

  // Initalize the store

  const composeEnhancers = (window as any).
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

  if (store) {
    store.replaceReducer(wrappedUpdate)
  } else {
    store = createStore(
      wrappedUpdate,
      initialState,
      composeEnhancers(applyMiddleware(dispatch))
    )
  }

  class Index extends Component<any> {
    unloadRouter: () => void

    constructor(state: State & Dispatcher) {
      super(state)
      if (typeof (window as any).__REACT_HOT_LOADER__ !== "undefined") {
        (window as any).__REACT_HOT_LOADER__.warnings = false
      }
    }

    componentWillMount() {
      this.unloadRouter = Router.load(
        this.props.dispatch,
        uriToRoute,
        baseUri
      )
    }

    componentWillUnmount() {
      this.unloadRouter()
    }

    render() {
      // Force TS to see RootJSXElement as an SFC due to this bug:
      // https://github.com/Microsoft/TypeScript/issues/15463
      const Elem = RootJSXElement as any as (state: State) => JSX.Element
      return <Elem {...this.props as State}/>
    }
  }

  const View = connect((s: any) => s)(Index)

  ReactDOM.render(
    <AppContainer>
      <Provider store={store}>
        <View />
      </Provider>
    </AppContainer>,
    rootHTMLElement
  )

  const mod = module as HotModule
  if (mod.hot) mod.hot.accept()
}

export interface HotModule extends NodeModule {
  hot: {
    accept: (file?: string, cb?: () => void) => void;
    dispose: (callback: () => void) => void;
  } | null
}

export const withDispatch =
  <S, A extends AnyAction> (f: Update<S, A>): WrappedUpdate<S, A> =>
    (state, action) => f(state, action, <A extends AnyAction>(a: A)  => a)
