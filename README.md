# repertoire.js

[![Build Status](https://travis-ci.org/beatfactor/repertoire.svg?branch=master)](https://travis-ci.org/beatfactor/repertoire) [![NPM version](https://badge.fury.io/js/repertoire.png)](http://badge.fury.io/js/repertoire) [![Coverage Status](https://coveralls.io/repos/github/beatfactor/repertoire/badge.svg?branch=master)](https://coveralls.io/github/beatfactor/repertoire?branch=master)

***
#### [Homepage](https://repertoire.gitbook.io/home) | [Using Repertoire](https://repertoire.gitbook.io/home/using-repertoire) | [API Reference](https://repertoire.gitbook.io/home/api-reference)

# What's Repertoire
A small utility library which aims at simplifying building React + Redux apps. 

It works by simply adding the well-known Controller concept to a web application built with React as the view layer and removing the need of all the boiler plate code for actions, reducers, middlewares etc.

# Installation
Repertoire works together with React and Redux, so the following packages are needed as pre-requisites (peer dependencies) in your application:

- react
- redux
- react-redux

You can install Repertoire from NPM, using:

```sh
$ npm install repertoire --save
```

# Anatomy of a Repertoire App
Building an app with React & Redux has become much simpler. The example below is a basic user administration module, starting with the main component. We're also using the React Router to handle our application's routing needs.

```
├── modules/admin/
|     ├── components/
|     |      ├── UserAdd.js
|     |      ├── UsersList.js
|     |      └── SelectedUser.js
|     ├── api.js
|     ├── controller.js
|     └── index.js
└── index.js
```

### 1. index.js
This is the place where the Redux store is created and the app is being initialized.

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import {
  BrowserRouter as Router,
  Route
} from 'react-router-dom';
import {StoreManager} from 'repertoire'

import Admin from './modules/admin/index.js'
import Dashboard from './modules/dashboard/index.js'

const routes = [
  {
    path: '/',
    exact: true,
    controller: Dashboard
  },
  {
    exact: true,
    path: '/admin',
    controller: Admin
  }
];

// creating the main Redux store
const storeManager = new StoreManager(routes);

// rendering the main component
ReactDOM.render(<Provider store={storeManager.getStore()}>
  <Router>
    {routes.map((route, index) => {
      return <Route key={index} 
                    path={route.path} 
                    exact={route.exact} 
                    component={controller.component}/>
    })}
  </Router>    
</Provider>, document.getElementById('react-view'));
```

### 2. The Admin Controller
The Controller is the main thing that Repertoire adds to your application's architecture. It does that by combining the individual redux pieces, such as reducers, actions and middlewares, together in one logical entity.

Each public method on the controller that will be exposed on the instance will be a redux action, and each of them will have an implicit reducer associated by default.

Every action needs to return a Promise and the result of the promise will be added to the store. If an action returns a value synchronously, that value will be converted to a Promise automatically.

The controller is also the place where the Redux state properties are defined, which are passed to React as props. Use the `this.state` setter and getter to define the props to be passed to React or to inspect the current value of the Redux store.

```jsx
import {BaseController} from 'repertoire'
import AdminApi from './api.js'

export default class AdminController extends BaseController {
  // the section of the redux store which this controller will operate on
  get stateNamespace() {
    return 'admin';
  }
  
  /**
   *
   * Methods that start with "__" are not processed as actions
   *
   * @param currentUser
   * @private
   */
  __handleFetchUsers(currentUser) {}
  
  setSelectedUser (selectedUser) {
    return {
      selectedUser
    };
  }
  
  fetchAllUsers () {
    return AdminApi.getUsers().then(result => ({users: result}));
  }
  
  addNewUser (params) {
    let addUserSuccess = false;
    let lastThrownError = null;

    return AdminApi.addNewUser(params)
      .then(_ => {
        addUserSuccess = true;

        return AdminApi.getUsers();
      })
      .catch(error => {
        lastThrownError = error;

        // return the existing list of users if an error occurred
        return this.state.users;
      })
      .then(users => ({
        addUserSuccess,
        lastThrownError,
        users
      }));
  }
  
  constructor(component) {
    super(component);
    
    this.state = {
      /**
       * Each function defined on this setter will received the namespaced 
       *  redux store value
       */
      users(store) {
        return store.users || [];
      },
      
      selectedUser(store) {
        return store.selectedUser || '';
      },
      
      addUserSuccess(store) {
        return store.addUserSuccess || false;
      }
    };
    
    // Final step. This is calling the connect() utility from react-redux
    this.connect();
  }
}
```

The api.js file contains a bunch of methods which will fire HTTP requests to the backend and return a Promise. Anything that returns a Promise will work.

### 3. The Admin React Component
In the main React component file we will have to instantiate the controller, passing the component itself,  and export that instance. Other than that it's standard react / redux stuff.

```jsx
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import Controller from './controller.js';
import UserList from './components/UsersList.js';
import UserAdd from './components/UserAdd.js';
import SelectedUser from './components/SelectedUser.js';

class Admin extends Component {
  static propTypes = {
    users: PropTypes.array.isRequired,
    fetchUsers: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);

    this.state = {
      // ...
    };
  }

  componentWillMount() {
    this.props.fetchUsers();
  }

  onUserCreateCancel(e) { /* ... */ }

  onCreateUserSubmit(params) {  
    this.props.addNewUser(params);
  }

  handleUserClick(e) {
    const user = e.target.id;
    if (user) {
      this.props.setSelectedUser(user);
    }
  }

  render() {
    const {showUserCreateForm, addUserSuccess} = this.state;
    const {users, selectedUser, lastThrownError} = this.props;
    
    return users.length > 0 ? <div>
      <UserAdd showForm={showUserCreateForm}
               onCancelAddUser={this.onUserCreateCancel.bind(this)}
               onCreateUserSubmit={this.onCreateUserSubmit.bind(this)} />
                       
      <UserList users={filteredUsers || users}
                onClick={this.handleUserClick.bind(this)}
                selectedUser={selectedUser}/>

      {
        selectedUser ? <SelectedUser users={users}
                                     selectedUser={selectedUser} /> : null
      }
    </div> : null;
  }
}

export default new Controller(Admin);
```

That's pretty much it - a very basic Repertoire example, not necessarily functional though. You'll need an html template and a web server of course, along with a webpack (or other package manager) build system, but we're not going to focus on that part here.
