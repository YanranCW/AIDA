// Using Vuex paradigm to build a central store of application state.
import Vue from 'vue'
import Vuex from 'vuex'

// Import the Vuex logic that has been modularized and separated into different
// files.
import image from './modules/image'
import annotation from './modules/annotation'
import editor from './modules/editor'
import common from './modules/common'
import ui from './modules/ui'

import CognitoAuth from './modules/user'
import cognitoConfig from '../../config/cognito'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {},
  getters: {},
  actions: {},
  mutations: {},
  modules: {
    image,
    annotation,
    editor,
    common,
    cognito: new CognitoAuth(cognitoConfig),
    ui
  }
})
