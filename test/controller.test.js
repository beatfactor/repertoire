import React, {Component} from 'react'
import {bindActionCreators} from 'redux'
import PropTypes from 'prop-types'
import TestRenderer from 'react-test-renderer'
import {Provider, connect} from 'react-redux'
import Controller from '../src/controller.js'
import StoreManager, {dispatchActions} from '../src/store.js'

describe('Controller tests', function () {
  class API {
    static fetchApps() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve({
            apps: [{
              id: '1234-abc',
              name: 'TestApp'
            }]
          });
        }, 50);
      });
    }

    static fetchAppsThrowsError() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const err = new Error('Not Found');
          err.statusCode = 404;

          reject(err);
        }, 50);
      });
    }
  }

  class Container extends Component {
    render() {
      return <div/>
    }
  }

  class AppController extends Controller {
    get stateNamespace() {
      return 'components';
    }

    fetchApps() {
      return API.fetchApps()
        .then(response => ({
          currentApps: response.apps
        }));
    }

    fetchAppsErrorThrown() {
      return API.fetchAppsThrowsError();
    }

    fetchAppsErrorThrownCaught() {
      return API.fetchAppsThrowsError().catch(lastError => {
        return {
          currentApps: ['default'],
          lastError
        }
      });
    }

    otherAction(payload) {
      return {
        testProp: 'something'
      }
    }

    constructor(component, autoConnect = true) {
      super(component);

      this.state = {
        currentApps(state) {
          return state.currentApps || [];
        },

        lastError(state) {
          return state.lastError || null;
        }
      };

      if (autoConnect) {
        this.connect();
      }
    }
  }

  class OtherContainer extends Component {
    componentDidMount() {
      this.props.otherAction({something: 'else'});
    }

    render() {
      return <div />;
    }
  }

  OtherContainer.propTypes = {
    otherAction: PropTypes.func.isRequired
  };

  it('test if controller actions passed as props', function () {
    const controllerInstance = new AppController(Container);
    const storeManager = new StoreManager([
      {
        path: '/',
        component: controllerInstance
      },
    ]);

    const testRenderer = TestRenderer.create(<Provider store={storeManager.getStore()}>
      <controllerInstance.component />
    </Provider>);

    const container = {
      ...testRenderer.root.findByType(Container).props
    };

    expect(typeof container.fetchApps).toBe('function');
    expect(container.currentApps).toEqual([]);
    expect(container.lastThrownError).toBeNull();
  });

  it('test controller action called correctly', function () {
    const controllerInstance = new AppController(Container);
    const storeManager = new StoreManager([
      {
        path: '/',
        component: controllerInstance
      },
    ]);

    const testRenderer = TestRenderer.create(<Provider store={storeManager.getStore()}>
      <controllerInstance.component />
    </Provider>);

    expect(typeof controllerInstance.fetchApps).toBe('function');

    return new Promise((resolve, reject) => {
      const promise = controllerInstance.fetchApps();
      expect(promise).toBeInstanceOf(Promise);

      promise.then(response => {
        const container = {
          ...testRenderer.root.findByType(Container).props
        };

        expect(container.currentApps).toEqual([{
          id: '1234-abc',
          name: 'TestApp'
        }]);

        expect(response).toEqual({
          currentApps: [{
            id: '1234-abc',
            name: 'TestApp'
          }],
          lastThrownError: null,
          lastError: null
        });

        expect(controllerInstance.state.currentApps).toEqual([{
          id: '1234-abc',
          name: 'TestApp'
        }]);

        resolve();
      });
    });
  });

  it('test controller action throws error', function () {
    const controllerInstance = new AppController(Container);
    const storeManager = new StoreManager([
      {
        path: '/',
        component: controllerInstance
      },
    ]);

    const testRenderer = TestRenderer.create(<Provider store={storeManager.getStore()}>
      <controllerInstance.component />
    </Provider>);

    expect(typeof controllerInstance.fetchAppsErrorThrown).toBe('function');

    return new Promise((resolve, reject) => {
      const promise = controllerInstance.fetchAppsErrorThrown();
      expect(promise).toBeInstanceOf(Promise);

      promise.catch(err => {
        const container = {
          ...testRenderer.root.findByType(Container).props
        };

        expect(container.lastThrownError).toStrictEqual(err);
        expect(container.lastThrownError.initiator).toBe('fetchAppsErrorThrown');
        expect(container.currentApps).toEqual([]);

        expect(err).toBeInstanceOf(Error);
        expect(controllerInstance.state.lastThrownError).toBeInstanceOf(Error);
        expect(controllerInstance.state.lastThrownError).toStrictEqual(err);

        resolve();
      });
    });
  });

  it('test controller action thrown error is caught', function () {
    const controllerInstance = new AppController(Container);
    const storeManager = new StoreManager([
      {
        path: '/',
        component: controllerInstance
      },
    ]);

    const testRenderer = TestRenderer.create(<Provider store={storeManager.getStore()}>
      <controllerInstance.component />
    </Provider>);

    expect(typeof controllerInstance.fetchAppsErrorThrownCaught).toBe('function');

    return new Promise((resolve, reject) => {
      const promise = controllerInstance.fetchAppsErrorThrownCaught();
      expect(promise).toBeInstanceOf(Promise);

      promise.then(response => {
        const container = {
          ...testRenderer.root.findByType(Container).props
        };

        expect(response.lastError).toBeInstanceOf(Error);
        expect(response.lastError.initiator).toBe('fetchAppsErrorThrownCaught');
        expect(container.lastError).toBeInstanceOf(Error);
        expect(container.lastThrownError).toBeNull();
        expect(container.currentApps).toEqual(['default']);

        expect(controllerInstance.state.lastError).toBeInstanceOf(Error);
        expect(controllerInstance.state.lastThrownError).toBeNull();

        resolve();
      });
    });
  });

  it('test controller addWatcher', function () {
    const mapDispatchToProps = dispatch => bindActionCreators({
      otherAction: dispatchActions.otherAction
    }, dispatch);

    const mapStateToProps = state => {
      expect(typeof state.components).toBe('object');
      expect(state.components.currentApps).toEqual([]);

      return {
        testProp: state.components.testProp || null
      };
    };

    const Container = connect(mapStateToProps, mapDispatchToProps)(function Container(props) {
      return <OtherContainer {...props}/>
    });

    class ExtendedContainer extends Component {
      render() {
        return <Container/>;
      }
    }

    const appControllerInstance = new AppController(ExtendedContainer, false);

    return new Promise((resolve, reject) => {
      appControllerInstance.addWatcher('otherAction', function(payload) {
        const promise = appControllerInstance.fetchApps();
        expect(promise).toBeInstanceOf(Promise);
        expect(payload).toEqual({something: 'else'});

        resolve();
      });

      appControllerInstance.connect();

      const storeManager = new StoreManager([
        {
          path: '/',
          component: appControllerInstance
        },
      ]);

      const testRenderer = TestRenderer.create(<Provider store={storeManager.getStore()}>
        <appControllerInstance.component/>
      </Provider>);
    });
  });
});